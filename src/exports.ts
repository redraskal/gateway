import { ZodError } from "zod";

export { default as html } from "./html";
export * from "./route";

export class ZodErrorWithMessage extends ZodError {
	get message(): string {
		return this.issues.map(issue => issue.message).join(", ");
	}
};
