import path from "node:path";
import { readdir } from "node:fs/promises";

export async function* walk(
	directory: string,
	extensions: string[]
): AsyncGenerator<string> {
	// TODO: Use opendir, see https://bun.sh/docs/runtime/nodejs-apis#node_fs
	for await (const child of await readdir(directory, { withFileTypes: true })) {
		const joined = path.join(directory, child.name);
		if (child.isDirectory()) {
			yield* walk(joined, extensions);
		} else if (extensions.includes(joined.split(".").pop()!)) {
			yield joined;
		}
	}
}

export function parseBoolean(s: string | undefined): boolean {
	return s ? s.toLowerCase() == "true" || s == "1" ? true : false : false;
}
