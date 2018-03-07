/* eslint-env es6 */
/* global HTMLElementPlus */
'use strict';

const html = a => a;

function similarStart(a,b,l) {
	if (!a || !b) return 0;
	for (let i=0;i<l;i++) {
		if (i===a.length) return i;
		if (i===b.length) return i;
		if (!a[i].match(/\s/)) return i;
		if (!b[i].match(/\s/)) return i;
		if (a[i] !== b[i]) {
			return i;
		}
	}
	return l;
}

class HTMLEncode extends HTMLElementPlus {
	constructor () {
		super();
	}

	// Set the HTML for the template
	static get templateHTML() {
		return html`<style>
			:host pre {
				background-color: #333;
				color: white;
				padding: 0.5em;
				margin: 0;
				display: inline-block;
				width: 100%;
				tab-size: 2;
				-moz-tab-size: 2;
				-webkit-tab-size: 2;
			}
		</style>
		<link href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/styles/monokai.min.css" rel="stylesheet" >
		<slot></slot><pre><code ref="code"></code></pre>`;
	}

	allAttributesChangedCallback(data) {
		if (!this.shadowRoot) {
			this.attachShadow({mode: 'open'});
			this.shadowRoot.appendChild(this.template);
			requestAnimationFrame(function updateHTML(count) {
				if (count === undefined) count = 0;
				count++;
				if (count === 10) return;
				let script = this.querySelector('script,template');
				if (!script) {
					return requestAnimationFrame(() => updateHTML.bind(this)(count));
				}
				if (script.tagName === 'TEMPLATE' && script.innerHTML === '') {
					return requestAnimationFrame(() => updateHTML.bind(this)(count));
				}
				if (script.tagName === 'TEMPLATE' && script.content.firstElementChild.tagName === 'SCRIPT') {
					script = script.content.firstElementChild;
				}
				if (script.tagName === 'TEMPLATE' && script.content.firstElementChild.tagName === 'STYLE') {
					script = script.content.firstElementChild;
				}
				const a = script.innerHTML;
				const ws = a.split('\n');
				const firstLine = ws[1] || ws[0];
				let len = (firstLine.match(/\s+/) || [''])[0].length;
				if (ws.slice(1,-1).length) ws.slice(1,-1).reduce((a,b) => {
					if (a === '' || b === '') return a;
					len = similarStart(a,b,len);
					return (a || '').slice(0, len);
				});
				if (ws[0].match(/^\s*$/)) {
					ws.splice(0,1);
				}
				const str = ws.map(a => a.slice(len)).join('\n');
				if (window.hljs) {
					this.refs.code.innerHTML = window.hljs.highlight(data.lang, str).value;
				} else {
					this.refs.code.textContent = str;
				}
			}.bind(this));
		}
	}

	static defaultAttributeValue (name) {
		if (name === 'lang') return 'html';
	}

	static get observedAttributes() {
		return ['lang'];
	}
}

customElements.define('html-encode', HTMLEncode);