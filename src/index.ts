import { existsSync, mkdirSync } from "fs";
import path from "path";
import { ZodError } from "zod";
import { RouteError, ZodErrorWithMessage } from "./error";
import html, { HTMLTemplateString, page } from "./html";
import { Route } from "./route";
import { openVSCode, parseBoolean, walk } from "./utils";
import { MatchedRoute, Serve, Server, ServerWebSocket } from "bun";
import { WebSocketContext } from "./ws";

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
const compress = process.env.GATEWAY_COMPRESS ? parseBoolean(process.env.GATEWAY_COMPRESS) : env == "prod";
const fileGen = process.env.GATEWAY_GEN;

if (!debug) {
	console.debug = () => {};
}

if (fileGen) {
	const filePath = path.join("pages", fileGen.endsWith(".ts") ? fileGen : `${fileGen}.ts`);
	const folderPath = filePath.split("/").slice(0, -1).join("/");
	if (!existsSync(folderPath)) {
		mkdirSync(folderPath);
	}
	const file = Bun.file(filePath);
	if (await file.exists()) {
		console.error(`❌ ${file.name} already exists.`);
		process.exit(-1);
	}
	const input = Bun.file(path.join(import.meta.dir, "../gen/route.ts"));
	await Bun.write(file, await input.text());
	console.log(`📝 ${file.name} created.`);
	openVSCode(filePath);
	process.exit(0);
}

console.log(`ℹ️ env: ${env}, bun: ${Bun.version}`);

if (env == "dev") {
	console.log(`⚠️ Watch mode is not yet stable.`);
}

const appIndex = path.join(process.cwd(), "src/index.ts");
if (await Bun.file(appIndex).exists()) {
	await import(appIndex);
}

const pages = new Map<string, Route>();
console.log("📁 Loading routes...");
for await (const file of walk("./pages", ["ts"])) {
	console.log(`	🔗 ${file}`);
	const absolute = path.join(process.cwd(), file);
	const clazz = import.meta.require(absolute);
	const route = new clazz.default();
	if (route.ws) route._ws = await route.ws();
	pages.set(file.split("/").slice(1).join("/"), route);
}

const notFound = pages.get("404.ts");

const defaultHead = html`
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
`;

console.log(`🌌 Server running at ${hostname}:${port} / http://127.0.0.1:${port}`);

type Ctx = {
	match: MatchedRoute | null;
	route?: Route;
	pathname: string;
	requestingJsonFile: boolean;
	upgraded: boolean;
};

function context(req: Request, server: Server): Ctx {
	let slashes = 0;
	let pathname = req.url;
	let char;
	const jsonExtensionOffset = req.url.length - 5;
	let requestingJsonFile = false;

	for (let i = 0; i < req.url.length; i++) {
		char = req.url.charAt(i);
		if (char == "/") {
			if (slashes == 2) {
				pathname = req.url.slice(i);
			}
			slashes++;
		}
		if (i == jsonExtensionOffset && char == "." && req.url.slice(i) == ".json") {
			pathname = pathname.slice(0, pathname.length - 5);
			requestingJsonFile = true;
		}
	}

	const match = router.match(pathname);
	const route = match ? pages.get(match.src) : undefined;
	const upgraded =
		route && route.ws
			? server.upgrade<WebSocketContext>(req, {
					data: {
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
		requestingJsonFile,
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
		const clientRequestingJSON = ctx.requestingJsonFile || req.headers.get("accept") == "application/json";
		try {
			data = ctx.route.data ? await ctx.route.data(req, ctx.match!) : null;
		} catch (e: any) {
			err = e;
			console.error(`❌ [${err.name}] ${ctx.pathname} ${err.message}`);
			switch (err.constructor) {
				case ZodError:
					err = new ZodErrorWithMessage(err.issues);
					break;
				case TypeError:
					console.error(err);
					break;
				case RouteError:
					if (err.redirect && !clientRequestingJSON) {
						return Response.redirect(err.redirect);
					}
					break;
			}
		}
		if (data && clientRequestingJSON) {
			const sanitized = Object.entries(data).reduce((obj, [key, value]) => {
				if (key.charAt(0) != "_") {
					// @ts-ignore
					obj[key] = value;
				}
				return obj;
			}, {});
			return Response.json(sanitized);
		}
		if (!data && err && clientRequestingJSON && throwJSONErrors) {
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
		if (ctx.route.body) {
			try {
				const body = ctx.route.body(data, err);
				if (body instanceof Response) {
					return body;
				}
				let head = ctx.route.head ? ctx.route.head(data, err) : null;
				return new Response(
					page(head ? html`${defaultHead.value}${head.value}` : defaultHead, body, ctx.route.ws != undefined),
					{
						headers: {
							"Content-Type": "text/html; charset=utf-8",
						},
					}
				);
			} catch (err: any) {
				if (err instanceof RouteError && err.redirect) {
					console.error(`❌ [${err.name}] ${ctx.pathname} ${err.message}`);
					return Response.redirect(err.redirect);
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
		const head = notFound.head ? notFound.head(null) : null;
		const body = notFound.body(null);
		if (body instanceof Response) return body;
		return new Response(
			page(
				head ? html`${defaultHead.value}${head.value}` : defaultHead,
				body as unknown as HTMLTemplateString,
				notFound.ws != undefined
			),
			{
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
				status: 404,
			}
		);
	} else {
		return new Response("", {
			status: 404,
		});
	}
}

export default {
	hostname,
	port,
	development: env == "dev",
	fetch: async (req: Request, server: Server) => {
		const ctx = context(req, server);
		if (ctx.upgraded) return;
		const res = await request(req, ctx);
		if (!compress) return res;
		const acceptEncoding = req.headers.get("accept-encoding");
		if (!acceptEncoding) return res;
		if (acceptEncoding.indexOf("gzip") > -1) {
			const buffer = await res.arrayBuffer();
			res.headers.append("Content-Encoding", "gzip");
			return new Response(Bun.gzipSync(new Uint8Array(buffer)), {
				headers: res.headers,
				status: res.status,
			});
		}
		return res;
	},
	websocket: {
		perMessageDeflate: compress,
		open: async (ws: ServerWebSocket<WebSocketContext>) => {
			if (env == "dev") {
				console.log(`📡 [WS] ${ws.data.pathname}`);
			}
			// @ts-ignore
			if (ws.data.route._ws.open) await ws.data.route._ws.open(ws);
		},
		message: async (ws: ServerWebSocket<WebSocketContext>, message: string | Uint8Array) => {
			// @ts-ignore
			if (ws.data.route._ws.message) await ws.data.route._ws.message(ws, message);
		},
		close: async (ws: ServerWebSocket<WebSocketContext>, code: number, message: string) => {
			// @ts-ignore
			if (ws.data.route._ws.close) await ws.data.route._ws.close(ws, code, message);
		},
	},
} satisfies Serve<WebSocketContext>;
