#!/usr/bin/env bash
if [[ "$1" == "dev" ]]; then
	while true; do
		GATEWAY_ENV=dev bun --hot node_modules/gateway/src/index.ts
		exit_code=$?
		if [ $exit_code -ne 8 ]; then
			exit
		fi
	done
elif [[ "$1" == "gen" ]]; then
	GATEWAY_GEN=$2 bun node_modules/gateway/src/index.ts
else
	bun node_modules/gateway/src/index.ts
fi
