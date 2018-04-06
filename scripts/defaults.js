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
	},
	target: {
		type: 'selector'
	}
}, function (options) {

	const steps = [];
	const assets = [];

	for (const el of this.children) {
		if (el.tagName === 'SCRIPT') {
			const step = [el.textContent, el.getAttribute('action') || 'replace'];
			if (step[1] === 'assets') {
				assets.push(step);
			} else {
				steps.push(step);
			}
			this.removeChild(el);
		}
	}

	if (!steps.length) throw Error('No steps to run');

	let scene;
	let target;
	let domLocation = options.target || this;

	return {
		setup: function () {

			if (!scene) {
				scene = document.createElement('a-scene');
				scene.setAttribute('embedded', '');
				scene.setAttribute('vr-mode-ui', 'enabled: false');
				if (options.physics) scene.setAttribute('physics', 'debug:true;');

				const assetsEl = document.createElement('a-assets');
				assets.forEach(function (step) {
					assetsEl.insertAdjacentHTML('afterbegin', step[0]);
				});
				scene.appendChild(assetsEl);
	
				target = document.createElement('a-entity');
				if (!options.light) {
					target.setAttribute('light', 'intensity: 0;');
				}
				const step = steps[0];
				if (step[1] === 'replace' || step[1] === 'append') {
					target.innerHTML = step[0];
				}
				scene.appendChild(target);
	
				domLocation.appendChild(scene);
			}
		},
		action: function *() {
			target.innerHTML = '';
			for (const step of steps) {
				if (step[1] === 'replace') target.innerHTML = step[0];
				if (step[1] === 'append') target.insertAdjacentHTML('afterbegin', step[0]);
				if (step[1] === 'eval') (new Function(step[0])).bind(target)();
				if (step === steps.slice(-1)[0]) return;
				yield;
			}
		},
		teardown: function () {
			if (scene) domLocation.removeChild(scene);
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
		this.querySelector('iframe').src = this.querySelector('iframe').dataset.src;
	},
	teardown: function () { this.querySelector('iframe').src = 'about:blank'; }
});

GRIDSLIDES.registerSlideData('video-slide', {
	setup: function () {
		const video = this.querySelector('video');
		if (!video) return;
		video.currentTime = 0;
		video.pause();
	},
	action:function *() {
		const video = this.querySelector('video');
		video.currentTime = 0;
		video.play();
	},
	teardown: function () {
		const video = this.querySelector('video');
		if (!video) return;
		video.pause();
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
				let i = 0;
				for (const el of children) {
					i++;
					const nextEl = children[i];
					if (el.tagName === 'SCRIPT' && el.actions) {
						yield * el.actions();
						if (nextEl) {
							yield;
							if (el.teardown) el.teardown();
						}
						continue;
					}
					if (!nextEl) {
						return run(el); 
					}
					if (nextEl.tagName === 'SCRIPT' && nextEl.actions) {
						// in the case of a script run and then jump straight into the script.
						run(el);
					} else {
						yield run(el);
					}
				}
			}).bind(this);
		}

		out.teardown = out.setup = function () {
			if (!children) init.bind(this)();
			for (const el of children) {
				if (el.tagName === 'SCRIPT' && el.teardown) {
					el.teardown();
				}
			}
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

GRIDSLIDES.registerSlideData('wait', {
	action: function * () {
		yield;
	}
});


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
				return;
			}

			while (t.length) {
				this.innerHTML = '';
				renderContent(this, t.shift());
				if (t.length !== 0) yield;
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