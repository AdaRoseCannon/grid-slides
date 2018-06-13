
import GridSlidesController from '../grid-slides-controller.js';

GridSlidesController.registerSlideData('el-by-el',

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
                        yield * el.actions.bind(this)();
                        if (nextEl) {
                            yield;
                            if (el.teardown) el.teardown.bind(this)();
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
                    el.teardown.bind(this)();
                }
            }
            this.innerHTML = '';
            showFirstChild();
        };

        return out;
    }
);