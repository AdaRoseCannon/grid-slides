/* eslint-env es6 */
/* eslint no-console: 0 */
'use strict';

import './plugins/el-by-el.js';
import './plugins/transitions.js';
import GridSlide from './grid-slide.js';
import GridSlidesController from './grid-slides-controller.js';
import HTMLEncode from './html-encode.js';

// only polyfill .finished in browsers that already support animate()
if (Element.prototype.animate) {

	// Chrome does not seem to expose the Animation constructor globally
	if (typeof Animation === 'undefined') {
		window.Animation = document.firstElementChild.animate([]).constructor;
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

window.addEventListener('DOMContentLoaded', function () {
	customElements.define('grid-slides-controller', GridSlidesController);
	customElements.define('grid-slide', GridSlide);
	customElements.define('html-encode', HTMLEncode);
});
