export type MetaParams = {
	title: string;
	description?: string | null | undefined;
	imageURL?: string | null | undefined;
	omitDefaultTags?: boolean; // omit UTF-8 & viewport tags
};

const defaultTags = html`
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
`;

// prettier-ignore
const _ws = '<script>let ws;let _b=1000;let _r=false;let _c=[];function _ws(){ws=new WebSocket("ws"+window.location.href.slice(4),_r?"reconnect":undefined);_r=true;if(_c.length>0){_c.forEach(e=>ws.addEventListener(...e))}ws.onopen=function(){_b=1000};ws.onmessage=function(e){if(e.data=="reload"){+`${new Date("3")}`[8]?window.location.reload():window.location.href=window.location.href}};ws.onclose=function(){setTimeout(()=>{_b*=2;_ws()},_b)}}_ws();const b=ws.addEventListener;ws.addEventListener=function(x,y,z){_c.push([x,y,z]);b.call(ws,x,y,z)}</script>';

export function page(head: string, body: string, ws: boolean): string {
	return `<!DOCTYPE html><html lang="en"><head>${head}</head><body>${ws ? _ws : ""}${body}</body></html>`;
}

export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
	let html = "";
	for (let i = 0; i < strings.length; i++) {
		if (i > 0) {
			let value = values[i - 1];
			if (value == null || value == undefined || value === false) value = "";

			if (value instanceof Array) {
				html += value.join("");
			} else {
				html += value;
			}
		}

		html += strings[i];
	}

	return html;
}

export function meta(params: MetaParams) {
	const description = params.description || "";
	const imageURL = params.imageURL || "";

	return html`
		${!params.omitDefaultTags ? defaultTags : ""}
		<title>${params.title}</title>
		<meta name="title" content="${params.title}" />
		${description &&
		html`
			<meta name="description" content="${description}" />
			<meta property="og:description" content="${description}" />
			<meta property="twitter:description" content="${description}" />
		`}
		<meta property="og:type" content="website" />
		<meta property="og:title" content="${params.title}" />
		<meta property="twitter:card" content="${imageURL ? "summary_large_image" : "summary"}" />
		<meta property="twitter:title" content="${params.title}" />
		${imageURL &&
		html`
			<meta property="og:image" content="${imageURL}" />
			<meta property="twitter:image" content="${imageURL}" />
		`}
	`;
}
