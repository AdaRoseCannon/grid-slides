/* global Vivus, customElements */

import 'https://cdnjs.cloudflare.com/ajax/libs/vivus/0.4.4/vivus.min.js';
import HTMLElementPlus from 'https://unpkg.com/html-element-plus/html-element-plus.js';

class VivusSVG extends HTMLElementPlus {
    constructor () {
        super();
    }

	static get observedAttributes() {
		return ['src', 'width', 'height', 'type', 'reverse', 'duration'];
    }
    
    connectedCallback() {
        if (!this.vivus.isReady) return;
        if (this.id) console.log(this.id, 'playing');
        this.vivus.reset();
        this.vivus.play();
    }

	allAttributesChangedCallback(attrs) {
		if (!this.shadowRoot) {
            this.attachShadow({mode: 'open'});
            const div = document.createElement('div');
            if (attrs.width) div.style.width = attrs.width;
            if (attrs.height) div.style.height = attrs.height;
            this.shadowRoot.appendChild(div);
            this.vivus = new Vivus(div, {
                duration: Number(attrs.duration) || 200,
                // start: 'manual',
                type: attrs.type || 'oneByOne',
                file: attrs.src,
                reverseStack: attrs.reverse && attrs.reverse !== "false"
            });
		}
	}
}

customElements.define('vivus-svg', VivusSVG);

