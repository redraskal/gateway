import { MatchedRoute } from "bun";
import { HTMLTemplateString } from "./html";

export type Resolved<T> = T extends Promise<infer R> ? R : T;
// @ts-ignore
export type Data<T extends Route> = Resolved<ReturnType<T["data"]>>;

export interface Route {
	data?(req: Request, route: MatchedRoute): any;
	head?<T extends Route>(data: Data<T>, err?: Error): HTMLTemplateString;
	body?<T extends Route>(data: Data<T>, err?: Error): HTMLTemplateString;
};

export class Route {
	static async form(req: Request) {
		if (req.method == "POST") {
			return await req.formData();
		}
		return null;
	}
};
