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
			let value = values[i - 1];
			let asHTML = value as HTMLTemplateString;
			if (asHTML.value) {
				html += asHTML.value;
			} else {
				html += value;
			}
		}
		html += strings[i].replaceAll(/[\n\t]/g, "");
	}
	return {
		value: html,
	};
};
