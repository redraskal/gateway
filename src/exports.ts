import { Server } from "bun";
export { default as html } from "./html";
export type { HTMLTemplateString } from "./html";
export * from "./route";
export * from "./error";
export * from "./ws";

declare global {
	var server: Server;
}
