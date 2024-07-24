import { join } from "path";
import { readdir, mkdir } from "fs/promises";

export async function* walk(directory: string, extensions: string[]): AsyncGenerator<string> {
	for await (const child of await readdir(directory, { withFileTypes: true })) {
		const joined = join(directory, child.name);

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

export async function openInEditor(path: string) {
	await Bun.spawn(["code", "-r", path]).exited;
}

export async function generateFile(name: string) {
	const filePath = join("pages", name.endsWith(".ts") ? name : `${name}.ts`);
	const folderPath = filePath.split("/").slice(0, -1).join("/");

	await mkdir(folderPath, { recursive: true });

	const file = Bun.file(filePath);

	if (await file.exists()) {
		console.error(`❌ ${file.name} already exists.`);
		return false;
	}

	const input = Bun.file(join(import.meta.dir, "../gen/route.ts"));
	await Bun.write(file, await input.text());

	console.log(`📝 ${file.name} created.`);

	await openInEditor(filePath);

	return true;
}
