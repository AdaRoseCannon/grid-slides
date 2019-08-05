import "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/9.12.0/highlight.min.js";
import HTMLElementPlus from 'https://unpkg.com/html-element-plus/html-element-plus.js';
import html from 'https://unpkg.com/html-element-plus@1.1.0/noop.js';

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

	update() {
		requestAnimationFrame(function updateHTML(count) {
			if (count === undefined) count = 0;
			count++;
			if (count === 10) return;
			let script = this.querySelector('script,template');
			let detectedLang = 'html';
			if (!script) {
				return requestAnimationFrame(() => updateHTML.bind(this)(count));
			}
			if (script.tagName === 'TEMPLATE' && script.innerHTML === '') {
				return requestAnimationFrame(() => updateHTML.bind(this)(count));
			}
			if (!this.lang && script.tagName === 'TEMPLATE' && script.content.firstElementChild.tagName === 'SCRIPT') {
				script = script.content.firstElementChild;
				detectedLang = script.getAttribute('type') || 'javascript';
			}
			if (!this.lang && script.tagName === 'TEMPLATE' && script.content.firstElementChild.tagName === 'STYLE') {
				script = script.content.firstElementChild;
				detectedLang = 'css';
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
				this.refs.code.innerHTML = window.hljs.highlight(this.lang || detectedLang, str).value;
			} else {
				this.refs.code.textContent = str;
			}
		}.bind(this));
	}

	allAttributesChangedCallback() {
		if (!this.shadowRoot) {
			this.attachShadow({mode: 'open'});
			this.shadowRoot.appendChild(this.templateContent);
			this.update();
		}
	}

	static defaultAttributeValue (name) {
		if (name === 'lang') return null;
	}

	static get observedAttributes() {
		return ['lang'];
	}
}

customElements.define('html-encode', HTMLEncode);
export default HTMLEncode;