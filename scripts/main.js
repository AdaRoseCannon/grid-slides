/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const containerTemplate = document.createElement('template');
const slideTemplate = document.createElement('template');

containerTemplate.innerHTML = `
	<style>
		.slide-controls {
			grid-column: slide;
			margin-bottom: var(--padding);
			justify-content: center;
			display: var(--button-display, flex);
		}
	</style>
	<div class="slide-controls grid-slides-controller">
		<button class="start-button grid-slides-controller" ref="start">Start Presentation</button>
	</div>
	<slot></slot>
`;

slideTemplate.innerHTML = `
	<style class="grid-slide">
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
	<slot></slot>
	<button class="play-button grid-slide" style="display: none;" title="Play" ref="play">►</button>
`;


// only polyfill .finished in browsers that already support animate()
if (Element.prototype.animate) {

	// Chrome does not seem to expose the Animation constructor globally
	if (typeof Animation === 'undefined') {
		window.Animation = Element.prototype.animate;
	}

	if (Animation.prototype.finished === undefined) {
		Object.defineProperty(Animation.prototype, 'finished', {
			get() {
				if (!this._finished) {
				this._finished = this.playState === 'finished' ? 
					Promise.resolve() :
					new Promise((resolve, reject) => {
						this.addEventListener('finish', resolve, {once: true});
						this.addEventListener('cancel', reject, {once: true});
					});
				}
				return this._finished;
			}
		});
	}
}

function processSchema(schema, data, el) {
	let out = {};
	if (schema.type !== undefined || schema.default !== undefined) {
		const type = schema.type || typeof schema.default;
		if (data === undefined && schema.default !== undefined) {
			return schema.default;
		}
		if (type === "number") return Number(data);
		if (type === "string") return String(data);
		if (type === "boolean") return data === "true";
		if (type === "selector") return el.querySelector(data);
		if (type === "selectorAll") return el.querySelectorAll(data);
	} else {
		for (const key of Object.keys(schema)) {
			if (typeof schema[key] === 'object') {
				out[key] = processSchema(schema[key], data[key], el);
			}
		}
	}
	return out;
}

const GRIDSLIDES = {

	utils: {
		events: {
			on(node, name, fn) {
				if (!node.funcRef) node.funcRef = new Set();

				// Store it for later
				node.funcRef.add(fn);
				node.addEventListener(name, fn);
				return node;
			},

			off(node, name, fn) {
				if (!node.funcRef) return;
				if (fn) {
					node.removeEventListener(name, fn);
				} else {
					node.funcRef.forEach(fn => node.removeEventListener(name, fn));
				}
				node.funcRef.delete(fn);
				return node;
			},

			once(node, name, fn) {
				GRIDSLIDES.utils.events.on(node, name, function tempF(e) {
					fn.bind(node)(e);
					GRIDSLIDES.utils.events.off(node, name, tempF);
				});
				return node;
			},

			fire(node, name, detail = {}) {
				node.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
				return node;
			}
		},
		priorSiblings(el) {
			const nodes = Array.from(el.parentNode.children);
			const pos = nodes.indexOf(el);
			return nodes.slice(0, pos);
		},
		nextSiblings(el) {
			const nodes = Array.from(el.parentNode.children);
			const pos = nodes.indexOf(el);
			return nodes.slice(pos + 1);
		},
		getRootProperty(str) {
			return getComputedStyle(document.documentElement).getPropertyValue(str);
		}
	},

	constants: {
		events: {
			nextSlide: 'GRIDSLIDES_NEXT_SLIDE',
			finished: 'GRIDSLIDES_FINISHED'
		},
		templates: {
			slideTemplate: slideTemplate,
			containerTemplate: containerTemplate
		}
	},

	transitions: new Map(),

	registerTransition(name, obj) {
		GRIDSLIDES.transitions.set(name, obj);
	},

	slideData: new Map(),

	registerSlideData(name, schema, obj) {
		if (GRIDSLIDES.registeredSlideDataKeys) {
			throw Error('Slide data should be defined before page load.');
		}
		if (schema && !obj) {
			obj = schema;
			schema = {};
		}
		obj.schema = schema;
		GRIDSLIDES.slideData.set(name, obj);
	},

	getSlideData(name, el, options) {
		const data = GRIDSLIDES.slideData.get(name);
		let out;
		if (data.schema) {
			options = processSchema(data.schema, options, el);
		}
		if (typeof data === 'object') {
			out = data;
		}
		if (typeof data === 'function') {
			out = data.bind(el)(options);
		}
		out.data = options;
		return out;
	},

	registeredSlideDataKeys: undefined
}

window.GRIDSLIDES = GRIDSLIDES;

class HTMLElementWithRefs extends HTMLElement {

