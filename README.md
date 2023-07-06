# Gateway

**This is a work in progress. The API is subject to change until a stable version is released.**

## Features:

* Server-side rendered HTML (SSR)
* [Next.js-style filesystem router](https://bun.sh/docs/api/file-system-router) (pages/)
* Class-based routes
* Automatic JSON responses on all routes
* Automatic JSON error responses
* Static file serving & caching (public/)
* Optional entrypoint (src/index.ts)
* Optional 404 page (404.ts)
* Route file generator via CLI (bun gen)

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
