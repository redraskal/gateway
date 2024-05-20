import type { MatchedRoute, ServerWebSocket } from "bun";
import { z } from "zod";
import type { WebSocketContext } from "./ws";

export type Resolved<T> = T extends Promise<infer R> ? R : T;
// @ts-ignore
export type Data<T extends Route> = Resolved<ReturnType<T["data"]>>;
export type RouteResponse = string | Response;

export interface RouteWebSocket {
	open?: (ws: ServerWebSocket<WebSocketContext>) => void | Promise<void>;
	message?: (ws: ServerWebSocket<WebSocketContext>, message: string | Uint8Array) => void | Promise<void>;
	close?: (ws: ServerWebSocket<WebSocketContext>, code: number, message: string) => void | Promise<void>;
}

export interface Route {
	data?(req: Request, route: MatchedRoute): any;
	ws?(): RouteWebSocket;
	head?<T extends Route>(data: Data<T>, err?: Error): string;
	body?<T extends Route>(data: Data<T>, err?: Error): RouteResponse;
}

const acceptedJSONMethods = ["POST", "PUT", "PATCH", "DELETE"];

export class Route {}

/**
 * Read the body from the Request as a {@link FormData} object.
 *
 * This first decodes the data from UTF-8, then parses it as a
 * `multipart/form-data` body or a `application/x-www-form-urlencoded` body.
 *
 * @param req Request
 * @returns Promise<FormData> - The body of the request as a {@link FormData}.
 */
export async function formData(req: Request) {
	if (req.method == "POST") {
		return await req.formData();
	}

	return null;
}

/**
 * Read the body from the Request as a JSON object.
 *
 * @param req Request
 * @returns Promise<T> - JSON object
 */
export async function json<T>(req: Request) {
	if (req.headers.get("accept") == "application/json" && acceptedJSONMethods.includes(req.method)) {
		return await req.json<T>();
	}

	return null;
}

/**
 * Parses the body from the Request into a JSON object.
 *
 * This method supports JSON bodies and FormData.
 *
 * @param req Request
 * @returns Promise<T> - JSON object
 */
export async function parse<T>(req: Request) {
	const data = await formData(req);
	if (data) {
		return Array.from(data.entries()).reduce(
			(obj, [key, value]) => ({
				...obj,
				// @ts-ignore
				[key]: obj[key] ? (obj[key] instanceof Array ? [...obj[key], value] : [obj[key], value]) : value,
			}),
			{} as T
		);
	}
	return await json<T>(req);
}

/**
 * Read the body from the Request and parse using zod.
 *
 * This supports JSON bodies and FormData.
 *
 * @param req Request
 * @returns Promise<T> - JSON object
 */
export async function zod<T>(req: Request, schema: z.ZodType<T>) {
	const data = await parse(req);

	if (data) {
		return await schema.parseAsync(data);
	}

	return null;
}
