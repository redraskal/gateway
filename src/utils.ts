import path from "node:path";
import { readdir } from "node:fs/promises";
import { existsSync, mkdirSync } from "fs";

export async function* walk(directory: string, extensions: string[]): AsyncGenerator<string> {
	for await (const child of await readdir(directory, { withFileTypes: true })) {
		const joined = path.join(directory, child.name);

		if (child.isDirectory()) {
			yield* walk(joined, extensions);
		} else if (extensions.includes(joined.split(".").pop()!)) {
			yield joined;
		}
	}
}

export function parseBoolean(s: string): boolean {
	return s.toLowerCase() == "true" || s == "1" ? true : false;
}

export function openVSCode(filePath: string) {
	Bun.spawn(["code", "-r", filePath]);
}

export async function generateFile(name: string) {
	const filePath = path.join("pages", name.endsWith(".ts") ? name : `${name}.ts`);
	const folderPath = filePath.split("/").slice(0, -1).join("/");

	if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });

	const file = Bun.file(filePath);

	if (await file.exists()) {
		console.error(`❌ ${file.name} already exists.`);
		return false;
	}

	const input = Bun.file(path.join(import.meta.dir, "../gen/route.ts"));
	await Bun.write(file, await input.text());

	console.log(`📝 ${file.name} created.`);

	openVSCode(filePath);

	return true;
}
