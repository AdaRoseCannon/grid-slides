
import "https://aframe.io/releases/0.8.2/aframe.min.js";
import "https://cdn.rawgit.com/mrdoob/three.js/r95/examples/js/loaders/GLTFLoader.js";
import GridSlidesController from '../grid-slides-controller.js';

GridSlidesController.registerSlideData('a-frame-step-by-step', {
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

	let scene;
	let target;
    let domLocation = options.target || this;
    
    function teardown() {
        try {
            // HACK!! This throws errors sometimes. 
            domLocation.removeChild(scene);
            target.removeFromParent();
        } catch(e) {
            console.log('teardown error');
        }
        scene = undefined;
        target = undefined;
    }

    function setup () {

        if (!steps.length) for (const el of this.children) {
            if (el.tagName === 'TEMPLATE') {
                const step = [el, el.getAttribute('action') || 'replace'];
                if (step[1] === 'assets') {
                    assets.push(step);
                } else {
                    steps.push(step);
                }
            }
        }
    
        if (!steps.length) throw Error('No steps to run');

        if (!scene) {
            scene = document.createElement('a-scene');
            scene.setAttribute('embedded', '');
            scene.setAttribute('renderer', 'gammaOutput:true;');
            scene.setAttribute('vr-mode-ui', 'enabled: false');
            scene.flushToDOM();

            // HACK to ensure the internal daat is accurate
            scene.components.renderer.data = (scene.getAttribute('renderer') || 'gammaOutput:true;');
            scene.renderer.toneMappingExposure = 2;
            if (options.physics) scene.setAttribute('physics', 'debug:true;');

            const assetsEl = document.createElement('a-assets');
            assets.forEach(function (step) {
                assetsEl.appendChild(document.importNode(step[0].content ,true));
            });
            scene.appendChild(assetsEl);

            target = document.createElement('a-entity');
            if (!options.light) {
                target.setAttribute('light', 'intensity: 0;');
            }
            scene.appendChild(target);
        }

        domLocation.appendChild(scene);
    }

	return {
		setup,
		action: function *() {
    
            // HACK!! Sometimes the templates haven't been parsed
            if (!steps.length) setup();

			for (const step of steps) {
				if (step[1] === 'replace') {
                    target.innerHTML = "";
                    target.appendChild(document.importNode(step[0].content ,true));
                }
				if (step[1] === 'append') target.appendChild(document.importNode(step[0].content ,true));
				if (step[1] === 'eval') (new Function(step[0])).bind(target)();
				if (step === steps.slice(-1)[0]) return;
				yield;
			}
		},
		teardown
	}
});