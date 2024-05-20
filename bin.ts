import { $ } from "bun";

const arg = Bun.argv[2];

if (arg == "dev") {
	while (true) {
		const { exitCode } = await $`GATEWAY_ENV=dev bun --hot node_modules/gateway/src/index.ts`;
		if (exitCode != 8) {
			break;
		}
	}
} else if (arg == "gen") {
	await $`GATEWAY_GEN="${Bun.argv[3]}" bun node_modules/gateway/src/index.ts`;
} else if (arg == "build") {
	await $`GATEWAY_BUILD="${Bun.argv[3]}" bun node_modules/gateway/src/index.ts`;
} else {
	await $`bun node_modules/gateway/src/index.ts`;
}
