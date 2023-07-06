import { MatchedRoute } from "bun";
import { HTMLTemplateString } from "./html";

export type RouteResponse = Response | HTMLTemplateString | string | void;
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

// export function response(res: RouteResponse): Response {
// 	if (res instanceof Response) {
// 		return res;
// 	}
// 	const parsed = res as HTMLTemplateString;
// 	if (parsed.html) {
// 		console.log("is html");
// 	} else {
// 		console.log("isn't html");
// 	}
// 	console.log(res);
// 	return Response.error();
// }
