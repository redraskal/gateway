export type HTMLTemplateString = {
	value: string;
};

export function page(head: HTMLTemplateString, body: HTMLTemplateString): string {
	return `<!DOCTYPE html><html lang="en"><head>${head.value}</head><body>${body.value}</body></html>`;
}

export default function (strings: TemplateStringsArray, ...values: unknown[]): HTMLTemplateString {
	let html = "";
	for (let i = 0; i < strings.length; i++) {
		if (i > 0) {
			html += values[i - 1];
		}
		html += strings[i].replaceAll(/[\n\t]/g, "");
	}
	return {
		value: html,
	};
};
