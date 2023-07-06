#!/usr/bin/env bash
if [[ "$1" == "dev" ]]; then
	GATEWAY_ENV=dev bun --watch node_modules/gateway/src/index.ts
else
	bun node_modules/gateway/src/index.ts
fi
