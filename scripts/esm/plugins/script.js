/* eslint-disable require-atomic-updates */
import GridSlidesController from '../grid-slides-controller.js';

GridSlidesController.registerSlideData('script', {}, {
    setup() {
       const scripts = this.querySelectorAll('script');
       for (const s of scripts) {
           if (s.setup) s.setup.bind(this)();
       } 
    },
    action: function * () {
       const scripts = this.querySelectorAll('script');
       for (const s of scripts) {
           if (s.actions) yield* s.actions.bind(this)();
       }
    },
    teardown: function () {
       const scripts = this.querySelectorAll('script');
       for (const s of scripts) {
           if (s.teardown) s.teardown.bind(this)();
       }
    }
});
