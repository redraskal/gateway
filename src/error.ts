import { ZodError } from "zod";

export class ZodErrorWithMessage extends ZodError {
	get message(): string {
		return this.issues.map((issue) => issue.message).join(", ");
	}
}

export class RouteError extends Error {
	readonly redirect?: string;

	constructor(message: string, redirect?: string) {
		super(message);
		this.redirect = redirect;
		this.name = "RouteError";
	}
}
