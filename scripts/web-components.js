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

	static get templateHTML() {
		return html`<style>
			:host pre {
				background-color: #333;
				color: white;
				padding: 0.5em;
			}
		</style><pre><code ref="code"><slot></slot></code></pre>`;
	}

	static get template() {
		if (this.__templateEl) return document.importNode(this.__templateEl.content,true);
		this.__templateEl = document.createElement('template');
		this.__templateEl.innerHTML = this.templateHTML;
		if (window.ShadyCSS) window.ShadyCSS.prepareTemplate(this.__templateEl, 'html-encode');
		return document.importNode(this.__templateEl.content, true);
	}

	allAttributesChangedCallback(data) {
		if (!this.shadowRoot) {
			this.attachShadow({mode: 'open'});
			this.shadowRoot.appendChild(this.constructor.template);
			requestAnimationFrame(function updateHTML() {
				if (!this.firstElementChild) {
					return requestAnimationFrame(updateHTML);
				}
				const a = this.firstElementChild.innerHTML;
				const ws = a.split('\n');
				const firstLine = ws[1] || ws[0];
				let len = (firstLine.match(/\s+/) || [''])[0].length;
				if (ws.slice(1,-1).length) ws.slice(1,-1).reduce((a,b) => {
					len = similarStart(a,b,len);
					return (a || '').slice(0, len);
				});
				if (ws[0].match(/^\s*$/)) {
					ws.splice(0,1);
				}
				const str = ws.map(a => a.slice(len)).join('\n');
				if (window.hljs) {
					this.innerHTML = window.hljs.highlight(data.lang, str).value;
				} else {
					this.textContent = str;
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