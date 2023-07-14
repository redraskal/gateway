# Gateway

**This is a work in progress. The API is subject to change until a stable version is released.**

## Features:

- Server-side rendered HTML (SSR)
- [Next.js-style filesystem router](https://bun.sh/docs/api/file-system-router) (pages/)
- Class-based routes
- JSON responses on all routes via application/json Accept header
- JSON file routes (example: /articles/bun.json)
- Automatic JSON error responses
- Zod Request body parsing (zod())
- Static file serving & caching (public/)
- Compression (gzip)
- Optional entrypoint (src/index.ts)
- Optional 404 page (pages/404.ts)
- Route file generator via CLI (bun gen)

```ts
import { Data, Route, html, parse } from "gateway";

export default class implements Route {
	async data(req: Request) {
		// parse JSON or form Request body
		const data = await parse<{
			name: string;
		}>(req);
		return {
			time: new Date(Date.now()).toLocaleString(),
			name: data?.name || "world",
			_secret: "yes", // omitted in JSON responses
		};
	}

	head(data: Data<this>) {
		return html`<title>Hello ${data.name}!</title>`;
	}

	body(data: Data<this>) {
		return html`
			<h1>Hello ${data.name} at ${data.time}!</h1>
			<form method="post">
				<label for="name">Name</label>
				<input type="text" id="name" name="name" autofocus required />
				<input type="submit" value="Submit" />
			</form>
		`;
	}
}
```

## To install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

## To create a project:

```bash
bun create redraskal/gateway-template {dir}
```

## To run a development server:

```bash
bun run dev
```

## To run a production server:

```bash
bun start
```

## Environmental variables:

| Name                | Description                                | Default                                         |
| ------------------- | ------------------------------------------ | ----------------------------------------------- |
| GATEWAY_HOSTNAME    | HTTP server hostname                       | 0.0.0.0                                         |
| GATEWAY_PORT        | HTTP server port                           | 3000                                            |
| GATEWAY_ENV         | Environment                                | prod with `bun start`, dev with `bun run dev`   |
| GATEWAY_DEBUG       | console.debug output                       | false                                           |
| GATEWAY_CACHE_TTL   | Cache-Control max age                      | 3600                                            |
| GATEWAY_JSON_ERRORS | Whether to output errors in JSON responses | true                                            |
| GATEWAY_COMPRESS    | Whether to compress responses              | true with `bun start`, false with `bun run dev` |

## To generate a route:

```bash
bun gen {name}

bun gen test
# or
bun gen test.ts
# 📝 pages/test.ts created.
```

The new route will automatically open in Visual Studio Code.

This project was created using `bun init` in bun v0.6.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
