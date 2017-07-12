/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

const oldAnim = Element.prototype.animate;
Element.prototype.animate = function () {
	const animation = oldAnim.apply(this, arguments);
	if (animation.finished === undefined) {
		animation.finished = new Promise(function (resolve) {
			animation.addEventListener('finish', resolve);
		});
	}
	return animation;
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
			},
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
		}
	},

	constants: {
		events: {
			nextSlide: 'GRIDSLIDES_NEXT_SLIDE',
			finished: 'GRIDSLIDES_FINISHED'
		}
	},

	transitions: new Map(),

	registerTransition(name, obj) {
		GRIDSLIDES.transitions.set(name, obj);
	},


	slideData: new Map(),

	registerSlideData(name, obj) {
		if (GRIDSLIDES.registeredSlideDataKeys) {
			throw Error('Slide data should be defined before page load.');
		}
		GRIDSLIDES.slideData.set(name, obj);
	},

	getSlideData(name, el, options) {
		const data = GRIDSLIDES.slideData.get(name);
		if (typeof data === 'object') {
			return data;
		}
		if (typeof data === 'function') {
			return data.apply(el, [options]);
		}
	},

	registeredSlideDataKeys: undefined
}

const activeState = {
	transform: 'none'
};

window.GRIDSLIDES = GRIDSLIDES;

class GridSlidesController extends HTMLElement {

	
	constructor() {
		// Always call super first in constructor
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
		
		var style=document.createElement('style');
		style.innerHTML = `
		.slide-controls {
			grid-column: slide;
			margin-bottom: var(--padding);
			justify-content: center;
			display: var(--button-display, flex);
		}
		`;
		
		var content = document.createElement('slot');
		
		var startButton = document.createElement('button');
		startButton.classList.add('start-button');
		startButton.textContent = 'Start Presentation';
		startButton.addEventListener('click', this.startPresenting.bind(this));
		
		var controls = document.createElement('div');
		controls.classList.add('slide-controls');
		controls.appendChild(startButton);
		
		this.attachShadow({mode: 'open'});
		this.shadowRoot.appendChild(style);
		this.shadowRoot.appendChild(controls);
		this.shadowRoot.appendChild(content);
	}
	
	static get observedAttributes() { return ['slide', 'transition', 'presenting']; }
	attributeChangedCallback(attr, oldValue, newValue) {
		if (attr === 'transition') {
			this.transition = GRIDSLIDES.transitions.get(newValue || 'slide');
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
					animOut.unshift(activeState);
				} else {
					animOut.push(activeState);
				}
				oldSlide.animate(animOut, oldSlideTransitionSettings);
			}

			const newSlideTransition = newSlide.transition || this.transition;
			const animIn = newSlideTransition[direction === 'normal' ? 'inState' : 'outState'].slice(0);
			const newSlideTransitionSettings = newSlideTransition[direction === 'normal' ? 'inSettings' : 'outSettings'] || newSlideTransition.settings;
			newSlideTransitionSettings.direction = direction;
			newSlideTransitionSettings.fill = 'forwards';
			if (direction === 'normal') {
				animIn.push(activeState);
			} else {
				animIn.unshift(activeState);
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
				anim.unshift(activeState);
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
		if (slide !== NaN) {
			slide = this.children[slide];
			if (slide && slide.tagName === 'GRID-SLIDE') return slide;
			throw Error('Number given but it doesn\'t correspond to a slide', Number(slideVal));
		}
		slide = this.querySelector('#' + this.getAttribute('slide'));
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

function parseAttr(string) {
	const out = {};
	const l = string.replace(/\W/gi, '').split(';').map(p => p.split(':'));
	l.forEach(p => out[p[0]] = p[1]);
	return out;
}

class GridSlide extends HTMLElement {
	constructor() {
		super();
		this.transition = GRIDSLIDES.transitions.get(this.getAttribute('transition'));
		this.__data = [];
		this.update();
		for (const datum of this.__data) {
			if (datum.init) datum.init.apply(this, []);
		}

		var style=document.createElement('style');
		style.innerHTML = `

			.play-button {
				color: green;
				font-size: 1.5em;
				position: absolute;
				top: 0;
				right: 0;
				display: var(--button-display, block);
			}`;

		var content = document.createElement('slot');

		var playButton = document.createElement('button');
		playButton.classList.add('play-button');
		playButton.title = 'Play';
		playButton.textContent = '►';
		playButton.addEventListener('click', function () {
			if (!this.__isSetup) {
				this.setup();
			}
			
			this.run();
			
			if (this.__complete) {
				return this.reset();
			}
		}.bind(this));

		this.attachShadow({mode: 'open'});
		this.shadowRoot.appendChild(style);
		this.shadowRoot.appendChild(content);
		this.shadowRoot.appendChild(playButton);
	}

	static get observedAttributes() {
		return ['pending', 'active', 'data', 'transition'].concat(Array.from(GRIDSLIDES.registeredSlideDataKeys));
	}

	update() {
		this.__data.splice(0);
		for (const attr of this.attributes) {
			if (GRIDSLIDES.registeredSlideDataKeys.includes(attr.name)) {
				this.__data.push(GRIDSLIDES.getSlideData(attr.name, this, parseAttr(attr.value)));
			}
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
			if (datum.setup) datum.setup.apply(this, []);
			if (datum.action) actions.push(datum.action.bind(this)());
		}
		this.__actions = (function *() {
			if (actions.length === 0) {
				yield;
			}
			for (const action of actions) {
				yield* action;
			}
		}());
		this.__isSetup = true;
		this.__dirty = false;
		this.__complete = false;
	}

	teardown() {
		this.__isSetup = false;
		for (const datum of this.__data) {
			if (datum.teardown) datum.teardown.apply(this, []);
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

	attributeChangedCallback(attr, oldValue, newValue) {

		if (attr === 'active') {
			if (newValue === null) {
			   this.teardown();
			   return;
			}
			if (!this.__isSetup) {
				this.teardown();
				this.setup();
			}
			this.run();
		}

		if (attr === 'pending') {

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

		if (GRIDSLIDES.registeredSlideDataKeys.includes(attr)) {
			this.update();
		}
	}
}

window.addEventListener('DOMContentLoaded', function () {
	customElements.define('grid-slides-controller', GridSlidesController);
	customElements.define('grid-slide', GridSlide);
});
