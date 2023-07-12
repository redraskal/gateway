import { Route } from "./route";

export type WebSocketContext = {
	readonly headers: Headers;
	readonly route: Route;
	readonly pathname: string;
};
