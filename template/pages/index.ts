import { Data, Route, html } from "gateway";

export default class implements Route {
	data() {
		return {
			time: new Date(Date.now()).toLocaleString(),
			_secret: "yes",
		};
	}

	head() {
		return html`
			<title>Hello!</title>
			<link rel="stylesheet" href="/css/form.css" />
		`;
	}

	body(data: Data<this>) {
		return html`
			<h1>Hello world at ${data.time}!</h1>
			<form method="post">
				<input type="submit" value="Refresh" />
			</form>
		`;
	}
};
