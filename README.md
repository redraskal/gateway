# Gateway

**This is a work in progress. The API is subject to change until a stable version is released.**

## Features:

* Server-side rendered HTML (SSR)
* [Next.js-style filesystem router](https://bun.sh/docs/api/file-system-router) (pages/)
* Class-based routes
* Automatic JSON responses on all routes
* Automatic JSON error responses
* Static file serving & caching (public/)
* Compression (gzip)
* Optional entrypoint (src/index.ts)
* Optional 404 page (pages/404.ts)
* Route file generator via CLI (bun gen)

```ts
import { Data, Route, html } from "gateway";

export default class implements Route {
	async data(req: Request) {
		const form = await Route.formData(req);
		return {
			time: new Date(Date.now()).toLocaleString(),
			name: form?.get("name") || "world",
			_secret: "yes", // hidden in JSON responses
		};
	}

	head(data: Data<this>) {
		return html`
			<title>Hello ${data.name}!</title>
		`;
	}

	body(data: Data<this>) {
		return html`
			<h1>Hello ${data.name} at ${data.time}!</h1>
			<form method="post">
				<label for="name">Name</label>
				<input type="text" id="name" name="name" autofocus required>
				<input type="submit" value="Submit" />
			</form>
		`;
	}
};
```

## Soon...
- [ ] Authentication
- [ ] Middleware

## To install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

## To create a project:

```bash
bun create redraskal/gateway-template {dir}
```

This project was created using `bun init` in bun v0.6.13. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
