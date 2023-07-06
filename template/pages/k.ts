import { MatchedRoute } from "bun";
import { Data, Route, html } from "gateway";

export default class implements Route {
	async data(req: Request, route: MatchedRoute) {
		return {
			time: new Date(Date.now()).toLocaleString(),
		};
	}

	head(data: Data<this>, err?: Error) {
		return html`
			<title>Hello world!</title>
		`;
	}

	body(data: Data<this>, err?: Error) {
		return html`
			<h1>Hello world!</h1>
		`;
	}
};
