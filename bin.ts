#!/usr/bin/env bun
import { $, spawn } from "bun";
import { platform, availableParallelism } from "os";

const arg = Bun.argv[2] || "";
const cluster = platform() == "linux" && (arg.length == 0 || arg == "start");

if (arg == "dev") {
	while (true) {
		const { exitCode } = await $`GATEWAY_ENV=dev bun --hot node_modules/gateway/src/index.ts`.nothrow();
		if (exitCode != 8) {
			break;
		}
	}
} else if (arg == "gen") {
	await $`GATEWAY_GEN="${Bun.argv[3]}" bun node_modules/gateway/src/index.ts`.nothrow();
} else if (arg == "build") {
	await $`GATEWAY_BUILD="${Bun.argv[3]}" bun node_modules/gateway/src/index.ts`.nothrow();
} else {
	if (cluster) {
		const cpus = availableParallelism();
		const procs = new Array(cpus);

		for (let i = 0; i < cpus; i++) {
			procs[i] = spawn({
				cmd: ["bun", "node_modules/gateway/src/index.ts"],
				stdout: "inherit",
				stderr: "inherit",
				stdin: "inherit",
			});
		}

		function kill() {
			for (const proc of procs) {
				proc.kill();
			}
		}

		process.on("SIGINT", kill);
		process.on("exit", kill);
	} else {
		await $`bun node_modules/gateway/src/index.ts`.nothrow();
	}
}
