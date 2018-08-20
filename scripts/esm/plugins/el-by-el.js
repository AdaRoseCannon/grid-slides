
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
                            if (el.teardown) el.teardown.bind(this)();
                        }
                        continue;
                    }
                    if (el.tagName === 'SCRIPT' || el.tagName === 'TEMPLATE') {
                        // Non-drawn elements shouldn't be waited for just skip them.
                        continue;
                    }
                    if (!nextEl) {
                        // The last element returns so it doesn't wait before continuing
                        return run(el); 
                    }
                    if (nextEl.tagName === 'SCRIPT' || nextEl.tagName === 'TEMPLATE') {
                        // in the case of a script run and then jump straight into the script.
                        run(el);
                    } else {

                        // Normal elemnts do a thing and yield it
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