	constructor () {
		super();
		this.refs = new Proxy({}, {
			get: this.__getFromShadowRoot.bind(this)
		});
	}
	
	__getFromShadowRoot (target, name) {
		return this.shadowRoot.querySelector('[ref="' + name + '"]');
	}
}

class GridSlidesController extends HTMLElementWithRefs {

	constructor() {
		super();
		this.transition = GRIDSLIDES.transitions.get(this.getAttribute('transition') || 'slide');
		GRIDSLIDES.registeredSlideDataKeys = Array.from(GRIDSLIDES.slideData.keys());
		
		this.addEventListener('click', function () {
			if (this.hasAttribute('presenting')) {
				this.getCurrentSlide().run();
			}
		});
		
		this.addEventListener(GRIDSLIDES.constants.events.finished, function () {
			this.nextSlide();
		});
		
		this.addEventListener('keyup', e => {
			switch (e.keyCode) {
				
				// Left Arrow
				case 37:
				case 33:
				this.prevSlide();
				e.preventDefault();
				break;
				
				// Right Arrow
				case 13:
				case 39:
				case 34:
				this.getCurrentSlide().run();
				e.preventDefault();
				break;
			}
		});
		
		this.tabIndex = 0;
		this.attachShadow({mode: 'open'});
		this.shadowRoot.appendChild(containerTemplate.content.cloneNode(true));
		this.refs.start.addEventListener('click', this.startPresenting.bind(this));
	}
	
	static get observedAttributes() { return ['slide', 'transition', 'presenting', 'template']; }
	attributeChangedCallback(attr, oldValue, newValue) {
		if (attr === 'transition') {
			this.transition = GRIDSLIDES.transitions.get(newValue || 'slide');
		}
		if (attr === 'template') {
			this.template = newValue === 'default' ? slideTemplate : document.querySelector(newValue);
		}
		if (attr === 'presenting') {
			if (newValue === null) return;
			this.startPresenting();
		}
		if (attr === 'slide') {
			if (newValue === null) return;
			
			let direction = 'normal';
			
			const newSlide = this.getSlide(newValue);
			if (!newSlide) return;
			
			const oldSlide = this.getSlide(oldValue);
			if (oldSlide) {
				oldSlide.setAttribute('teardown-pending', '');
				oldSlide.removeAttribute('active');
				
				if (GRIDSLIDES.utils.priorSiblings(oldSlide).includes(newSlide)) {
					direction = 'reverse';
				}

				const oldSlideTransition = oldSlide.transition || this.transition;
				const animOut = oldSlideTransition[direction === 'normal' ? 'outState' : 'inState'].slice(0);
				const oldSlideTransitionSettings = oldSlideTransition[direction === 'normal' ? 'outSettings' : 'inSettings'] || oldSlideTransition.settings;
				oldSlideTransitionSettings.direction = direction;
				oldSlideTransitionSettings.fill = 'forwards';
				if (direction === 'normal') {
					animOut.unshift(oldSlideTransition.activeState);
				} else {
					animOut.push(oldSlideTransition.activeState);
				}
				oldSlide.animate(animOut, oldSlideTransitionSettings)
				.finished.then(function () {
					oldSlide.removeAttribute('teardown-pending');	
				});
			} else {
				direction = 'reverse';
			}

			const newSlideTransition = newSlide.transition || this.transition;
			const animIn = newSlideTransition[direction === 'normal' ? 'inState' : 'outState'].slice(0);
			const newSlideTransitionSettings = newSlideTransition[direction === 'normal' ? 'inSettings' : 'outSettings'] || newSlideTransition.settings;
			newSlideTransitionSettings.direction = direction;
			newSlideTransitionSettings.fill = 'forwards';
			if (direction === 'normal') {
				animIn.push(newSlideTransition.activeState);
			} else {
				animIn.unshift(newSlideTransition.activeState);
			}
			newSlide.animate(animIn, newSlideTransitionSettings)
			.finished.then(() => {
				newSlide.setAttribute('active', '');
				newSlide.removeAttribute('pending');

				const nextSlide = this.getNextSlide();
				if (nextSlide) this.__setup(nextSlide);
			});
		}
	}

	startPresenting(evt) {

		if (evt) evt.stopPropagation();

		// Set the attribute then it will recrse back to this when the attribute is changed.
		if (this.hasAttribute('presenting')) return;

		this.setAttribute('presenting', '');

		const firstSlide = this.getCurrentSlide() || this.querySelector('grid-slide');

		this.__setup(firstSlide);

		// animate slides into starting position
		for (const slide of this.querySelectorAll('grid-slide')) {
			if (slide !== firstSlide) {
				const anim = this.transition.inState.slice(0).reverse();
				const settings = this.transition.inSettings || this.transition.settings;
				settings.fill = 'forwards';
				anim.unshift(this.transition.activeState);
				slide.animate(anim, this.transition.inSettings || this.transition.settings);
			}
		}

		this.setSlide(firstSlide);
	}

