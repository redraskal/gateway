import { Server } from "bun";
export { default as html } from "./html";
export type { HTMLTemplateString } from "./html";
export * from "./route";
export * from "./error";
export * from "./ws";

export function server(): Server {
	return globalThis.server;
}
