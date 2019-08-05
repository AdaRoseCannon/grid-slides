import GridSlidesController from './grid-slides-controller.js';
import HTMLElementPlus from 'https://unpkg.com/html-element-plus/html-element-plus.js';
import html from 'https://unpkg.com/html-element-plus/noop.js';

const defaultAttributes = new Map();

class GridSlide extends HTMLElementPlus {
	constructor() {
		super();

		this.__data = [];

		this.attachShadow({mode: 'open'});
		this.__buildDom();
	}

	static get templateHTML() {
		return html`
			<style>
				.play-button {
					color: green;
					font-size: 1.5em;
					position: absolute;
					top: 0;
					right: 0;
					display: var(--button-display, block);
					grid-area: 1/full;
					z-index: 100;
				}
			</style>
			<button class="play-button grid-slide" style="display: none;" title="Play" ref="play">►</button>
			<slot></slot>
		`;
	}

	static setDefaultAttribute(name, val) {
		defaultAttributes.set(name, val);
	}

	allAttributesChangedCallback() {
		if (this.firstSetup) return;
		if (!this.__data) return;
		this.firstSetup = true;

		for (const [name, value] of defaultAttributes.entries()) {
			if (!this.hasAttribute(name)) this.setAttribute(name, value); 
		}

		this.setup();
		this.run();
	}

	__buildDom() {
		const template = this['slide-template'] || this.parentNode['slide-template'];
		this.shadowRoot.innerHTML = '';
		this.shadowRoot.appendChild(template ? document.importNode(template.content, true) : this.templateContent);
		this.refs.play.addEventListener('click', function () {
			if (!this.__isSetup) {
				this.setup();
			}
			
			this.run();
			
			if (this.__complete) {
				return this.reset();
			}
		}.bind(this));
	}

	static parseAttribute(string) {
		const out = {};
		const l = string.split(';').map(p => p.split(':'));
		l.forEach(p => p[0] && (out[p[0].trim()] = p[1].trim()));
		return out;
	}
	
	update(attr, newValue) {
		const attrs = Array.from(this.attributes)
		.filter(a => GridSlidesController.slideData.has(a.name))
		.map(a => a.name);
		if (GridSlidesController.slideData.has(attr)) {
			// Forces order of attributes
			const datum = GridSlidesController.getSlideData(attr, this, GridSlide.parseAttribute(newValue || ''));
			this.__data[attrs.indexOf(attr)] = datum;
			if (datum.init) datum.init.apply(this, []);
			this.refs.play.style.display = '';
		}
	}
	
	reset() {
		this.teardown();
		this.setup();
		this.run(true);
	}
	
	setup() {
		const actions = [];
		for (const datum of this.__data) {
			if (datum.setup) datum.setup.bind(this)(datum.data);
			if (datum.action) actions.push(datum.action.bind(this)(datum.data));
		}
		this.__actions = (function *() {
			for (const action of actions) {
				yield* action;
			}
			yield;
		}());
		this.__isSetup = true;
		this.__dirty = false;
		this.__complete = false;
	}
	
	teardown() {
		this.__isSetup = false;
		for (const datum of this.__data) {
			if (datum.teardown) datum.teardown.bind(this)(datum.data);
		}
	}
	
	run(noDirty) {
		if (!this.__isSetup) {
			throw Error('Cannot run, Not setup', this);
		}
		const result = this.__actions.next();
		if (noDirty !== true) this.__dirty = true;
		if (result.done) {
			this.emitEvent(this.parentNode.constants.events.finished);
			this.__complete = true;
		}
	}
	
	static get observedAttributes() {
		return ['pending', 'active', 'data', 'transition-in', 'transition-out', 'teardown-pending', 'slide-template'].concat(Array.from(GridSlidesController.slideData.keys()));
	}
	
	attributeChangedCallback(attr, oldValue, newValue) {
		
		if (attr === 'active') {
			if (newValue === null) {
				if (!this.hasAttribute('teardown-pending')) this.teardown();
				return;
			}
			if (!this.__isSetup || this.__dirty) {
				this.teardown();
				this.setup();
			}
			this.run(true);
		}

		if (attr === 'teardown-pending') {
			if (newValue === null) {
				this.teardown();
			}
		}
		
		if (attr === 'pending') {

			if (!this.hasAttribute('pending')) return;

			if (newValue !== null) {

				// pending added so reset state
				this.teardown();
				this.setup();
			} else {

				// pending removed so teardown unless it is removed because it is now active
				if (this.getAttribute('active') === null) {
					this.teardown();
				}
			}
		}

		if (attr === 'transition-in') {
			this.transitionIn = GridSlidesController.transitions.get(newValue);
		}

		if (attr === 'transition-out') {
			this.transitionOut = GridSlidesController.transitions.get(newValue);
		}

		if (attr === 'slide-template') {
			this['slide-template'] = newValue === 'default' ? false : document.querySelector(newValue);
			this.__buildDom();
		}

		if (GridSlidesController.slideData.has(attr)) {
			this.update(attr, newValue);
		}

		super.attributeChangedCallback(attr, oldValue, newValue);
	}
}

export default GridSlide;