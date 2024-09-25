#!/usr/bin/env bun
import { $ } from "bun";

const arg = Bun.argv[2] || "";

if (arg == "dev") {
	while (true) {
		const { exitCode } = await $`GATEWAY_ENV=dev bun --hot node_modules/gateway/src/index.ts`.nothrow();

		if (exitCode != 8) {
			break;
		}
	}
} else {
	if (arg == "gen" || arg == "build") {
		Bun.env[arg == "gen" ? "GATEWAY_GEN" : "GATEWAY_BUILD"] = Bun.argv[3];
	}

	// @ts-ignore
	await import("index.ts");
}
