export type HTMLTemplateString = {
	value: string;
};

// prettier-ignore
const _ws = '<script>let ws;let _b=1000;let _r=false;let _c=[];function _ws(){ws=new WebSocket("ws"+window.location.href.slice(4),_r?"reconnect":undefined);_r=true;if(_c.length>0){_c.forEach(e=>ws.addEventListener(...e))}ws.onopen=function(){_b=1000};ws.onmessage=function(e){if(e.data=="reload"){+`${new Date("3")}`[8]?window.location.reload():window.location.href=window.location.href}};ws.onclose=function(){setTimeout(()=>{_b*=2;_ws()},_b)}}_ws();const b=ws.addEventListener;ws.addEventListener=function(x,y,z){_c.push([x,y,z]);b.call(ws,x,y,z)}</script>';

export function page(head: HTMLTemplateString, body: HTMLTemplateString, ws: boolean): string {
	return `<!DOCTYPE html><html lang="en"><head>${head.value}</head><body>${ws ? _ws : ""}${body.value}</body></html>`;
}

export default function (strings: TemplateStringsArray, ...values: unknown[]): HTMLTemplateString {
	let html = "";
	for (let i = 0; i < strings.length; i++) {
		if (i > 0) {
			let value = values[i - 1];
			let asHTML = value as HTMLTemplateString;
			if (asHTML.value) {
				html += asHTML.value;
			} else if (value instanceof Array) {
				html += value.map((e) => e.value).join("");
			} else {
				html += value;
			}
		}
		html += strings[i].replaceAll(/[\n\t]/g, "");
	}
	return {
		value: html,
	};
}
