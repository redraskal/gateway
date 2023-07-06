import { Route, html } from "gateway";

export default class implements Route {
	body() {
		return html`
			<h1>404 not found</h1>
		`;
	}
};
