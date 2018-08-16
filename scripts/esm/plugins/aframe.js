
import GridSlidesController from '../grid-slides-controller.js';

GridSlidesController.registerSlideData('a-frame-step-by-step', {
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
		if (el.tagName === 'TEMPLATE') {
			const step = [el.content, el.getAttribute('action') || 'replace'];
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
				scene.setAttribute('renderer', 'gammaOutput:true;');
                scene.setAttribute('vr-mode-ui', 'enabled: false');
                scene.renderer.toneMappingExposure = 2;
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
                scene.appendChild(target);
	
				domLocation.appendChild(scene);
                setTimeout(() => scene.resize(), 2000); 
			}
		},
		action: function *() {
			for (const step of steps) {
				if (step[1] === 'replace') {
                    target.innerHTML = "";
                    target.appendChild(document.importNode(step[0] ,true));
                }
				if (step[1] === 'append') target.appendChild(document.importNode(step[0] ,true));
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