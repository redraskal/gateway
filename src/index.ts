import { watch } from "fs";
import path from "path";
import { ZodError } from "zod";
import { RouteError, ZodErrorWithMessage } from "./error";
import { page } from "./html";
import { Route } from "./route";
import { generateFile, parseBoolean, walk } from "./utils";
import type { MatchedRoute, Server, ServerWebSocket } from "bun";
import type { WebSocketContext } from "./ws";
import { cp, exists, mkdir, rmdir } from "fs/promises";

declare global {
	var reloads: number;
	var server: Server;
}

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: "./pages",
});

export type Environment = "dev" | "prod";

const hostname = process.env.GATEWAY_HOSTNAME || "0.0.0.0";
const port = process.env.GATEWAY_PORT || "3000";
export const env = (process.env.GATEWAY_ENV?.toLowerCase() as Environment) || "prod";

const debug = process.env.GATEWAY_DEBUG ? parseBoolean(process.env.GATEWAY_DEBUG) : false;

const cacheTTL = Number.parseInt(process.env.GATEWAY_CACHE_TTL || "3600");
const throwJSONErrors = process.env.GATEWAY_JSON_ERRORS ? parseBoolean(process.env.GATEWAY_JSON_ERRORS) : true;
const maxRequestBodySize = process.env.GATEWAY_MAX_REQUEST_BODY_SIZE
	? Number(process.env.GATEWAY_MAX_REQUEST_BODY_SIZE)
	: 1024 * 1024 * 128;

const generate = process.env.GATEWAY_GEN;
const useStaticFiles = await exists("./public");

if (!debug) console.debug = () => {};

if (generate) {
	const created = await generateFile(generate);
	process.exit(created ? 0 : -1);
}

console.log(`ℹ️ env: ${env}, bun: ${Bun.version}`);

globalThis.reloads ??= -1;
globalThis.reloads++;

if (globalThis.server) globalThis.server.publish("reload", "reload");

const appIndex = path.join(process.cwd(), "src/index.ts");
if (await Bun.file(appIndex).exists()) await import(appIndex);

const pages: Record<string, Route> = {};
console.log("📁 Loading routes...");

for await (const file of walk("./pages", ["ts"])) {
	const absolute = path.join(process.cwd(), file);
	const clazz = await import(absolute);
	const route = new clazz.default();

	if (route.ws) route._ws = route.ws();

	pages[file.replaceAll("\\", "/").split("/").slice(1).join("/")] = route;
}

if (process.env.GATEWAY_BUILD) {
	const buildDir =
		process.env.GATEWAY_BUILD != "1" && process.env.GATEWAY_BUILD != "" ? process.env.GATEWAY_BUILD : "dist";

	console.log("🏗️ Building...");

	if (await exists(buildDir)) {
		await rmdir(buildDir, { recursive: true });
	}

	await mkdir(buildDir);

	if (useStaticFiles) {
		await cp("public", buildDir, { recursive: true });
	}

	for await (let [key, route] of Object.entries(pages)) {
		const file = Bun.file(path.join(buildDir, key.replace(".ts", ".html")));
		// @ts-ignore
		const data = route.data ? await route.data(new Request(`http://127.0.0.1/${key}`), {}) : null;
		const head = route.head ? route.head(data) : "";
		const body = route.body ? route.body(data) : "";

		await Bun.write(file, page(head, body instanceof Response ? await body.text() : body, false));
	}

	process.exit(0);
}

if (env == "dev") {
	watch(
		"./pages",
		{
			persistent: false,
			recursive: true,
		},
		(file: string) => {
			if (!pages[file]) process.exit(8);
		}
	);
}

const notFound = pages["404.ts"];

type Ctx = {
	match: MatchedRoute | null;
	route?: Route;
	pathname: string;
	jsonRequest: boolean;
	upgraded: boolean;
};

function context(req: Request, server: Server): Ctx {
	let indexOfPath = 0;
	let slashes = 0;

	for (let i = 0; i < req.url.length; i++) {
		if (slashes > 2) {
			indexOfPath = i - 1;
			break;
		} else if (req.url.charAt(i) == "/") {
			slashes++;
		}
	}

	const path = req.url.slice(indexOfPath, req.url.length);
	const query = path.indexOf("?");
	const jsonFile = path.endsWith(".json", query < 0 ? path.length : query);
	const pathname = jsonFile
		? query < 0
			? path.slice(0, path.length - 5)
			: path.slice(0, query - 5) + path.slice(query)
		: path;

	const match = router.match(pathname);
	const route = match ? pages[match.src] : undefined;

	const upgraded =
		route && (route.ws || env == "dev")
			? server.upgrade<WebSocketContext>(req, {
					data: {
						// @ts-ignore
						headers: req.headers,
						route,
						pathname,
					},
				})
			: false;

	return {
		match,
		route,
		pathname,
		jsonRequest: jsonFile || req.headers.get("accept") == "application/json",
		upgraded,
	};
}

