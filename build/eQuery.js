"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const elementStorage = new WeakMap();
exports.$document = wrap(document.documentElement);
class ElementCollection extends Array {
    constructor(...items) {
        super(...items);
    }
    sort(callback) {
        if (!callback)
            return super.sort((a, b) => {
                if (a === b)
                    return 0;
                if (a.compareDocumentPosition(b) & 2) {
                    return 1;
                }
                return -1;
            });
        return super.sort(callback);
    }
    unique() {
        return from(this.toSet(), ElementCollection);
    }
    toArray() {
        return from(this, Array);
    }
    toSet() {
        let res = new Set();
        this.forEach((elem) => res.add(elem));
        return res;
    }
    add(selector, context) {
        if (selector instanceof Array) {
            selector = selector.filter(Boolean);
        }
        return wrap([this, wrap(selector, context)]);
    }
    is(selector) {
        if (typeof selector === 'string') {
            return this.some((elem) => elem.matches(selector));
        }
        let sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
        return this.some((elem) => sel.has(elem));
    }
    not(selector) {
        if (typeof selector === 'string') {
            return filter(this, (elem, i) => !elem.matches(selector));
        }
        let sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
        return filter(this, (elem, i) => !sel.has(elem));
    }
    has(selector) {
        if (typeof selector === 'string') {
            let cache = new Set();
            return filter(this, (elem) => {
                if (cache.has(elem)) {
                    return true;
                }
                let found = from(elem.querySelectorAll(':scope ' + selector), ElementCollection);
                found = found.add(parents(found));
                found.forEach(e => cache.add(e));
                return found.length;
            });
        }
        const sel = selector instanceof ElementCollection ? selector : wrap(selector);
        return filter(this, (elem, i) => sel.some((test) => elem !== test && elem.contains(test)));
    }
    search(selector) {
        if (typeof selector === 'function') {
            return new ElementCollection(this.find((a, b, c) => selector(a, b)));
        }
        return wrap(selector, new ElementCollection(...this));
    }
    on(events, callback, options) {
        const cb = typeof callback === 'function' ? callback : undefined;
        const opt = typeof callback === 'function' ? options : callback;
        objectOrProp(events, cb, (ev, handler) => {
            const h = (e) => handler(new EqEvent(e));
            this.forEach((elem) => {
                const store = getStore(elem, 'events', new Map());
                const evStore = store.get(ev) || new Map();
                evStore.set(handler, h);
                store.set(ev, evStore);
                elem.addEventListener(ev, handler, opt);
            });
        });
        return this;
    }
    off(events, callback) {
        if (!events) {
            this.forEach((elem) => {
                const store = getStore(elem, 'events', new Map());
                store.forEach((evStore, ev) => {
                    evStore.forEach((h) => {
                        elem.removeEventListener(ev, h);
                    });
                    evStore.clear();
                });
                store.clear();
            });
        }
        else {
            objectOrProp(events, callback || false, (ev, handler) => {
                this.forEach((elem) => {
                    const store = getStore(elem, 'events', new Map());
                    const evStore = store.get(ev) || new Map();
                    if (handler) {
                        const h = evStore.get(handler);
                        if (!h)
                            return;
                        elem.removeEventListener(ev, h);
                        evStore.delete(handler);
                    }
                    else {
                        evStore.forEach((h) => {
                            elem.removeEventListener(ev, h);
                        });
                        evStore.clear();
                    }
                });
            });
        }
        return this;
    }
    trigger(eventType, detail = undefined, bubbles = true, cancelable = true) {
        const event = new CustomEvent(eventType, { bubbles, cancelable, detail });
        this.forEach((elem) => {
            elem.dispatchEvent(event);
        });
        return this;
    }
    one(events, callback, options) {
        const params = parseOnParams(events, callback, options);
        params.options.once = true;
        const args = Object.values(params).filter(Boolean);
        return this.on(args.shift(), args.shift(), args.shift());
    }
    click(callback, options) {
        if (typeof callback === 'undefined') {
            return this.trigger('click', 1);
        }
        this
            .on('click', callback, options)
            .not('a[href], button, input, select, textarea')
            .once('eqAllyClick')
            .addClass('eq-ally-click')
            .on('keydown', (e) => {
            if (e.keyCode === 13 && e.currentTarget instanceof HTMLElement &&
                e.currentTarget.getAttribute('aria-disabled') !== 'true') {
                e.currentTarget.click();
            }
        })
            .attr({
            tabindex: 0,
            role: 'button'
        });
        return this;
    }
    hover(handlerIn, handlerOut) {
        return this.on('mouseenter', handlerIn).on('mouseleave', handlerOut);
    }
    attr(key, set) {
        if (objectOrProp(key, set, (k, v) => {
            if (("" + v).match(/^\s*javascript:/))
                throw new Error('"javascript:" attribute values are not allowed:' + v);
            if (k.match(/^(on|:|@|x-|srcdoc)/))
                throw new Error("Attribute not allowed: " + k);
            this.forEach((elem) => {
                elem.setAttribute(k, v + "");
            });
        }))
            return this;
        return (this[0] && typeof key === 'string') ? this[0].getAttribute(key) : null;
    }
    removeAttr(key) {
        this.forEach((elem) => {
            elem.removeAttribute(key);
        });
        return this;
    }
    val(set) {
        if (typeof set !== 'undefined') {
            prop(this, 'value', set);
            this.trigger('change');
            return this;
        }
        return prop(this, 'value', set);
    }
    text(set) {
        return prop(this, 'textContent', set);
    }
    scrollTop(set) {
        return prop(this, 'scrollTop', set);
    }
    scrollLeft(set) {
        return prop(this, 'scrollLeft', set);
    }
    label(set) {
        if (typeof set === 'string') {
            return this.attr('aria-label', set);
        }
        if (!this.get(0))
            return null;
        let get = (test) => test && test.length && test;
        return get(this.attr('aria-label')) ||
            get(get(this.attr('aria-labelledby')) && wrap('#' + this.attr('aria-labelledby')).label()) ||
            get(get(this.attr('id')) && wrap('label[for="' + this.attr('id') + '"]').label()) ||
            get(this.attr('title')) ||
            get(this.attr('placeholder')) ||
            get(this.attr('alt')) ||
            (get(this.text()) || "").trim();
    }
    data(key, set) {
        if (objectOrProp(key, set, (k, v) => {
            this.forEach((elem) => {
                let data = getStore(elem, 'data', {});
                data[k] = v;
            });
        }))
            return this;
        if (!this[0])
            return null;
        let data = getStore(this[0], 'data') || {};
        return typeof key === 'undefined' ? data : (typeof key === 'string' ? data[key] : data);
    }
    removeData(key) {
        this.forEach((elem) => {
            let data = getStore(elem, 'data', {});
            delete data[key];
        });
        return this;
    }
    addClass(name) {
        return this.toggleClass(name + "", true);
    }
    removeClass(name) {
        return this.toggleClass(name + "", false);
    }
    toggleClass(name, force) {
        const isObject = name instanceof Object;
        objectOrProp(name, force, (className, on) => {
            this.forEach((elem) => {
                elem.classList.toggle(className, isObject ? !!on : on);
            });
        });
        return this;
    }
    hasClass(name) {
        let nameArr = name.split(' ');
        return this.some((elem) => nameArr.every((className) => elem.classList.contains(className)));
    }
    once(identifier) {
        identifier = typeof identifier === 'undefined' ? 'once' : identifier;
        let res = filter(this, (elem, i) => {
            let once = getStore(elem, 'once', new Set());
            if (!once.has(identifier)) {
                once.add(identifier);
                return true;
            }
            return false;
        });
        if (typeof identifier === 'function') {
            res.forEach(identifier);
        }
        return res;
    }
    get(index) {
        index = +index;
        return this[index < 0 ? this.length + index : index];
    }
    index(selector) {
        let ind = 0;
        if (typeof selector === 'undefined') {
            return this.first().prevAll().length;
        }
        else if (typeof selector === 'string') {
            this.forEach((elem) => !(elem.matches(selector) || (ind++ || false)));
            return ind >= this.length ? -1 : ind;
        }
        const sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
        this.forEach((elem) => !(sel.has(elem) || (ind++ && false)));
        return ind >= this.length ? -1 : ind;
    }
    first() {
        return this.eq(0);
    }
    last() {
        return this.eq(-1);
    }
    eq(index) {
        const res = new ElementCollection(1);
        const elem = this.get(index);
        if (elem)
            res[0] = elem;
        else
            res.pop();
        return res;
    }
    next(selector) {
        return new ElementCollection(...this.map((elem, i) => elem.nextElementSibling)).filter((elem, i) => {
            return elem && (!selector || elem.matches(selector));
        });
    }
    nextUntil(selector, filter) {
        return from(propElem(this, 'nextElementSibling', filter, true, false, selector), ElementCollection).sort();
    }
    nextAll(selector) {
        return this.nextUntil(undefined, selector);
    }
    prev(selector) {
        return new ElementCollection(...this.map((elem) => elem.previousElementSibling)).filter((elem, i) => {
            return elem && (!selector || elem.matches(selector));
        });
    }
    prevUntil(selector, filter) {
        return from(propElem(this, 'previousElementSibling', filter, true, false, selector, true), ElementCollection).sort().reverse();
    }
    prevAll(selector) {
        return this.prevUntil(undefined, selector);
    }
    siblings(selector) {
        return wrap([
            propElem(this, 'nextElementSibling', selector, true),
            propElem(this, 'previousElementSibling', selector, true, false, false, true)
        ]);
    }
    children(selector) {
        return from(propElem(this.map((elem) => elem.firstElementChild), 'nextElementSibling', selector, true, true), ElementCollection);
    }
}
exports.ElementCollection = ElementCollection;
class EqEvent {
    constructor(originalEvent) {
        const props = {
            originalEvent: {
                value: originalEvent
            }
        };
        for (let prop in originalEvent) {
            if (typeof originalEvent[prop] === 'function') {
                props[prop] = {
                    value: (...args) => {
                        return originalEvent[prop](...args);
                    }
                };
            }
            else {
                props[prop] = {
                    value: originalEvent[prop]
                };
            }
        }
        Object.defineProperties(this, props);
    }
}
exports.EqEvent = EqEvent;
function wrap(selector, context) {
    if (!selector)
        return new ElementCollection();
    if (!context && selector === document.documentElement)
        return exports.$document;
    if (!context && typeof selector === 'string')
        return from(document.querySelectorAll(selector), ElementCollection);
    if (!context && selector instanceof Element)
        return new ElementCollection(selector);
    if (!context && selector instanceof ElementCollection)
        return filter(selector).unique().sort();
    let selectors = selector instanceof Array ? selector : [selector];
    let $context = context ? (context instanceof ElementCollection ? context : wrap(context)) : exports.$document;
    let elems = new Set();
    let doFilter = !!context;
    let doSort = selectors.length > 1;
    if ((selectors.length === 1 && $context.length === 1 && selectors[0] === $context[0]) || $context === selector)
        return $context;
    for (let sel of selectors) {
        if (sel instanceof ElementCollection) {
            sel.forEach((elem) => {
                if (elem instanceof Element)
                    elems.add(elem);
            });
        }
        else if (sel instanceof Element) {
            if (!context && selectors.length === 1) {
                return new ElementCollection(sel);
            }
            elems.add(sel);
        }
        else if (sel instanceof NodeList) {
            for (let i = 0; i < sel.length; i++) {
                let elem = sel[i];
                if (elem instanceof Element) {
                    elems.add(elem);
                }
            }
        }
        else if (sel instanceof HTMLCollection) {
            if (!context && selectors.length === 1) {
                return from(sel, ElementCollection);
            }
            from(sel, ElementCollection).forEach((elem) => {
                elems.add(elem);
            });
        }
        else if (typeof sel === 'string') {
            if (!context && selectors.length === 1) {
                return from(document.querySelectorAll(sel), ElementCollection);
            }
            $context.forEach((cElem) => {
                cElem.querySelectorAll(':scope ' + sel).forEach((elem) => elems.add(elem));
            });
            if (selectors.length === 1) {
                doFilter = false;
                doSort = false;
            }
        }
        else if (sel instanceof Set) {
            sel.forEach((elem) => {
                if (elem instanceof Element) {
                    elems.add(elem);
                }
            });
        }
        else {
            from(sel, ElementCollection).forEach((elem) => {
                if (elem instanceof Element) {
                    elems.add(elem);
                }
            });
        }
    }
    let res = from(elems, ElementCollection);
    if (doFilter) {
        res = filter(res, (elem, i) => {
            return $context.some((cont) => cont !== elem && cont.contains(elem));
        });
    }
    if (doSort) {
        res = res.sort();
    }
    return res;
}
exports.wrap = wrap;
function filter(elems, selector) {
    if (!selector)
        return new ElementCollection(...elems.filter((elem) => elem instanceof Element));
    if (typeof selector === 'function') {
        return new ElementCollection(...elems.filter(selector));
    }
    if (typeof selector === 'string') {
        return filter(elems, (elem) => elem.matches(selector));
    }
    const sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
    return filter(elems, (elem) => sel.has(elem));
}
function prop(elems, key, set) {
    if (objectOrProp(key, set, (k, v) => {
        elems.forEach((elem) => {
            elem[k] = v;
        });
    }))
        return elems;
    return elems[0] ? elems[0][key] : null;
}
function parents(elems, selector) {
    return from(propElem(elems, 'parentNode', selector, true), ElementCollection).sort().reverse();
}
function propElem(collection, prop, selector, multiple, includeFirst, stopAt, reverse) {
    let res = new Set();
    let cache = new Set();
    let is = (elem, sel) => {
        if (!(elem instanceof Element))
            return false;
        if (!sel)
            return true;
        if (typeof sel === 'string')
            return elem.matches(sel);
        if (sel instanceof Array)
            return sel.includes(elem);
        return elem === sel;
    };
    for (let i = reverse ? collection.length - 1 : 0; reverse ? i >= 0 : i < collection.length; reverse ? i-- : i++) {
        let elem = collection[i];
        if (!elem)
            continue;
        if (cache.has(elem))
            continue;
        cache.add(elem);
        let next = elem[prop];
        if (includeFirst) {
            next = elem;
        }
        if (!next || (stopAt && is(next, stopAt)))
            continue;
        do {
            if (is(next, selector)) {
                res.add(next);
            }
            cache.add(next);
        } while (multiple && next && (next = next[prop]) && !cache.has(next) && (!stopAt || !is(next, stopAt)));
    }
    return res;
}
function objectOrProp(name, set, each) {
    let res = {};
    let wasSet = false;
    if (typeof name === 'string' && typeof set !== 'undefined') {
        wasSet = true;
        name.split(' ').forEach((n) => res[n] = set);
    }
    else if (name && typeof name === 'object') {
        wasSet = true;
        res = name;
    }
    for (let i in res) {
        each(i, res[i]);
    }
    return wasSet;
}
function from(object, Class) {
    if (typeof object !== 'object' || !object)
        return new Class();
    if (Class.isPrototypeOf(object))
        return object;
    if (object instanceof Array || object instanceof NodeList || object instanceof HTMLCollection) {
        let i;
        let arr = new Class(object.length);
        for (i = 0; i < object.length; i++) {
            arr[i] = object[i];
        }
        return arr;
    }
    if (object.size) {
        let i = 0;
        let arr = new Class(object.size);
        object.forEach((item) => {
            arr[i++] = item;
        });
        return arr;
    }
    return Class.from(object);
}
function getStore(elem, store, defaultValue) {
    if (!elementStorage.has(elem)) {
        if (defaultValue === undefined)
            return;
        elementStorage.set(elem, new Map());
    }
    let types = elementStorage.get(elem);
    if (typeof defaultValue !== 'undefined' && !types.has(store)) {
        types.set(store, defaultValue);
    }
    return types.get(store);
}
exports.getStore = getStore;
function deleteStore(elem, store) {
    var _a;
    return (_a = elementStorage.get(elem)) === null || _a === void 0 ? void 0 : _a.delete(store);
}
exports.deleteStore = deleteStore;
function parseOnParams(events, callback, options) {
    if (typeof events === 'object') {
        return {
            events,
            callback: undefined,
            options: callback || {}
        };
    }
    else {
        return {
            events,
            callback: callback,
            options: options || {}
        };
    }
}
//# sourceMappingURL=eQuery.js.map