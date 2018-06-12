import HTMLElementPlus from 'https://unpkg.com/html-element-plus/html-element-plus.js';
import html from 'https://unpkg.com/html-element-plus/noop.js';

class GridSlidesController extends HTMLElementPlus {

	static get slideData() {
		return this.__slideData || (this.__slideData = new Map());
	}

	static get transitions() {
		return this.__transitions || (this.__transitions = new Map());
	}

	static registerTransition(name, keyframes, settings) {
		this.transitions.set(name, {keyframes, settings});
	}

	static getSlideData(name, el, options) {
		const data = this.slideData.get(name);
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
	}

	static registerSlideData(name, schema, obj) {
		if (schema && !obj) {
			obj = schema;
			schema = {};
		}
		obj.schema = schema;
		this.slideData.set(name, obj);
	}

	constructor() {
		super();

		this.transitionIn = this.constructor.transitions.get('slide-left');
		this.transitionOut = this.constructor.transitions.get('slide-right');
		
		this.addEventListener('click', function () {
			if (this.hasAttribute('presenting')) {
				this.getCurrentSlide().run();
			}
		});
		
		this.addEventListener(this.constants.events.finished, function () {
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
		this.shadowRoot.appendChild(this.templateContent);
		this.refs.start.addEventListener('click', this.startPresenting.bind(this));
		this.refs.fullscreen.addEventListener('click', toggleFullscreen.bind(this));
	}

	static get templateHTML() {
		return html`
			<style>
				:host .slide-controls {
					grid-column: slide;
					margin-bottom: var(--padding);
					justify-content: center;
					display: var(--button-display, flex);
				}
				:host {
					background: white;
				}
			</style>
			<div class="slide-controls grid-slides-controller">
				<button class="start-button grid-slides-controller" ref="start">Start Presentation</button>
				<button class="start-button grid-slides-controller" ref="fullscreen">Full Screen</button>
			</div>
			<slot></slot>
		`;
	}
	
	static get observedAttributes() { return ['slide', 'transition-in', 'transition-out', 'presenting', 'slide-template']; }
	attributeChangedCallback(attr, oldValue, newValue) {
		if (attr === 'transition-in') {
			this.transitionIn = this.constructor.transitions.get(newValue);
		}
		if (attr === 'transition-out') {
			this.transitionOut = this.constructor.transitions.get(newValue);
		}
		if (attr === 'slide-template') {
			this['slide-template'] = newValue === 'default' ? false : document.querySelector(newValue);
		}
		if (attr === 'presenting') {
			if (newValue === null) return;
			this.startPresenting();
		}
		if (attr === 'slide') {
			if (newValue === null) return;
			
			const newSlide = this.getSlide(newValue);
			if (!newSlide) return;
			
			const oldSlide = this.getSlide(oldValue);
			if (oldSlide) {
				oldSlide.setAttribute('teardown-pending', '');
				oldSlide.removeAttribute('active');
				
				if (priorSiblings(oldSlide).includes(newSlide)) {
					newSlide.setAttribute('pending', '');
					return this.animate(newSlide, oldSlide, true);
				}
			}
			return this.animate(newSlide, oldSlide);
		}
	}

	animate (newSlide, oldSlide, backwards) {

		const newSlideTransition = !backwards ? (newSlide.transitionIn || this.transitionIn) : (newSlide.transitionOut || this.transitionOut);
		(newSlide.currentAnimation = newSlide.animate(
			newSlideTransition.keyframes,
			Object.assign({ direction: 'normal', fill: 'forwards'}, newSlideTransition.settings)
		))
		.finished.then(() => {
			newSlide.setAttribute('active', '');
			newSlide.removeAttribute('pending');

			const nextSlide = this.getNextSlide();
			if (nextSlide) this.__setup(nextSlide);
		});

		if (oldSlide) {
			const oldSlideTransition = !backwards ? (oldSlide.transitionOut || this.transitionOut) : (oldSlide.transitionIn || this.transitionIn);
			(oldSlide.currentAnimation = oldSlide.animate(
				oldSlideTransition.keyframes,
				Object.assign({ direction: 'reverse', fill: 'forwards' }, oldSlideTransition.settings)
			))
			.finished.then(function () {
				oldSlide.removeAttribute('teardown-pending');
			});
		}
	}

	get transitions() {
		return this.__transitions || {
		}
	}

	get constants() {
		return {
			events: {
				nextSlide: 'GRIDSLIDES_NEXT_SLIDE',
				finished: 'GRIDSLIDES_FINISHED'
			}
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
				const newSlideTransition = slide.transitionIn || this.transitionIn;
				(slide.currentAnimation = slide.animate(
					newSlideTransition.keyframes,
					Object.assign({ direction: 'normal', fill: 'forwards'}, newSlideTransition.settings)
				))
				slide.currentAnimation.pause();
			}
		}

		this.focus();

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

		let slide = String(Number(slideVal));
		// compare string to int 
		if (!isNaN(slide) && slide === slideVal.trim()) {
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
		const priors = priorSiblings(this.getCurrentSlide()).reverse();
		for (const el of priors) {
			if (el.matches('grid-slide')) return el;
		}
	}

	setSlide(el) {
		this.setAttribute('slide', el.id || Array.from(this.children).indexOf(el));
	}

	prevSlide() {
		const currentSlide = this.getCurrentSlide();
		if (!currentSlide) {
			return;
		}
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
		this.registerTransition(name, obj);
	}

	registerSlideGenerator(slide, generator) {
		console.log(slide, generator);
	}
}

function toggleFullscreen() {
	const isInFullScreen = (document.fullscreenElement && document.fullscreenElement !== null) ||
	(document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
	(document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
	(document.msFullscreenElement && document.msFullscreenElement !== null);

	if (isInFullScreen) {
		// cancel
		if (document.exitFullscreen) {
			document.exitFullscreen();
		} else if (document.webkitExitFullscreen) {
			document.webkitExitFullscreen();
		} else if (document.mozCancelFullScreen) {
			document.mozCancelFullScreen();
		} else if (document.msExitFullscreen) {
			document.msExitFullscreen();
		}
	} else {
		if (this.requestFullscreen) {
			this.requestFullscreen();
		} else if (this.msRequestFullscreen) {
			this.msRequestFullscreen();
		} else if (this.mozRequestFullScreen) {
			this.mozRequestFullScreen();
		} else if (this.webkitRequestFullscreen) {
			this.webkitRequestFullscreen();
		}
	}
}

function processSchema(schema, data, el) {
	let out = {};
	if (schema.type !== undefined || schema.default !== undefined) {
		const type = schema.type || typeof schema.default;
		if (data === undefined && schema.default !== undefined) {
			return schema.default;
		}
		if (type === 'number') return Number(data);
		if (type === 'string') return String(data);
		if (type === 'boolean') return data === 'true';
		if (type === 'selector') return el.querySelector(data);
		if (type === 'selectorAll') return el.querySelectorAll(data);
	} else {
		for (const key of Object.keys(schema)) {
			if (typeof schema[key] === 'object') {
				out[key] = processSchema(schema[key], data[key], el);
			}
		}
	}
	return out;
}

const priorSiblings = el => {
	const nodes = Array.from(el.parentNode.children);
	const pos = nodes.indexOf(el);
	return nodes.slice(0, pos);
}

export default GridSlidesController;