	__setup(slideEl) {
		slideEl.setAttribute('pending', '');
	}

	/**
	 * returns undefined if no slide active
	 * 
	 * throws if invalid number given
	 * throws if invalid name given
	 */
	getCurrentSlide() {
		if (!this.getAttribute('slide')) {
			return false;
		}
		return this.getSlide(this.getAttribute('slide'));
	}

	getSlide(slideVal) {
		if (slideVal === null) {
			return;
		}

		let slide = Number(slideVal);
		// compare string to int
		if (slide !== NaN && slide == slideVal) {
			slide = this.children[slide];
			if (slide && slide.tagName === 'GRID-SLIDE') return slide;
			throw Error('Number given (' + slideVal + ') but it doesn\'t correspond to a slide', Number(slideVal));
		}

		slide = this.querySelector('#' + slideVal);
		if (slide) return slide;

		throw Error('Slide ID given but it doesn\'t correspond to a slide', this.getAttribute('slide'));
	}

	getNextSlide() {
		 return document.querySelector('grid-slide[active] ~ grid-slide');
	}

	getPrevSlide() {
		const priors = GRIDSLIDES.utils.priorSiblings(this.getCurrentSlide()).reverse();
		for (const el of priors) {
			if (el.matches('grid-slide')) return el;
		}
	}

	setSlide(el) {
		this.setAttribute('slide', el.id || Array.from(this.children).indexOf(el));
	}

	prevSlide() {
		const currentSlide = this.getCurrentSlide();
		if (currentSlide.__dirty) {
			currentSlide.reset();
			return;
		}
		const prevSlide = this.getPrevSlide();
		if (prevSlide) this.setSlide(prevSlide);
	}

	nextSlide() {
		const nextSlide = this.getNextSlide();
		if (nextSlide) this.setSlide(nextSlide);
	}

	registerSlideTransition(name, obj) {
		GRIDSLIDES.registerTransition(name, obj);
	}

	registerSlideGenerator(slide, generator) {
		console.log(slide, generator);
	}
}

class GridSlide extends HTMLElementWithRefs {
	constructor() {
		super();


		this.transition = GRIDSLIDES.transitions.get(this.getAttribute('transition'));
		this.__data = [];

		this.attachShadow({mode: 'open'});
		this.__buildDom();

		for (const datum of this.__data) {
			if (datum.init) datum.init.apply(this, []);
		}
	}

	__buildDom() {
		const template = this.template || this.parentNode.template || slideTemplate;
		this.shadowRoot.innerHTML = '';
		this.shadowRoot.appendChild(template.content.cloneNode(true));
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

	__parseAttr(string) {
		const out = {};
		const l = string.split(';').map(p => p.split(':'));
		l.forEach(p => p[0] && (out[p[0].trim()] = p[1].trim()));
		return out;
	}
	
	update(attr, newValue) {
		const attrs = Array.from(this.attributes)
		.filter(a => GRIDSLIDES.registeredSlideDataKeys.includes(a.name))
		.map(a => a.name);
		if (GRIDSLIDES.registeredSlideDataKeys.includes(attr)) {
			// Forces order of attributes
			this.__data[attrs.indexOf(attr)] = GRIDSLIDES.getSlideData(attr, this, this.__parseAttr(newValue));
			this.refs.play.style.display = '';
		}
	}
	
	registerSlideData(obj) {
		this.parentNode.registerSlideGenerator(this, obj);
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
			GRIDSLIDES.utils.events.fire(this, GRIDSLIDES.constants.events.finished);
			this.__complete = true;
		}
	}
	
	static get observedAttributes() {
		return ['pending', 'active', 'data', 'transition', 'teardown-pending', 'template'].concat(Array.from(GRIDSLIDES.registeredSlideDataKeys));
	}
	
	attributeChangedCallback(attr, oldValue, newValue) {
		
		if (attr === 'active') {
			if (newValue === null) {
				if (!this.hasAttribute('teardown-pending')) this.teardown();
				return;
			}
			if (!this.__isSetup) {
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

		if (attr === 'transition') {
			this.transition = GRIDSLIDES.transitions.get(newValue);
		}

		if (attr === 'template') {
			this.template = newValue === 'default' ? slideTemplate : document.querySelector(newValue);
			this.__buildDom();
		}

		if (GRIDSLIDES.registeredSlideDataKeys.includes(attr)) {
			this.update(attr, newValue);
		}
	}
}

window.addEventListener('DOMContentLoaded', function () {
	customElements.define('grid-slides-controller', GridSlidesController);
	customElements.define('grid-slide', GridSlide);
});
