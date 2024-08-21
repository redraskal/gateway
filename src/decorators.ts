import { page } from "./html";
import { Route, type RouteResponse } from "./route";

export function cache(component?: "head" | "body") {
	return function cache<T extends { new (...args: any[]): Route }>(constructor: T) {
		return class extends constructor {
			constructor(...args: any[]) {
				super(...args);

				(async () => {
					let data;
					let err: Error | undefined = undefined;

					try {
						// @ts-ignore
						data = this.data && !component ? await this.data(null, null) : null;
					} catch (e) {
						console.error(e);
						err = e as Error;
					}

					// TODO: this.data() support?
					let head: string, body: RouteResponse;

					if (this.head && (!component || component == "head")) {
						head = this.head(data, err);
						this.head = () => head;
					}

					if (this.body && (!component || component == "body")) {
						body = this.body(data, err);
						this.body = () => body;
					}

					if (!component) {
						// @ts-ignore
						this.cached = page(head || "", body, this.ws != undefined);
					}
				})();
			}
		};
	};
}
