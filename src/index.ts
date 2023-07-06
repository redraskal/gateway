import path from "path";
import html, { page } from "./html";
import { Route } from "./route";
import { parseBoolean, walk } from "./utils";

const router = new Bun.FileSystemRouter({
	style: "nextjs",
	dir: "./pages",
});

export type Environment = "dev" | "prod";

const hostname = process.env.GATEWAY_HOSTNAME || "0.0.0.0";
const port = process.env.GATEWAY_PORT || "3000";
export const env = process.env.GATEWAY_ENV?.toLowerCase() as Environment || "prod";
const cacheTTL = Number.parseInt(process.env.GATEWAY_CACHE_TTL || "3600");
const throwJSONErrors = process.env.GATEWAY_JSON_ERRORS ? parseBoolean(process.env.GATEWAY_JSON_ERRORS) : true;
const compress = process.env.GATEWAY_COMPRESS ? parseBoolean(process.env.GATEWAY_COMPRESS) : env == "prod";

console.log(`ℹ️ env: ${env}, bun: ${Bun.version}`);

const pages = new Map<string, Route>();
console.log("📁 Loading routes...");
for await (const file of walk("./pages", ["ts"])) {
	console.log(`	🔗 ${file}`);
	const absolute = path.join(process.cwd(), file);
	const clazz = import.meta.require(absolute);
	pages.set(absolute, new clazz.default());
}

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
	if (match && pages.has(match.filePath)) {
		if (env == "dev") {
			console.log(`🔍 [${req.method}] ${url.pathname}`);
		}
		const route = pages.get(match.filePath)!;
		let data: any;
		let err: any;
		try {
			data = route.data ? await route.data(req) : null;
		} catch (e: any) {
			err = e;
			console.error(`❌ [${err.name}] ${url.pathname} ${err.message}`);
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
	return new Response("", {
		status: 404,
	});
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
