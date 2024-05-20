import type { Server } from "bun";
export { html, meta } from "./html";
export * from "./route";
export * from "./error";
export * from "./ws";
export * from "./decorators";

declare global {
	var server: Server;
}
