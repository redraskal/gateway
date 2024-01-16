import { Server } from "bun";
export { default as html } from "./html";
export type { HTMLTemplateString } from "./html";
export * from "./route";
export * from "./error";
export * from "./ws";
export * from "./decorators";

declare global {
	var server: Server;
}
