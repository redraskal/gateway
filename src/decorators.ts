import { HTMLTemplateString } from "./html";
import { Route, RouteResponse } from "./route";

export function cache(component?: "head" | "body") {
	return function cache<T extends { new (...args: any[]): Route }>(constructor: T) {
		return class extends constructor {
			constructor(...args: any[]) {
				super(...args);

				// TODO: this.data() support?
				let head: HTMLTemplateString, body: RouteResponse;

				if (this.head && (!component || component == "head")) {
					head = this.head({});
					this.head = () => head;
				}

				if (this.body && (!component || component == "body")) {
					body = this.body({});
					this.body = () => body;
				}
			}
		};
	};
}
