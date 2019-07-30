/* global Vivus, customElements */

import 'https://cdnjs.cloudflare.com/ajax/libs/vivus/0.4.4/vivus.min.js';
import HTMLElementPlus from 'https://unpkg.com/html-element-plus/html-element-plus.js';

class VivusSVG extends HTMLElementPlus {
    constructor () {
        super();
    }

	static get observedAttributes() { // type = delayed|oneByOne|sync
		return ['src', 'width', 'height', 'type', 'reverse', 'duration', 'autoplay'];
    }
    
    connectedCallback() {
        if (!this.vivus.isReady) return;
        if (this.id) console.log(this.id, 'playing');
        const svg = this.shadowRoot.querySelector('svg');
        if (svg) svg.classList.remove('finished');
        this.vivus.reset();
        this.vivus.stop();
        if (this.getAttribute('autoplay') !== 'false') this.vivus.play();
    }

	allAttributesChangedCallback(attrs) {
		if (!this.shadowRoot) {
            this.attachShadow({mode: 'open'});
            this.shadowRoot.innerHTML = `
                <style>
                    svg:not(.finished) * {
                        fill-opacity: 0;
                    }
                    svg * {
                        transition: fill-opacity 1s;
                    }
                </style>
            `;
            const div = document.createElement('div');
            div.style.width = attrs.width || '100%';
            div.style.height = attrs.height || '100%';
            this.shadowRoot.appendChild(div);
            this.vivus = new Vivus(div, {
                duration: Number(attrs.duration) || 200,
                // start: 'manual',
                type: attrs.type || 'oneByOne',
                file: attrs.src,
                reverseStack: attrs.reverse && attrs.reverse !== "false"
            }, function (obj) {
                obj.el.classList.add('finished');
            });
		}
	}
}

export default VivusSVG;
customElements.define('vivus-svg', VivusSVG);

