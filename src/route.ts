import { MatchedRoute } from "bun";
import { HTMLTemplateString } from "./html";
import { z } from "zod";

export type Resolved<T> = T extends Promise<infer R> ? R : T;
// @ts-ignore
export type Data<T extends Route> = Resolved<ReturnType<T["data"]>>;
export type RouteResponse = HTMLTemplateString | Response;

export interface Route {
	data?(req: Request, route: MatchedRoute): any;
	head?<T extends Route>(data: Data<T>, err?: Error): HTMLTemplateString;
	body?<T extends Route>(data: Data<T>, err?: Error): RouteResponse;
};

const acceptedJSONMethods = ["POST", "PUT", "PATCH", "DELETE"];

export class Route {
	/**
	 * Read the body from the Request as a {@link FormData} object.
	 *
	 * This first decodes the data from UTF-8, then parses it as a
	 * `multipart/form-data` body or a `application/x-www-form-urlencoded` body.
	 *
	 * @param req Request
	 * @returns Promise<FormData> - The body of the request as a {@link FormData}.
	 */
	static async formData(req: Request) {
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
	static async json<T>(req: Request) {
		if (req.headers.get("accept") == "application/json" && acceptedJSONMethods.includes(req.method)) {
			return await req.json<T>();
		}
		return null;
	}

	/**
	 * Read the body from the Request into a JSON object.
	 * 
	 * This supports JSON bodies and FormData.
	 * 
	 * @param req Request
	 * @returns Promise<T> - JSON object
	 */
	static async body<T>(req: Request) {
		const formData = await this.formData(req);
		if (formData) {
			return Array.from(formData.entries())
				.reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}) as T;
		}
		return await this.json<T>(req);
	}

	/**
	 * Read the body from the Request and parse using zod.
	 * 
	 * This supports JSON bodies and FormData.
	 * 
	 * @param req Request
	 * @returns Promise<T> - JSON object
	 */
	static async zod<T>(req: Request, schema: z.ZodType<T>) {
		const data = await this.body(req);
		if (data) {
			return await schema.parseAsync(data);
		} else {
			return null;
		}
	}
};
