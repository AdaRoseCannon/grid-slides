/* global GRIDSLIDES */
/* eslint-env es6 */
'use strict';

GRIDSLIDES.registerTransition('slide', {
	inState: [{
		transform: 'translateX(100vw)'
	}],
	outState: [{
		transform: 'translateX(-100vw)'
	}],
	activeState: {
		transform: 'none'
	},
	inSettings: {
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	},
	outSettings: {
		duration: 500,
		easing: getComputedStyle(document.documentElement).getPropertyValue('--easeInOutQuart')
	}
});

GRIDSLIDES.registerTransition('fade', {
	inState: [{
		opacity: 0
	}],
	outState: [{
		opacity: 0
	}],
	activeState: {
		opacity: 1
	},
	inSettings: {
		duration: 500,
		easing: 'linear'
	},
	outSettings: {
		duration: 500,
		easing: 'linear'
	}
});

GRIDSLIDES.registerSlideData('a-frame-step-by-step', {
	static: {
		default: false
	},
	physics: {
		default: false
	},
	light: {
		default: true
	}
}, function (options) {

	let steps;
	let scene;
	let target;

	return {
		setup: function () {
			let assets;
			if (!scene) {
				scene = document.createElement('a-scene');
				scene.setAttribute('embedded', '');
				if (options.physics) scene.setAttribute('physics', 'debug:true;');
				target = document.createElement('a-entity');
				if (!options.light) target.setAttribute('light', 'intensity: 0;');
				scene.appendChild(target);
				assets = document.createElement('a-assets');
				scene.appendChild(assets);
			}
			if (!steps) {
				steps = [];
				for (const el of this.children) {
					if (el.tagName === 'SCRIPT') {
						steps.push([el.textContent, el.getAttribute('action') || 'replace']);
						this.removeChild(el)
					}
				}
			}

			steps.forEach(function (step) {
				if (step[1] === 'assets') {
					assets.insertAdjacentHTML('afterbegin', step[0]);
				}
			});

			this.appendChild(scene);
		},
		action: function *() {
			target.innerHTML = '';
			for (const step of steps) {
				if (step[1] === 'replace') yield target.innerHTML = step[0];
				if (step[1] === 'append') yield target.insertAdjacentHTML('afterbegin', step[0]);
				if (step[1] === 'eval') yield (new Function(step[0])).bind(target)();
			}
		},
		teardown: function () {
			if (scene) this.removeChild(scene);
			scene = undefined;
			target = undefined;
		}
	}
});

GRIDSLIDES.registerSlideData('iframe-slide', {
	init: function () {
		this.querySelector('iframe').dataset.src = this.querySelector('iframe').src;
		this.querySelector('iframe').src = 'about:blank';
	},
	setup: function () {
		this.querySelector('iframe').src = 'about:blank';
	},
	action: function * () {
		yield this.querySelector('iframe').src = this.querySelector('iframe').dataset.src;
	},
	teardown: function () { this.querySelector('iframe').src = 'about:blank'; }
});

GRIDSLIDES.registerSlideData('video-slide', {
	setup: function () {
		this.querySelector('video').currentTime = 0;
		this.querySelector('video').pause();
	},
	action:function *() {
		yield this.querySelector('video').play();
	},
	teardown: function () {
		this.querySelector('video').pause();
	}
});


GRIDSLIDES.registerSlideData('el-by-el',

	{ //schema
		preserve: {
			default: ''
		},
		reveal: {
			default: false
		}
	},

	function elByEl(options) {

		options = options || {};
		const selector = options.preserve || false;
		const preserve = [];
		const reveal = options.reveal || false;
		let children;
		let showFirstChild;

		function replaceWithEl(el, target) {
			target.innerHTML = '';
			preserve.forEach(function (el) {
				target.appendChild(el);
			});
			target.appendChild(el);
		}

		const out = {
		};

		function init() {
			const self = this;
			preserve.push(...Array.from(this.children).filter(function (el) {
				if (el.matches(selector)) {
					self.removeChild(el);
					return true;
				}
			}));

			children = Array.from(this.children);
			const firstChild = children.shift();

			const run = el => {
				if (reveal) {
					this.appendChild(el);
				} else {
					replaceWithEl(el, this);
				}
			}

			showFirstChild = function () {
				run(firstChild);
			}
			if (!children.length) throw Error('Empty elByEl target');

			out.action = (function * () {
				yield;
				for (const el of children) yield run(el);
			}).bind(this);
		}

		out.teardown = out.setup = function () {
			if (!children) init.bind(this)();
			this.innerHTML = '';
			showFirstChild();
		};

		return out;
	}
);

function renderContent(el, data) {
	data.style = data.style || '';
	if (data) {
		switch (Object.keys(data)[0]) {
			case 'video':
				el.innerHTML = `<video src="${data.video}" preload autoplay autostart ${data.loop ? 'loop' : ''} style="object-fit: contain; flex: 1 0; ${data.style}" />`;
				el.querySelector('video').currentTime = data.start || 0;
				el.querySelector('video').play();
				break;
			case 'image':
				el.innerHTML = `<image src="${data.image}" style="${data.style}" />`;
				break;
			case 'markdown':
				const preWhite = data.markdown.match(/\n?([ \t]*)[^\w]/)[1];
				el.addMarkdown(data.markdown.replace(new RegExp('\\n' + preWhite, 'gi'), '\n'));
				break;
			case 'html':
				el.innerHTML = data.html;
				break;
			case 'iframe':
				el.innerHTML = `<iframe src="${data.iframe}" frameborder="none" style="flex: 1 0; ${data.style}" /></iframe>`;
				break;
		}
		if (data.caption) {
			const caption = document.createElement('h2');
			caption.textContent = data.caption;
			el.appendChild(caption);
			caption.classList.add('caption');
			if (data.captionStyle) caption.setAttribute('style', data.captionStyle);
		}
		if (data.url || data.iframe) {
			el.addHTML(`<div class="slide-url">${data.url || data.iframe || ''}</div>`);
		}
		if (data.callback) {
			data.callback.bind(el)(data);
		}
	}
}

// Uses ES2015 Generators
GRIDSLIDES.registerSlideData('content-slide', function contentSlide(slides) {
	let oldContent;

	return {
		setup: function setup() {
			oldContent = Array.from(this.children);
			this.innerHTML = '';
			renderContent(this, slides[0]);
			if (slides[0].video) {
				this.querySelector('video').pause();
			}
		},
		action: function* () {

			const t = slides.slice();

			if (t.length === 0) {
				yield;
				return;
			}

			while (t.length) {
				this.innerHTML = '';
				renderContent(this, t.shift());
				yield;
			}
		},
		teardown() {
			if (oldContent) {
				this.innerHTML = '';
				oldContent.forEach(c => this.appendChild(c));
			}
		}
	};
});