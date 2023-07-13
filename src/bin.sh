#!/usr/bin/env bash
if [[ "$1" == "dev" ]]; then
	GATEWAY_ENV=dev bun --hot node_modules/gateway/src/index.ts
elif [[ "$1" == "gen" ]]; then
	GATEWAY_GEN=$2 bun node_modules/gateway/src/index.ts
else
	bun node_modules/gateway/src/index.ts
fi
