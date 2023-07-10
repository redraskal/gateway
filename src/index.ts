import { existsSync, mkdirSync } from "fs";
import path from "path";
import { ZodError } from "zod";
import { RouteError, ZodErrorWithMessage } from "./exports";
import html, { HTMLTemplateString, page } from "./html";
import { Route } from "./route";
import { openVSCode, parseBoolean, walk } from "./utils";

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
	pages.set(file.split("/").slice(1).join("/"), new clazz.default());
}

const notFound = pages.get("404.ts");

const defaultHead = html`
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
`;

console.log(`🌌 Server running at ${hostname}:${port} / http://127.0.0.1:${port}`);

async function request(req: Request): Promise<Response> {
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
	const route = match ? pages.get(match.src) : null;
	if (route) {
		if (env == "dev") {
			console.log(`🔍 [${req.method}] ${pathname}`);
		}
		let data: any;
		let err: any;
		const clientRequestingJSON = requestingJsonFile || req.headers.get("accept") == "application/json";
		try {
			data = route.data ? await route.data(req, match!) : null;
		} catch (e: any) {
			err = e;
			console.error(`❌ [${err.name}] ${pathname} ${err.message}`);
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
		if (route.body) {
			try {
				const body = route.body(data, err);
				if (body instanceof Response) {
					return body;
				}
				let head = route.head ? route.head(data, err) : null;
				return new Response(page(head ? html`${defaultHead.value}${head.value}` : defaultHead, body), {
					headers: {
						"Content-Type": "text/html; charset=utf-8",
					},
				});
			} catch (err: any) {
				if (err instanceof RouteError && err.redirect) {
					console.error(`❌ [${err.name}] ${pathname} ${err.message}`);
					return Response.redirect(err.redirect);
				}
				console.error(err);
			}
		}
	}
	const file = Bun.file(path.join("public", pathname));
	if (await file.exists()) {
		let response = new Response(file);
		if (env == "prod") {
			response.headers.set("Cache-Control", `max-age=${cacheTTL}`);
		}
		return response;
	}
	if (env == "dev") {
		console.log(`⚠️ 404: [${req.method}] ${pathname}`);
	}
	if (notFound && notFound.body) {
		const head = notFound.head ? notFound.head(null) : null;
		const body = notFound.body(null);
		if (body instanceof Response) {
			return body;
		}
		return new Response(
			page(head ? html`${defaultHead.value}${head.value}` : defaultHead, body as unknown as HTMLTemplateString),
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
	fetch: async (req: Request) => {
		const res = await request(req);
		if (!compress) return res;
		const acceptEncoding = req.headers.get("accept-encoding")?.split(", ") || [];
		if (acceptEncoding.includes("gzip")) {
			const buffer = await res.arrayBuffer();
			res.headers.append("Content-Encoding", "gzip");
			return new Response(Bun.gzipSync(new Uint8Array(buffer)), {
				headers: res.headers,
				status: res.status,
			});
		}
		return res;
	},
};
