"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sandboxjs_1 = require("@nyariv/sandboxjs");
const eQuery_1 = require("./eQuery");
exports.allowedGlobals = sandboxjs_1.default.SAFE_GLOBALS;
exports.allowedPrototypes = sandboxjs_1.default.SAFE_PROTOTYPES;
exports.sandbox = new sandboxjs_1.default(exports.allowedGlobals, exports.allowedPrototypes);
const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;
const regForbiddenAttr = /^(on|:|@|x-)/;
const regHrefJS = /^\s*javascript:/;
function wrap(selector, context) {
    return Object.assign(Object.create(ElementCollection.prototype), eQuery_1.wrap(selector, context));
}
exports.wrap = wrap;
class ElementCollection extends eQuery_1.ElementCollection {
    html(content) {
        let contentElem;
        let elem = this.get(0);
        if (!elem)
            return this;
        if (typeof content !== 'string') {
            contentElem = wrap(content).detach();
        }
        const subs = eQuery_1.getStore(elem, 'htmlSubs', []);
        unsubNested(subs);
        const processed = processHtml(typeof content !== 'string' ? contentElem : content, subs, ...getScopes(elem, {}, subs));
        elem.appendChild(processed.elem);
        processed.run();
        return this;
    }
    detach() {
        const contentElem = document.createElement('template');
        this.forEach((elem) => {
            unsubNested(eQuery_1.getStore(elem, 'htmlSubs'));
            contentElem.appendChild(elem);
        });
        return contentElem.content;
    }
}
exports.ElementCollection = ElementCollection;
exports.allowedPrototypes.set(eQuery_1.ElementCollection, new Set());
exports.allowedPrototypes.set(ElementCollection, new Set());
exports.allowedPrototypes.set(eQuery_1.EqEvent, new Set());
class ElementScope {
    constructor(element) {
        this.$el = wrap(element);
    }
    $dispatch(eventType, detail, bubbles = true, cancelable = true) {
        this.$el.trigger(eventType, detail, bubbles, cancelable);
    }
}
class RootScope extends ElementScope {
    $wrap(element) {
        return wrap(element, this.$el);
    }
}
class Component extends RootScope {
}
exports.Component = Component;
exports.allowedPrototypes.set(RootScope, new Set());
exports.allowedPrototypes.set(ElementScope, new Set());
const components = {};
function defineComponent(name, comp) {
    components[name] = comp;
    if (!exports.allowedPrototypes.has(comp.constructor)) {
        exports.allowedPrototypes.set(comp.constructor, new Set());
    }
}
exports.defineComponent = defineComponent;
function init(elems, component) {
    const runs = [];
    (elems ? wrap(elems, eQuery_1.$document) : eQuery_1.$document.search('[x-app]').not('[x-app] [x-app]'))
        .once('x-processed')
        .forEach((elem) => {
        const comp = component || elem.getAttribute('x-app');
        const subs = [];
        const scope = eQuery_1.getStore(elem, 'scope', components[comp] || getScope(elem, subs, {}, true));
        const processed = processHtml(elem, subs, scope);
        elem.setAttribute('x-processed', '');
        runs.push(processed.run);
    });
}
exports.default = init;
function getScope(element, subs, vars = {}, root = false) {
    const scope = eQuery_1.getStore(element, 'scope', root ? new RootScope(element) : new ElementScope(element));
    eQuery_1.getStore(element, 'htmlSubs', subs);
    subs.push(() => {
        scope.$el = null;
        eQuery_1.deleteStore(element, 'htmlSubs');
        eQuery_1.deleteStore(element, 'scope');
    });
    Object.assign(scope, vars);
    return scope;
}
function getDataScope(element, data) {
    return eQuery_1.getStore(element, 'dataScope', data);
}
function getScopes(element, newScope, subs = []) {
    if (!element)
        return [];
    const datascope = getDataScope(element);
    const scope = newScope === undefined ? eQuery_1.getStore(element, 'scope') : getScope(element, subs, newScope);
    const scopes = [];
    if (scope)
        scopes.push(scope);
    if (datascope)
        scopes.push(datascope);
    return [...(element.hasAttribute('x-detached') ? [] : getScopes(element.parentElement)), ...scopes];
}
exports.getScopes = getScopes;
function watch(code, cb, scopes, ...lastVal) {
    const gets = new Map();
    let unsub = exports.sandbox.subscribeGet((obj, name) => {
        const names = gets.get(obj) || new Set();
        names.add(name);
        gets.set(obj, names);
    }).unsubscribe;
    const val = run('return ' + code, ...scopes);
    unsub();
    let subs = [];
    let timer;
    const sub = () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            if (!subs.length)
                return;
            unsubNested(subs);
            subs.push(...watch(code, cb, scopes, val));
        });
    };
    gets.forEach((g, obj) => {
        g.forEach((name) => {
            subs.push(exports.sandbox.subscribeSet(obj, name, sub).unsubscribe);
        });
    });
    cb(val, ...lastVal);
    return subs;
}
exports.watch = watch;
const sandboxCache = {};
function run(code, ...scopes) {
    sandboxCache[code] = sandboxCache[code] || exports.sandbox.compile(code);
    return sandboxCache[code](...scopes);
}
exports.run = run;
const directives = {};
defineDirective('show', (exec, ...scopes) => {
    return watch(exec.js, (val, ...lastVal) => {
        if (lastVal.length && lastVal[0] === val)
            return;
        exec.element.classList.toggle('hide', !val);
    }, scopes);
});
defineDirective('text', (exec, ...scopes) => {
    return watch(exec.js, (val, ...lastVal) => {
        if (lastVal.length && lastVal[0] === val)
            return;
        exec.element.textContent = val;
    }, scopes);
});
defineDirective('ref', (exec, ...scopes) => {
    if (!exec.js.match(regVarName)) {
        throw new Error('Invalid ref name: ' + exec.js);
    }
    const name = getScope(exec.element, exec.subs, { name: exec.js.trim() });
    run(`$refs[name] = $el`, ...scopes, name);
    return [() => {
            run(`delete $refs[name]`, ...scopes, name);
        }];
});
defineDirective('model', (exec, ...scopes) => {
    const el = exec.element;
    const change = () => {
        run(exec.js + ' = $$value', ...scopes, getScope(el, exec.subs, { $$value: el.value }));
    };
    el.addEventListener('input', change);
    const subs = watch(exec.js, (val, ...lastVal) => {
        if (lastVal.length && lastVal[0] === val)
            return;
        el.value = val;
    }, scopes);
    return [() => exec.element.removeEventListener('input', change), subs];
});
defineDirective('html', (exec, ...scopes) => {
    return watch(exec.js, (val, ...lastVal) => {
        if (lastVal.length && lastVal[0] === val)
            return;
        exec.element.innerHTML = '';
        const subs = eQuery_1.getStore(exec.element, 'htmlSubs', exec.subs);
        unsubNested(subs);
        const processed = processHtml(val, subs, ...scopes);
        exec.element.appendChild(processed.elem);
        processed.run();
    }, scopes);
});
function defineDirective(name, callback) {
    directives[name] = callback;
}
exports.defineDirective = defineDirective;
function runDirective(exec, ...scopes) {
    if (directives[exec.directive]) {
        return directives[exec.directive](exec, ...scopes);
    }
    return [];
}
function walkerInstance() {
    const execSteps = [];
    return {
        ready: (cb) => execSteps.push(cb),
        run: () => execSteps.forEach((cb) => cb())
    };
}
function processHtml(elem, subs, ...scopes) {
    let template;
    const exec = walkerInstance();
    if (typeof elem === 'string') {
        template = document.createElement('template');
        template.innerHTML = elem;
        walkTree(template.content, subs, exec.ready, ...scopes);
    }
    else {
        walkTree(elem, subs, exec.ready, ...scopes);
    }
    return {
        elem: typeof elem === 'string' ? template.content : elem,
        run: exec.run
    };
}
function unsubNested(subs) {
    if (!subs)
        return;
    if (typeof subs === 'function') {
        subs();
        return;
    }
    subs.forEach((unsub) => {
        if (Array.isArray(unsub)) {
            unsubNested(unsub);
        }
        else {
            unsub();
        }
    });
    subs.length = 0;
}
exports.unsubNested = unsubNested;
function walkTree(element, subs, ready, ...scopes) {
    const nestedSubs = [];
    let pushed = false;
    const pushSubs = () => {
        if (pushed)
            return;
        pushed = true;
        subs.push(nestedSubs);
    };
    if (element instanceof Element) {
        if (["OBJECT", "EMBED"].includes(element.tagName)) {
            element.remove();
            return;
        }
        const $element = wrap(element);
        element.removeAttribute('x-cloak');
        if (element.hasAttribute('x-if')) {
            const html = element.outerHTML;
            const comment = document.createComment('x-if');
            let ifElem;
            element.before(comment);
            element.remove();
            ready(() => {
                pushSubs();
                subs.push(watch(element.getAttribute('x-if'), (val, ...lastVal) => {
                    if (lastVal.length && lastVal[0] === val)
                        return;
                    if (val) {
                        if (!ifElem) {
                            const template = document.createElement('template');
                            template.innerHTML = html;
                            ifElem = template.content.firstElementChild;
                            ifElem.removeAttribute('x-if');
                            const processed = processHtml(ifElem, nestedSubs, ...scopes, getScope(ifElem, nestedSubs));
                            comment.after(processed.elem);
                            processed.run();
                        }
                    }
                    else {
                        if (ifElem) {
                            ifElem.remove();
                            ifElem = undefined;
                            unsubNested(nestedSubs);
                        }
                    }
                }, scopes));
            });
            return;
        }
        if (element.hasAttribute('x-for')) {
            const html = element.outerHTML;
            const comment = document.createComment('x-for');
            element.after(comment);
            element.remove();
            const items = new Set();
            let exp;
            const at = element.getAttribute('x-for');
            let split = at.split(' in ');
            if (split.length < 2) {
                throw new Error('In valid x-for directive: ' + at);
            }
            else {
                exp = split.slice(1).join(' in ');
            }
            const varsExp = split[0];
            const varMatch = varsExp.match(regVarName);
            let key;
            let value;
            if (varMatch) {
                value = varMatch[1];
            }
            else {
                const doubleMatch = varsExp.match(regKeyValName);
                if (!doubleMatch)
                    throw new Error('In valid x-for directive: ' + at);
                key = doubleMatch[1];
                value = doubleMatch[2];
            }
            ready(() => {
                pushSubs();
                subs.push(watch(exp, (val, ...lastVal) => {
                    if (lastVal.length && lastVal[0] === val)
                        return;
                    unsubNested(nestedSubs);
                    items.forEach((item) => {
                        item.remove();
                    });
                    items.clear();
                    const runs = [];
                    val.forEach((item, i) => {
                        const scope = { $index: i };
                        if (key)
                            scope[key] = i;
                        if (value)
                            scope[value] = item;
                        const template = document.createElement('template');
                        template.innerHTML = html;
                        const elem = template.content.firstElementChild;
                        elem.removeAttribute('x-for');
                        const processed = processHtml(elem, nestedSubs, ...scopes, getScope(elem, nestedSubs, scope));
                        comment.before(processed.elem);
                        items.add(elem);
                        runs.push(processed.run);
                    });
                    runs.forEach((run) => run());
                }, scopes));
            });
            return;
        }
        if (element.hasAttribute('x-detached')) {
            ready(() => {
                scopes = [getScope(element, nestedSubs, {}, true)];
            });
        }
        if (element.hasAttribute('x-data')) {
            ready(() => {
                scopes = [...scopes, getScope(element, nestedSubs)];
                scopes = [...scopes, getDataScope(element, run('return ' + (element.getAttribute('x-data') || '{}'), ...scopes))];
            });
        }
        if (element instanceof HTMLScriptElement) {
            if (!element.type || element.type === 'text/javacript') {
                if (element.src) {
                    element.remove();
                }
                else {
                    element.type = 'text/sandboxjs';
                    ready(() => {
                        run(element.innerHTML, ...scopes);
                    });
                }
                ;
            }
            return;
        }
        else {
            [...element.attributes].forEach((att) => {
                if (att.nodeName.startsWith('on')) {
                    element.setAttribute('@' + att.nodeName.slice(2), att.nodeValue);
                    element.removeAttribute(att.nodeName);
                }
                else if (['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from'].includes(att.nodeName) && att.nodeValue !== 'javascript:void(0)') {
                    const isJs = att.nodeValue.match(regHrefJS);
                    if (isJs) {
                        if (att.nodeName === 'href' || att.nodeName === 'xlink:href') {
                            if (!element.hasAttribute('@click')) {
                                element.setAttribute('@click', att.nodeValue.substring(isJs[0].length));
                            }
                            element.setAttribute('href', 'javascript:void(0)');
                        }
                        else {
                            element.removeAttribute(att.nodeName);
                        }
                    }
                }
                else if (att.nodeName === 'srcdoc' && element instanceof HTMLIFrameElement) {
                    const html = att.nodeValue;
                    element.removeAttribute(att.nodeName);
                    if (!element.hasAttribute(':srcdoc')) {
                        element.setAttribute(':srcdoc', `'${html.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/'/g, "\\'")}'`);
                    }
                }
            });
            [...element.attributes].forEach((att) => {
                if (att.nodeName.startsWith(':')) {
                    const at = att.nodeName.slice(1);
                    ready(() => {
                        pushSubs();
                        subs.push(watch(att.nodeValue, (val, ...lastVal) => {
                            var _a;
                            if (lastVal.length && lastVal[0] === val)
                                return;
                            if (typeof val === 'object' && ['style', 'class'].includes(at)) {
                                if (at === 'class') {
                                    $element.toggleClass(val);
                                }
                                else {
                                    if (element instanceof HTMLElement || element instanceof SVGElement) {
                                        for (let c in val) {
                                            element.style[c] = val[c];
                                        }
                                    }
                                }
                            }
                            else if (at === "srcdoc" && element instanceof HTMLIFrameElement) {
                                (_a = element.contentWindow.document.querySelector(':root')) === null || _a === void 0 ? void 0 : _a.remove();
                                unsubNested(nestedSubs);
                                const processed = processHtml(val, nestedSubs, ...scopes, getScope(element, nestedSubs));
                                element.contentWindow.document.appendChild(processed.elem);
                                processed.run();
                            }
                            else if (!at.match(regForbiddenAttr)) {
                                $element.attr(at, val);
                            }
                        }, scopes));
                    });
                }
                else if (att.nodeName.startsWith('@')) {
                    const parts = att.nodeName.slice(1).split('.');
                    const options = { once: parts[1] === 'once' };
                    const ev = (e) => {
                        run(att.nodeValue, ...scopes, getScope(element, nestedSubs, { $event: e }));
                    };
                    ready(() => {
                        pushSubs();
                        $element.on(parts[0], ev, options);
                        nestedSubs.push(() => $element.off(parts[0], ev));
                    });
                }
                else if (att.nodeName.startsWith('x-')) {
                    ready(() => {
                        pushSubs();
                        subs.push(runDirective({
                            element,
                            directive: att.nodeName.slice(2),
                            js: att.nodeValue,
                            original: element.outerHTML,
                            subs: nestedSubs
                        }, ...scopes, getScope(element, nestedSubs)));
                    });
                }
            });
        }
    }
    [...element.childNodes].forEach((el) => {
        if (el instanceof Element) {
            walkTree(el, subs, ready, ...scopes);
        }
        else if (el.nodeType === 3) {
            const strings = walkText(el.textContent);
            const nodes = [];
            let found = false;
            strings.forEach((s) => {
                if (s.startsWith("{{") && s.endsWith("}}")) {
                    found = true;
                    const placeholder = document.createTextNode("");
                    ready(() => {
                        pushSubs();
                        nestedSubs.push(watch(s.slice(2, -2), (val, lastVal) => {
                            if (lastVal === val)
                                return;
                            placeholder.textContent = val;
                        }, scopes));
                    });
                    nodes.push(placeholder);
                }
                else {
                    nodes.push(document.createTextNode(s));
                }
            });
            if (found) {
                nodes.forEach((n) => {
                    el.before(n);
                });
                el.remove();
            }
        }
    });
}
const closings = {
    "(": ")",
    "{": "}",
    "[": "]"
};
const quotes = ["'", '"', "`"];
function walkText(s, endJs = null) {
    let strings = [];
    let quote = null;
    let closing = null;
    let escape = false;
    let inJs = !!endJs;
    let start = 0;
    let i = 0;
    for (; i < s.length; i++) {
        const char = s[i];
        const next = s[i + 1];
        if (inJs) {
            if (quote) {
                if (!escape && quote === char) {
                    quote = null;
                }
                else if (char === '\\') {
                    escape = !escape;
                }
                else if (!escape && quote === '`' && char === "$" && next === "{") {
                    const strs = walkText(s.substring(i + 2), "}");
                    i += strs[0].length + 2;
                }
            }
            else if (quotes.includes(char)) {
                quote = char;
            }
            else if (closing) {
                if (closings[closing] === char) {
                    closing = null;
                }
            }
            else if (closings[char]) {
                closing = char;
            }
            else if (char === endJs) {
                strings.push(s.substring(start, i));
                return strings;
            }
            else if (char === "}" && next === "}") {
                strings.push(s.substring(start, i + 2));
                inJs = false;
                i += 1;
                start = i + 1;
            }
        }
        else {
            if (char === "{" && next === "{") {
                inJs = true;
                if (start !== i) {
                    strings.push(s.substring(start, i));
                }
                start = i;
                i += 1;
            }
        }
    }
    if (start !== i && start < s.length) {
        strings.push(s.substring(start, i));
    }
    return strings.filter(Boolean);
}
//# sourceMappingURL=Scope.js.map