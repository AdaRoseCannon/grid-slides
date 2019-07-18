/* eslint-disable require-atomic-updates */
import GridSlide from '../grid-slide.js';
import GridSlidesController from '../grid-slides-controller.js';

const schema = { //schema
	preserve: {
		default: ''
	},
	reveal: {
		default: false
	},
	root: {
		default: ''
	}
};

GridSlidesController.registerSlideData('el-by-el',

	schema,

	function elByEl(options) {

		const selector = options.preserve || false;
		const preserve = [];
		const reveal = options.reveal || false;
		const root = (options.root && this.querySelector(options.root)) || this;
		let firstChild;
		let children;

		function replaceWithEl(el, target) {
			target.innerHTML = '';
			preserve.forEach(function (el) {
				target.appendChild(el);
			});
			target.appendChild(el);
		}

		const out = {
		};

		const run = function (el) {
			if (reveal) {
				root.appendChild(el);
			} else {
				replaceWithEl(el, root);
			}
			if (el.tagName === 'VIDEO') {
				el.currentTime = 0;
				el.play();
				el.setAttribute('loop', true);
			}
			if (el.hasAttribute('has-video')) {
				el = el.querySelector('video');
				el.currentTime = 0;
				el.play();
				el.setAttribute('loop', true);
			}
		}

		function init() {
			preserve.push(...Array.from(root.children).filter(function (el) {
				if (el.matches(selector)) {
					root.removeChild(el);
					return true;
				}
			}));

			children = Array.from(root.children);
			children.forEach(el => {
				if (el.hasAttribute('el-by-el')) {
					const options = GridSlide.parseAttribute(el.getAttribute('el-by-el'));
					el.elByEl = GridSlidesController.getSlideData('el-by-el', el, options);
				}
			});
			firstChild = children.shift();

			if (!children.length) {
				console.warn('Empty elByEl target', this);
				out.action = function * () {};
				return;
			}

			out.action = (function * () {
				yield;
				let i = 0;
				for (const el of children) {
					i++;
					const nextEl = children[i];
					if (el.tagName === 'SCRIPT' && el.actions) {
						yield* el.actions.bind(this)();
						if (nextEl) {
							if (el.teardown) el.teardown.bind(this)();
						}
						continue;
					}
					if (el.tagName === 'SCRIPT' || el.tagName === 'TEMPLATE') {
						// Non-drawn elements shouldn't be waited for just skip them.
						continue;
					}

					run(el);

					if (el.elByEl) {
						el.elByEl.setup.bind(el)();
						const action = el.elByEl.action();
						return yield * action;
					}
					
					if (nextEl && nextEl.tagName !== 'SCRIPT') yield;
				}
			}).bind(this);
		}

		out.teardown = out.setup = function () {
			if (!children) init.bind(this)();
			for (const el of children) {
				if (el.tagName === 'SCRIPT' && el.teardown) {
					el.teardown.bind(this)();
				}
				if (el.elByEl) {
					el.elByEl.teardown();
				}
			}
			this.innerHTML = '';
			run(firstChild);
		};

		return out;
	}
);