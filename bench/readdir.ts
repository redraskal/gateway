import { bench, group, run } from "mitata";
import { walk } from "../src/utils";
import { readdir } from "fs/promises";

group("readdir with file extension filters", () => {
	bench("gateway async generator", () => walk("./src", ["ts"]));
	bench("bun readdir", async () => {
		(await readdir("./src", { recursive: true })).filter((file) => file.endsWith(".ts"));
	});
});

await run();
