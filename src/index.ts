import path from "path";
import html, { page } from "./html";
import { Route } from "./route";
import { openVSCode, parseBoolean, walk } from "./utils";

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: "./pages",
});

export type Environment = "dev" | "prod";

const hostname = process.env.GATEWAY_HOSTNAME || "0.0.0.0";
const port = process.env.GATEWAY_PORT || "3000";
export const env = process.env.GATEWAY_ENV?.toLowerCase() as Environment || "prod";
const debug = process.env.GATEWAY_DEBUG ? parseBoolean(process.env.GATEWAY_DEBUG) : false;
const cacheTTL = Number.parseInt(process.env.GATEWAY_CACHE_TTL || "3600");
const throwJSONErrors = process.env.GATEWAY_JSON_ERRORS ? parseBoolean(process.env.GATEWAY_JSON_ERRORS) : true;
const compress = process.env.GATEWAY_COMPRESS ? parseBoolean(process.env.GATEWAY_COMPRESS) : env == "prod";
const fileGen = process.env.GATEWAY_GEN;

if (!debug) {
	console.debug = () => {};
}

console.log(`ℹ️ env: ${env}, bun: ${Bun.version}`);

if (fileGen) {
	const filePath = path.join("pages", fileGen.endsWith(".ts") ? fileGen : `${fileGen}.ts`);
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

if (env == "dev") {
	console.log(`⚠️ Watch mode is not yet stable.`);
}

const pages = new Map<string, Route>();
console.log("📁 Loading routes...");
for await (const file of walk("./pages", ["ts"])) {
	console.log(`	🔗 ${file}`);
	const absolute = path.join(process.cwd(), file);
	const clazz = import.meta.require(absolute);
	pages.set(file, new clazz.default());
}
const notFound = pages.get("pages/404.ts");

const defaultHead = html`
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1">
`;

console.log(`🦊 Server running at ${hostname}:${port} / http://127.0.0.1:${port}`);

const appIndex = path.join(process.cwd(), "src/index.ts");
if (await Bun.file(appIndex).exists()) {
	import.meta.require(appIndex);
}

async function request(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const requestingJsonFile = url.pathname.endsWith(".json");
	const match = router.match(requestingJsonFile ? url.pathname.split(".json")[0] : url.pathname);
	const matchKey = match ? `pages/${match.src}` : null;
	if (match && matchKey && pages.has(matchKey)) {
		if (env == "dev") {
			console.log(`🔍 [${req.method}] ${url.pathname}`);
		}
		const route = pages.get(matchKey)!;
		let data: any;
		let err: any;
		try {
			data = route.data ? await route.data(req, match) : null;
		} catch (e: any) {
			err = e;
			if (err instanceof TypeError) {
				console.error(err);
			} else {
				console.error(`❌ [${err.name}] ${url.pathname} ${err.message}`);
			}
		}
		const accept = req.headers.get("accept") || "";
		const clientRequestingJSON = requestingJsonFile || accept == "application/json";
		if (data && clientRequestingJSON) {
			const sanitized = Object.entries(data).reduce((obj, [key, value]) => {
				if (!key.startsWith("_")) {
					// @ts-ignore
					obj[key] = value;
				}
				return obj;
			}, {});
			return Response.json(sanitized);
		}
		if (!data && err && clientRequestingJSON && throwJSONErrors) {
			return Response.json({
				error: {
					type: err.name,
					message: err.message,
				},
			}, {
				status: 502,
			});
		}
		if (route.body && (accept == "*/*" || accept.indexOf("text/html") > -1)) {
			let head = route.head ? route.head(data, err) : null;
			const body = route.body(data, err);
			return new Response(page(head ? html`${defaultHead.value}${head.value}` : defaultHead, body), {
				headers: {
					"Content-Type": "text/html; charset=utf-8",
				},
			});
		}
	}
	const file = Bun.file(path.join("public", url.pathname));
	if (await file.exists()) {
		let response = new Response(file);
		if (env == "prod") {
			response.headers.set("Cache-Control", `max-age=${cacheTTL}`);
		}
		return response;
	}
	if (env == "dev") {
		console.log(`⚠️ 404: [${req.method}] ${url.pathname}`);
	}
	if (notFound && notFound.body) {
		const head = notFound.head ? notFound.head(null) : null;
		const body = notFound.body(null);
		return new Response(page(head ? html`${defaultHead.value}${head.value}` : defaultHead, body), {
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

export default {
	hostname,
	port,
	fetch: async (req: Request) => {
		const acceptEncoding = req.headers.get("accept-encoding")?.split(", ") || [];
		const res = await request(req);
		if (compress && acceptEncoding.includes("gzip")) {
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