async function request(req: Request, ctx: Ctx): Promise<Response> {
	if (ctx.route) {
		if (env == "dev") {
			console.log(`🔍 [${req.method}] ${ctx.pathname}`);
		}

		let data: any;
		let err: any;

		try {
			data = ctx.route.data ? await ctx.route.data(req, ctx.match!) : null;

			if (data && ctx.jsonRequest) {
				if (data instanceof Array) return Response.json(data);

				// TODO: optimize or remove this feature
				const sanitized = Object.entries(data).reduce((obj, [key, value]) => {
					if (key.charAt(0) != "_") {
						// @ts-ignore
						obj[key] = value;
					}
					return obj;
				}, {});

				return Response.json(sanitized);
			}
		} catch (e: any) {
			err = e;

			switch (err.constructor) {
				case ZodError:
					console.error(`❌ [${err.name}] ${ctx.pathname} ${err.message}`);
					err = new ZodErrorWithMessage(err.issues);
					break;
				case TypeError:
					console.error(err);
					break;
				case RouteError:
					console.error(`❌ [${err.name}] ${ctx.pathname} ${err.message}`);
					if (err.redirect && !ctx.jsonRequest) {
						return Response.redirect(err.redirect, 302);
					}
					break;
				default:
					console.error(e);
			}

			if (ctx.jsonRequest && throwJSONErrors) {
				return Response.json(
					{
						error: {
							type: err.name,
							issues: err instanceof ZodError ? err.issues : undefined,
							message: err.message,
						},
					},
					{
						status: 502,
					}
				);
			}
		}

		if (ctx.route.body) {
			try {
				const body = ctx.route.body(data, err);

				if (body instanceof Response) {
					return body;
				}

				const head = ctx.route.head ? ctx.route.head(data, err) : "";
				// @ts-ignore
				const html =
					ctx.route.cached && env != "dev"
						? ctx.route.cached
						: page(head, body, ctx.route.ws != undefined || env == "dev");

				return new Response(html, {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
					},
				});
			} catch (err: any) {
				if (err instanceof RouteError && err.redirect) {
					console.error(`❌ [${err.name}] ${ctx.pathname} ${err.message}`);
					return Response.redirect(err.redirect, 302);
				}

				console.error(err);
			}
		}
	}

	const file = Bun.file(path.join("public", ctx.pathname));

	if (await file.exists()) {
		let response = new Response(file);

		if (env == "prod") {
			response.headers.set("Cache-Control", `max-age=${cacheTTL}`);
		}

		return response;
	}

	if (env == "dev") {
		console.log(`⚠️ 404: [${req.method}] ${ctx.pathname}`);
	}

	if (notFound && notFound.body) {
		const head = notFound.head ? notFound.head(null) : "";
		const body = notFound.body(null);

		if (body instanceof Response) return body;

		return new Response(page(head, body as string, notFound.ws != undefined || env == "dev"), {
			headers: {
				"Content-Type": "text/html; charset=utf-8",
			},
			status: 404,
		});
	} else {
		return new Response("", {
			status: 404,
		});
	}
}

globalThis.server = Bun.serve<WebSocketContext>({
	hostname,
	port,
	reusePort: true,
	development: env == "dev",
	maxRequestBodySize,
	fetch: async (req: Request, server: Server) => {
		const ctx = context(req, server);
		if (ctx.upgraded) return;
		return await request(req, ctx);
	},
	websocket: {
		open: async (ws: ServerWebSocket<WebSocketContext>) => {
			if (env == "dev") {
				console.log(`📡 [WS] ${ws.data.pathname}`);
				ws.subscribe("reload");
			}
			if (globalThis.reloads > 0 && ws.data.headers.get("sec-websocket-protocol") == "reconnect") {
				ws.send("reload");
				return;
			}
			// @ts-ignore
			if (ws.data.route._ws?.open) await ws.data.route._ws.open(ws);
		},
		message: async (ws: ServerWebSocket<WebSocketContext>, message: string | Uint8Array) => {
			// @ts-ignore
			if (ws.data.route._ws?.message) await ws.data.route._ws.message(ws, message);
		},
		close: async (ws: ServerWebSocket<WebSocketContext>, code: number, message: string) => {
			// @ts-ignore
			if (ws.data.route._ws?.close) await ws.data.route._ws.close(ws, code, message);
		},
	},
});

if (env == "dev" && useStaticFiles) {
	console.log(`🔎 Watching "public" for changes...`);
	watch(
		"./public",
		{
			persistent: false,
			recursive: true,
		},
		() => {
			server.publish("reload", "reload");
		}
	);
}

console.log(`🌌 Server running at ${server.hostname}:${server.port} / http://127.0.0.1:${port}`);
