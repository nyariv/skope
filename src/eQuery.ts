"use strict";

import HTMLSanitizer from "./HTMLSanitizer";
import { isIterable } from "./utils";

// @ts-check
/**
 * Tiny jQuery
 * ES6 based, stripped down jQuery to the most used bits, with all dom manipulation removed.
 *
 * Usage:
 * (($) => {
 *   $('ul > li').addClass('show').click((e) => { $(this).toggleClass('show'); });
 * })(elementWrapper)
 */

/**
 * Storage holding element related data that will self delete when
 * the element no longer exists.
 */
const elementStorage = new WeakMap<Node, Map<string, any>>();

type sortCallback = (a: Element, b: Element) => any;
type search = (value?: Element, index?: number) => any;
interface EqEventListener<T> {
  (evt: T&EqEvent): void;
}

interface EqEventListenerAny extends EqEventListener<any> {}

export interface DelegateObject {
  on<T extends Event>(elem: Element, event: string, callback: EqEventListener<T>): () => void;
  one<T extends Event>(elem: Element, event: string, callback: EqEventListener<T>): () => void;
  off(): void;
}
  
export interface EqEvent {
  isEqEvent: boolean;
  stoppedImmediatePropagation: boolean;
  stoppedPropagation: boolean;
}
export interface IElementCollection {
  get length(): number;
  get $elements(): Element[];
  [Symbol.iterator](): IterableIterator<Element>;
  forEach(cb: (elem?: Element, i?: number) => void): void;
  map<T>(cb: (elem?: Element, i?: number) => T): T[];
  filter(selector: wrapType | ((elem?: Element, i?: number) => boolean)): IElementCollection;
  some(cb: (elem: Element, i: number) => boolean): boolean;
  every(cb: (elem: Element, i: number) => boolean): boolean;
  slice(start?: number, end?: number): IElementCollection;
  sort(callback?: sortCallback): this;
  reverse(): this;
  unique(): IElementCollection;
  toArray(): Element[];
  toSet(): Set<Element>;
  is(selector: wrapType): boolean;
  not(selector: wrapType): IElementCollection;
  has(selector: wrapType): IElementCollection;
  find(selector: wrapType | search): IElementCollection;
  on<T extends Event>(events: {
      [ev: string]: EqEventListener<T>;
  }, options?: AddEventListenerOptions): this;
  on<T extends Event>(events: string, callback: EqEventListener<T>, options?: AddEventListenerOptions): this;
  off(events?: string, callback?: EqEventListenerAny): this;
  trigger(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): this;
  one<T extends Event>(events: string | {
      [ev: string]: EqEventListener<T>;
  }, callback?: EqEventListener<T> | AddEventListenerOptions, options?: AddEventListenerOptions): this;
  delegate(): DelegateObject;
  click(callback?: EqEventListener<MouseEvent>, options?: AddEventListenerOptions): this;
  hover(handlerIn: EqEventListener<MouseEvent>, handlerOut?: EqEventListener<MouseEvent>): this;
  attr(key: string | {
      [attr: string]: string | number;
  }, set?: string | number): string | this;
  removeAttr(key: string): this;
  val(set?: boolean | string | number | string[]): string | number | string[] | boolean | FileList;
  vals(set?: {
      [name: string]: boolean | string | number | string[];
  }): {
      [name: string]: boolean | string | number | string[] | FileList;
  };
  scrollTop(set?: number): any;
  scrollLeft(set?: number): any;
  label(set?: string): string | this;
  data(key: string | {
      [data: string]: any;
  }, set?: any): any;
  removeData(key: string): this;
  addClass(name: string): this;
  removeClass(name: string): this;
  toggleClass(name: string | {
      [clas: string]: boolean;
  }, force?: boolean): this;
  hasClass(name: string): boolean;
  once(identifier: any): IElementCollection;
  get(index: number): Element;
  index(selector?: wrapType): number;
  first(): IElementCollection;
  last(): IElementCollection;
  eq(index: number): IElementCollection;
  next(selector?: string): IElementCollection;
  nextUntil(selector?: string | Element, filter?: string): IElementCollection;
  nextAll(selector?: string): IElementCollection;
  prev(selector?: string): IElementCollection;
  prevUntil(selector?: string | Element, filter?: string): IElementCollection;
  prevAll(selector?: string): IElementCollection;
  siblings(selector?: string): IElementCollection;
  children(selector?: string): IElementCollection;
}

export type selector = Element|IElementCollection|Iterable<Element>|string
export type wrapType = selector|selector[];

export function ownerDoc(coll: IElementCollection): HTMLDocument|undefined {
  return coll.get(0)?.ownerDocument;
}

export default function createClass(sanitizer: () => HTMLSanitizer): {
  getStore: <T>(elem: Node, store: string, defaultValue?: T) => T,
  deleteStore: (elem: Element, store: string) => boolean,
  ElementCollection: new (item?: number|Element, ...items: Element[]) => IElementCollection,
  wrap: (selector: wrapType, context: IElementCollection|Document) => IElementCollection,
  defaultDelegateObject: DelegateObject
} {

  const arrs: WeakMap<IElementCollection, Element[]> = new WeakMap();
  function arr(coll: IElementCollection): Element[] {
    return arrs.get(coll) || [];
  }

  const defaultDelegateObject: DelegateObject = {
    on<T extends Event>(elem: Element, event: string, callback: (e: T&EqEvent) => void) {
      const $el = wrap(elem, elem.ownerDocument);
      $el.on(event, callback);
      return () => $el.off(event, callback);
    },
    one<T extends Event>(elem: Element, event: string, callback: (e: T&EqEvent) => void) {
      const $el = wrap(elem, elem.ownerDocument);
      $el.one(event, callback);
      return () => $el.off(event, callback);
    },
    off() {}
  }
  
  /**
   * elementWrapper collection of Elements with mimicked jQuery api.
   * @class ElementCollection
   */
  class ElementCollection implements IElementCollection {
  
    constructor(item?: number|Element, ...items: Element[]) {
      arrs.set(this, new Array(item, ...items) as Element[]);
    }

    get length(): number {
      return arr(this).length;
    }
  
    get $elements(): Element[] {
      return [...arr(this)];
    }
  
    [Symbol.iterator]() {
      return this.$elements[Symbol.iterator]();
    }
  
    forEach(cb: (elem?: Element, i?: number) => void) {
      this.$elements.forEach(cb);
    }
  
    map<T>(cb: (elem?: Element, i?: number) => T): T[] {
      return this.$elements.map(cb);
    }
  
    filter(selector: wrapType|((elem?: Element, i?: number) => boolean)): IElementCollection {
      return filter(this, selector);
    }
  
    some(cb: (elem: Element, i: number) => boolean): boolean {
      return this.$elements.some(cb);
    }
  
    every(cb: (elem: Element, i: number) => boolean): boolean {
      return this.$elements.every(cb);
    }
  
    slice(start?: number, end?: number): IElementCollection {
      return new ElementCollection(...arr(this).slice(start, end));
    }
  
    sort(callback?: sortCallback) {
      if(!callback) {
        arr(this).sort((a, b) => {
          if( a === b) return 0;
          if( a.compareDocumentPosition(b) & 2) {
              // b comes before a
              return 1;
          }
          return -1;
        });
      } else {
        let sorted = this.$elements.sort(callback);
        arrs.set(this, sorted);
      }
      return this;
    }
  
    reverse() {
      arr(this).reverse();
      return this;
    }
  
    /**
     * Remove any duplicate elements.
     */
    unique() {
      return from(this.toSet());
    }
  
    /**
     * Convert to Array.
     */
    toArray() {
      return this.$elements;
    }
  
    /**
     * Convert to Set.
     */
    toSet() {
      let res = new Set<Element>();
      this.forEach((elem) => res.add(elem));
      return res;
    }
    
    /**
     * Element.matches() 
     */
    is(selector: wrapType): boolean {
      if (typeof selector === 'string') {
        return this.some((elem) => elem.matches(selector as string));
      }
  
      let sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      return this.some((elem) => sel.has(elem));
    }
    
    /**
     * Filter by !Element.matches().
     */
    not(selector: wrapType): IElementCollection {
      if (typeof selector === 'string') {
        return filter(this, (elem, i) => !elem.matches(selector as any));
      }
      let sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      return filter(this, (elem, i) => !sel.has(elem));
    }
  
    has(selector: wrapType): IElementCollection {
      if (typeof selector === 'string') {
        let cache = new Set();
        return filter(this, (elem) => {
          if (cache.has(elem)) {
            return true;
          }
          /**  @type {ElementCollection} */
          let found = [...elem.querySelectorAll(':scope ' + selector)];
          found = found.concat(arr(parents(found)));
          found.forEach(e => cache.add(e));
          return found.length;
        });
      }
      const sel = selector instanceof ElementCollection ? selector : wrap(selector, this);
      return filter(this, (elem, i) => sel.some((test) => elem !== test && elem.contains(test)));
    }
    
    /**
     * Element.querySeletorAll()/Array.find()
     */
    find(selector: wrapType|search): IElementCollection {
      if (typeof selector === 'function') {
        let sel = selector;
        return new ElementCollection(arr(this).find((a, b, c) => sel(a, b)));
      }
      return wrap(selector, this);
    }
  
    /**
     * Element.addEventListener()
     */
    on<T extends Event>(events: {[ev: string]: EqEventListener<T>}, options?: AddEventListenerOptions): this;
    on<T extends Event>(events: string, callback: EqEventListener<T>, options?: AddEventListenerOptions): this;
    on<T extends Event>(events: string|{[ev: string]: EqEventListener<T>}, callback?: EqEventListener<T>|AddEventListenerOptions, options?: AddEventListenerOptions) {
      const cb: undefined|EqEventListener<T> = typeof callback === 'function' ? callback : undefined;
      const opt = typeof callback === 'function' ? options : callback;
      objectOrProp<EqEventListener<T>>(events, cb, (ev, handler) => {
        const h = (e: T) => handler(wrapEvent(e));
        this.forEach((elem) => {
          const store = getStore(elem, 'events', new Map<string, Map<EqEventListener<T>, EventListener>>());
          const evStore = store.get(ev) || new Map<EqEventListener<T>, EventListener>();
          evStore.set(handler, h);
          store.set(ev, evStore);
          elem.addEventListener(ev, h, opt);
        });
      });
      return this;
    }
    
    /**
     * Element.removeEventListener()
     */
    off(events?: string, callback?: EqEventListenerAny) {
      if (!events) {
        this.forEach((elem) => {
          const store =  getStore(elem, 'events', new Map<string, Map<EqEventListenerAny, EventListener>>());
          store.forEach((evStore, ev) => {
            evStore.forEach((h) => {
              elem.removeEventListener(ev, h);
            });
            evStore.clear();
          });
          store.clear();
        });
      } else {
        objectOrProp(events, callback || false, (ev, handler) => {
          this.forEach((elem) => {
            const store = getStore(elem, 'events', new Map<string, Map<EqEventListenerAny, EventListener>>());
            const evStore = store.get(ev) || new Map<EqEventListenerAny, EventListener>();
            if (handler) {
              const h = evStore.get(handler);
              if (!h) return;
              elem.removeEventListener(ev, h);
              evStore.delete(handler);
            } else {
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
  
    /**
     * Element.dispatchEvent()
     */
    trigger(eventType: string, detail: any = undefined, bubbles = true, cancelable = true) {
      const event = new CustomEvent(eventType, {bubbles, cancelable, detail});
      this.forEach((elem) => {
        elem.dispatchEvent(event);
      });
      return this;
    }
  
    /**
     * Element.addEventListener() - once
     */
  
    one<T extends Event>(events: string|{[ev: string]: EqEventListener<T>}, callback?: EqEventListener<T>|AddEventListenerOptions, options?: AddEventListenerOptions) {
      const cb: undefined|EqEventListener<T> = typeof callback === 'function' ? callback : undefined;
      const opt = typeof callback === 'function' ? options : callback;
      objectOrProp<EqEventListener<T>>(events, cb, (ev, handler) => {
        this.forEach((elem) => {
          const $el = wrap(elem, elem.ownerDocument);
          const evcb = (evt: T&EqEvent) => {
            $el.off(ev, evcb);
            handler(evt);
          };
          $el.on(ev, evcb, opt);
        });
      });
      return this;
    }
  
    delegate(): DelegateObject {
      const that = arr(this)[0];
      let del: DelegateObject = getStore(that, 'delegate');
      if (del) return del;
      const events = new WeakMap<Element, Map<string, Set<EqEventListenerAny>>>();
      const all: Map<string, Set<Set<EqEventListenerAny>>> = new Map();
      const once = new Set<EqEventListenerAny>();
      const started = new Map<string, () => void>();
      if (!that) return defaultDelegateObject;
      del = {
        on<T extends Event>(elem: Element, ev: string, handler: EqEventListener<T>) {
          const evs = events.get(elem) || new Map<string, Set<EqEventListenerAny>>();
          events.set(elem, evs);
          const subs: (() => void)[] = [];
          objectOrProp(ev, handler || false, (event, callback) => {
            let cbs = evs.get(event);
            let allCbs = all.get(event);
            if (!allCbs) {
              allCbs = new Set<Set<EqEventListenerAny>>();
              all.set(event, allCbs);
            }
            if (!cbs) {
              cbs = new Set();
              evs.set(event, cbs);
              allCbs.add(cbs);
            }
            cbs.add(callback);
            if (!started.has(event)) {
              const evcb = (e: T) => {
                let parent: Element = e.target as Element;
                const listeners: Set<EqEventListener<T>>[] = [];
                const elements: Element[] = [];
                do {
                  let lts;
                  if (lts = events.get(parent)?.get(event)) {
                    listeners.push(lts);
                    elements.push(parent);
                  }
                } while(parent != that && (parent = parent.parentElement))
                const eq = wrapEvent(e);
                listeners.forEach((handlers, i) => {
                  if (eq.stoppedPropagation) return;
                  handlers.forEach((handler) => {
                    if (eq.stoppedImmediatePropagation) return;
                    // eq.currentTarget = elements[i];
                    handler(eq);
                  });
                })
              }
              const remove = () => {
                all.delete(event);
                started.delete(event);
                that.removeEventListener(event, evcb, true);
              }
              that.addEventListener(event, evcb, true);
              started.set(event, remove)
            }
            subs.push(() => {
              cbs.delete(callback);
              if (cbs.size === 0) {
                evs.delete(event);
                allCbs.delete(cbs);
                if (allCbs.size === 0) {
                  started.get(event)?.()
                }
              }
            });
          });
          return () => {
            subs.forEach((sub) => sub());
          };
        },
        one<T extends Event>(elem: Element, event: string, callback:  EqEventListener<T>) {
          const cbev = (e: T&EqEvent) => {
            if (once.has(cbev)) {
              once.delete(callback);
              events.get(elem)?.get(event)?.delete(callback);
              if (events.get(elem)?.get(event).size === 0) {
                events.get(elem)?.delete(event);
              }
            }
            callback(e);
          }
          once.add(cbev);
          return this.on(elem, events, cbev);
        },
        off() {
          all.forEach((event) => event.forEach((cbs) => cbs.clear()));
          started.forEach((off) => off());
          started.clear();
          once.clear();
        }
      }
      getStore(that, 'delegate', del);
      return del;
    }
    
    /**
     * .on('click') alias. Adds accesibility support.
     */
    click(callback?: EqEventListener<MouseEvent>, options?: AddEventListenerOptions) {
      if (typeof callback === 'undefined') {
        return this.trigger('click', 1);
      }
      
      this
        .on('click', callback, options)
        .not('a[href], button, input, select, textarea')
        .once('eqAllyClick')
        .addClass('eq-ally-click')
        .on('keydown', (e: KeyboardEvent) => {
          if (e.key.toLowerCase() === 'enter' && e.currentTarget instanceof HTMLElement &&
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
  
    /**
     * Triggeer on mouseenter and mouseleave
     */
    hover(handlerIn: EqEventListener<MouseEvent>, handlerOut?: EqEventListener<MouseEvent>) {
      return this.on('mouseenter', handlerIn).on('mouseleave', handlerOut);
    }
    
    
    /**
     * Element.getAttribute()/setAttribute()
     */
    attr(key: string|{[attr: string]: string|number}, set?: string|number): string|this {
      if(objectOrProp(key, set, (k, v) => {
        this.forEach((elem) => {
          if (sanitizer().santizeAttribute(elem, k, v + "")) {
            elem.setAttribute(k, v + "");
          } else {
            throw new Error("Illegal attribute [" + k + "] value for <" + elem.nodeName.toLowerCase() + ">: " + v);
          }
        });
      })) return this;
      
      return (arr(this)[0] && typeof key === 'string') ? arr(this)[0].getAttribute(key) : null;
    }
  
    /**
     * Element.removeAttribute()
     */
    removeAttr(key: string) {
      this.forEach((elem) => {
        if (sanitizer().santizeAttribute(elem, key, "", false, true)) {
          elem.removeAttribute(key);
        } else {
          throw new Error("Not allowed to remove attribute [" + key + "] value for <" + elem.nodeName.toLowerCase() + ">");
        }
      });
      return this;
    }
    
    /**
     * Element.value
     */
    val(set?: boolean|string|number|string[]): string|number|string[]|boolean|FileList {
      if (typeof set !== 'undefined') {
        this.forEach((elem: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement) => {
          if (elem instanceof HTMLInputElement) {
            if (elem.type === "checkbox" || elem.type === "radio") {
              if (set === elem.value || set === true) {
                elem.setAttribute('checked', 'checked');
              } else {
                elem.removeAttribute('checked');
              }
            } else if (elem.type !== 'file' || !set) {
              elem.value = set + "";
            }
          } else if (elem instanceof HTMLSelectElement) {
            const values = set instanceof Array ? set : [set];
            [...elem.options].forEach((opt) => {
              opt.selected = values.includes(opt.value);
            });
          } else {
            elem.value = set + "";
          }
          if (elem instanceof HTMLTextAreaElement 
              || (elem instanceof HTMLInputElement && (!elem.type || elem.type === 'text' || elem.type === 'tel'))) {
            new ElementCollection(elem).trigger('input');
          } else {
            new ElementCollection(elem).trigger('change');
          }
        })
        return set;
      }
      const elem = arr(this)[0];
      if (!elem) return;
      if (elem instanceof HTMLInputElement) {
        if (elem.type === "checkbox") {
          return elem.checked;
        }
        if(elem.type === "radio") {
          if (elem.checked) {
            return elem.value;
          }
          return undefined;
        }
        if (elem.type === "number" || elem.type === "range") {
          return +elem.value;
        }
        if (elem.type === "file") {
          return elem.files;
        }
        return elem.value
      } else if (elem instanceof HTMLSelectElement) {
        const res = [...elem.options].filter((opt) => {
          return opt.selected;
        }).map((opt) => opt.value);
        if (elem.multiple) {
          const ret = getStore<string[]>(elem, 'multiSelect', []);
          ret.length = 0;
          ret.push(...res);
          return ret;
        }
        return res.pop();
      }
      return (<HTMLTextAreaElement>elem)?.value;
    }
  
    vals(set?: {[name: string]: boolean|string|number|string[]}): {[name: string]: boolean|string|number|string[]|FileList} {
      const $elems = wrap([this.filter('input[name], select[name], textarea[name]'), this.find('input[name], select[name], textarea[name]')], this);
      let res: {[name: string]: boolean|string|number|string[]|FileList} = {}
      if (set === undefined) {
        $elems.forEach((elem: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement) => {
          if (!elem.name) return;
          if (elem instanceof HTMLInputElement && elem.type === 'radio') {
            res[elem.name] = res[elem.name];
            if (elem.checked) {
              res[elem.name] = elem.value;
            }
          } else {
            res[elem.name] = wrap(elem, elem.ownerDocument).val();
          }
        });
      } else {
        $elems.forEach((elem: HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement) => {
          if (set[elem.name] === undefined) return;
          res[elem.name] == set[elem.name];
          if (elem instanceof HTMLInputElement && elem.type === 'radio') {
            elem.checked = set[elem.name] === elem.value;
          } else {
            wrap(elem, elem.ownerDocument).val(set[elem.name]);
          }
        });
      }
      return res;
    }
  
    /**
     * Element.textContent
     */
    text(set?: string) {
      return prop(this, 'textContent', set);
    }
  
    /**
     * Element.scrollTop
     */
    scrollTop(set?: number): any {
      return prop(this, 'scrollTop', set);
    }
  
    /**
     * Element.scrollLeft
     */
    scrollLeft(set?: number): any {
      return prop(this, 'scrollLeft', set);
    }
  
    /**
     * Get the label of the first element, as read by screen readers.
     */
    label(set?: string): string|this {
      if (typeof set === 'string') {
        return this.attr('aria-label', set);
      }
      
      if (!this.get(0)) return null;
  
      let get = (test: any) => test && test.length && test;
      const owner = this;
      return  get(this.attr('aria-label')) || 
              get(get(this.attr('aria-labelledby')) && wrap('#' + this.attr('aria-labelledby'), owner).label()) || 
              get(get(this.attr('id')) && wrap('label[for="'+ this.attr('id') + '"]', owner).label()) ||
              get(this.attr('title')) || 
              get(this.attr('placeholder')) ||
              get(this.attr('alt')) || 
              (get(this.text()) || "").trim();
    }
    
    /**
     * Store/retrieve abitrary data on the element.
     */
    data(key: string|{[data: string]: any}, set?: any): unknown {
      if(objectOrProp(key, set, (k, v) => {
        this.forEach((elem) => {
          let data = getStore<any>(elem, 'data', {});
          data[k] = v;
        });
      })) return this;
  
      if (!arr(this)[0]) return null;
  
      let data = getStore<any>(arr(this)[0], 'data') || {};
      return typeof key === 'undefined' ? data : (typeof key === 'string' ? data[key] : data);
    }
  
    /**
     * Removes previously stored data.
     */
    removeData(key: string) {
      this.forEach((elem) => {
        let data = getStore<any>(elem, 'data', {});
        delete data[key];
      });
  
      return this;
    }
    
    /**
     * Element.classList.add()
     */
    addClass(name: string) {
      return this.toggleClass(name + "", true);
    }
    
    /**
     * Element.classList.remove()
     */
    removeClass(name: string) {
      return this.toggleClass(name + "", false);
    }
    
    /**
     * Element.classList.toggle()
     */
    toggleClass(name: string|{[clas: string]: boolean}, force?: boolean) {
      const isObject = name instanceof Object;
      objectOrProp(name, force, (className, on) => {
        this.forEach((elem) => {
          elem.classList.toggle(className, isObject ? !!on : on);
        });
      });
      return this;
    }
  
    /**
     * Element.classList.contains()
     */
    hasClass(name: string) {
      let nameArr = name.split(' ');
      return this.some((elem) => nameArr.every((className) => elem.classList.contains(className)));
    }
    
    /**
     * Filter elements that were not called by this function with the given identifier before.
     */
    once(identifier: any) {
      identifier = typeof identifier === 'undefined' ? 'once' : identifier;
      let res = filter(this, (elem, i) => {
        let once = getStore(elem, 'once', new Set());
        if(!once.has(identifier)) {
          once.add(identifier);
          return true;
        }
        return false;
      });
  
      if(typeof identifier === 'function') {
        res.forEach(identifier);
      }
  
      return res;
    }
  
    /**
     * Get element.
     */
    get(index: number): undefined|Element {
      index = +index;
      return arr(this)[index < 0 ? this.length + index : index];
    }
  
    /**
     * Get index of matching selector within current elements.
     */
    index(selector?: wrapType) {
      let ind = 0;
      if (typeof selector === 'undefined') {
        return this.first().prevAll().length;
      } else if (typeof selector === 'string') {
        this.forEach((elem) => !(elem.matches(selector) || (ind++ || false)));
        return ind >= this.length ? -1 : ind;
      }
  
      const sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      this.forEach((elem) => !(sel.has(elem) || (ind++ && false)));
  
      return ind >= this.length ? -1 : ind;
    }
  
    /**
     * Get first element.
     */
    first() {
      return this.eq(0);
    }
  
    /**
     * Get last element.
     */
    last() {
      return this.eq(-1);
    }
  
    /**
     * Get element.
     */
    eq(index: number) {
      const res = new ElementCollection(1);
      const elem = this.get(index);
      if (elem) arr(res)[0] = elem;
      else arr(res).pop();
      return res;
    }
  
    /**
     * Element.nextElementSibling
     */
    next(selector?: string) {
      return new ElementCollection(...this.map((elem, i) => elem.nextElementSibling)).filter((elem, i) => {
        return elem && (!selector || elem.matches(selector));
      });
    }
  
    /**
     * Element.nextElementSibling
     * @returns {IElementCollection}
     */
    nextUntil(selector?: string|Element, filter?: string): IElementCollection {
      return from(propElem(this, 'nextElementSibling', filter, true, false, selector)).sort();
    }
  
    /**
     * Element.nextElementSibling
     */
    nextAll(selector?: string) {
      return this.nextUntil(undefined, selector);
    }
  
    /**
     * Element.previousElementSibling
     */
    prev(selector?: string) {
      return new ElementCollection(...this.map((elem) => elem.previousElementSibling)).filter((elem, i) => {
        return elem && (!selector || elem.matches(selector))
      });
    }
  
    /**
     * Element.previousElementSibling
     */
    prevUntil(selector?: string|Element, filter?: string): IElementCollection {
      return from(propElem(this, 'previousElementSibling', filter, true, false, selector, true)).sort().reverse();
    }
  
    /**
     * Element.previousElementSibling
     */
    prevAll(selector?: string) {
      return this.prevUntil(undefined, selector);
    }
  
    /**
     * Get all sibling elements.
     */
    siblings(selector?: string) {
      return wrap([
        propElem(this, 'nextElementSibling', selector, true),
        propElem(this, 'previousElementSibling', selector, true, false, undefined, true)
      ], this);
    }
    
    /**
     * Element.children
     */
    children(selector?: string) {
      return from(propElem(this.map((elem) => elem.firstElementChild), 'nextElementSibling', selector, true, true));
    }

    iframeInner() {
      let elem = this.get(0);
      if (!(elem instanceof HTMLIFrameElement)) {
        return new ElementCollection();
      }
      return new ElementCollection(elem.contentDocument.body);
    }
  
  }
  
  function wrapEvent<T extends Event>(originalEvent: (T|(T & EqEvent))): T & EqEvent {
    if ((<(T & EqEvent)>originalEvent).isEqEvent) {
      return originalEvent as (T & EqEvent);
    }
    let stoppedImmediatePropagation: boolean = false
    let stoppedPropagation: boolean = false;
    let currentTarget: EventTarget = originalEvent.currentTarget;
    const sip = originalEvent.stopImmediatePropagation;
    const sp = originalEvent.stopPropagation;
    const props: PropertyDescriptorMap = {
      isEqEvent: {
        value: true
      },
      stoppedPropagation: {
        get: () => stoppedPropagation
      },
      stopppedImmediatePropagation: {
        get: () => stoppedImmediatePropagation
      },
      stopPropagation: {
        value: (...args: any[]) => {
          stoppedPropagation = true;
          return sp.call(originalEvent)
        }
      },
      stopImmediatePropagation: {
        value: (...args: any[]) => {
          stoppedPropagation = true;
          stoppedImmediatePropagation = true;
          return sip.call(originalEvent)
        }
      },
      currentTarget: {
        get: () => currentTarget,
        set: (val: any) => currentTarget = val
      },
    }
    for (let prop in originalEvent) {
      if (props[prop]) continue;
      if (typeof (originalEvent as any)[prop] === 'function') {
        const fn = (originalEvent as any)[prop];
        props[prop] = {
          get: () => (...args: any[]) => fn.call(originalEvent, ...args)
        }
      } else if (prop !== 'isTrusted') {
        props[prop] = {
          value: (originalEvent as any)[prop]
        }
      }
    }
    return Object.defineProperties(originalEvent, props) as T & EqEvent;
  }

  /**
   * Query function to get elements
   * @param {wrapType} selector 
   * @param {IElementCollection|HTMLDocument} context trusted to be HTMLDocument or ElementCollection
   * @returns {ElementCollection}
   */
  function wrap(selector: wrapType, context: IElementCollection|HTMLDocument): IElementCollection {
    if (!selector) return new ElementCollection();
    if (!context && (selector instanceof NodeList || selector instanceof HTMLCollection)) {
      return from(selector);
    }
    if (!context) return new ElementCollection();
    let doc = context instanceof ElementCollection ? ownerDoc(context) : context as HTMLDocument;
    if (!doc) return new ElementCollection();
    
    let selectors: Array<unknown> = selector instanceof Array ? selector : [selector];
    let $context = context instanceof ElementCollection ? context : new ElementCollection(doc.documentElement);
    let elems = new Set<Element>();
    let doFilter = true;
    let doSort = selectors.length > 1;
    if ((selectors.length === 1 && $context.length === 1 && selectors[0] === arr($context)[0]) || $context === selector) return $context;
  
    for (let sel of selectors) {
      if (sel instanceof Element) {
        elems.add(sel);
      } else if (typeof sel === 'string') {
        let s = sel;
        $context.forEach((cElem) => {
          cElem.querySelectorAll(':scope ' + s).forEach((elem) => elems.add(elem));
        });
        if (selectors.length === 1) {
          doFilter = false;
          doSort = false;
        }
      } else if (isIterable(sel)) {
        for (let elem of sel) {
          if(elem instanceof Element) {
            elems.add(elem);
          }
        }
      }
    }
  
    let res = from(elems);
  
    // Filter within context
    if (doFilter) {
      res = filter(res, (elem, i) => {
        return $context.some((cont) => cont !== elem && cont.contains(elem));
      });
    }
  
    // Sort by apppearance
    if (doSort) {
      res = res.sort();
    }
    return res;
  }
  
    
    /**
     * Filter elements that match selector, or Array.filter() if selector is a function.
     */
    function filter(elems: IElementCollection, selector?: wrapType|search): IElementCollection {
      if (!selector) return new ElementCollection(...arr(elems).filter((elem) => elem instanceof Element));
      if (typeof selector === 'function') {
        return new ElementCollection(...arr(elems).filter(selector));
      }
      if (typeof selector === 'string') {
        return filter(elems, (elem) => elem.matches(selector));
      }
      const sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      return filter(elems, (elem) => sel.has(elem));
    }
  
  /**
   * Set/get element property.
   * @param {ElementCollection} elems 
   * @param {string|Object} key 
   * @param {*} [set] 
   * @returns {ElementCollection|*}
   */
  function prop(elems: IElementCollection, key: string, set: any) {
    if(objectOrProp(key, set, (k, v) => {
      elems.forEach((elem: any) => {
          elem[k] = v;
      });
    })) return elems;
  
    return arr(elems)[0] ? (<any>arr(elems)[0])[key] : null;
  }
  
  
  function parents(elems: IElementCollection|Array<Element>, selector?: string) {
    return from(propElem(elems, 'parentNode', selector, true)).sort().reverse();
  }
  
  /**
   * Get element from another element's property recursively, filtered by selector.
   * @param {IElementCollection|Array<Element>} collection 
   * @param {string} prop 
   * @param {string|undefined} selector 
   * @param {boolean|undefined} multiple 
   * @param {boolean|undefined} includeFirst 
   * @param {string|Element|undefined} stopAt 
   * @param {boolean|undefined} reverse 
   * @returns {Set<Element>}
   */
  function propElem(collection: IElementCollection|Array<Element>, prop: string, selector?: string, multiple?: boolean, includeFirst?: boolean, stopAt?: string|Element, reverse?: boolean): Set<Element> {
    let res = new Set<Element>();
    let cache = new Set<Element>();
    let sSelector = typeof selector === 'string' ? selector : undefined;
    let is = (elem: Element, sel?: string|Element) => {
      if (!(elem instanceof Element)) return false;
      if (!sel) return true;
      if (typeof sel === 'string') return elem.matches(sel);
      if (sel instanceof Array) return sel.includes(elem);
      return elem === sel;
    };
    let coll: unknown[] = [];
    if (collection instanceof ElementCollection) {
      coll = arr(collection);
    } else if(collection instanceof Array) {
      coll = collection;
    }
    for (let i = reverse ? coll.length - 1 : 0; reverse ? i >= 0 : i < coll.length; reverse ? i-- : i++) {
      let elem = coll[i];
      if (!elem || !(elem instanceof Element)) continue;
      if (cache.has(elem)) continue;
      cache.add(elem);
      let next = (<any>elem)[prop];
      if (includeFirst) {
        next = elem;
      }
      if (!next || (stopAt && is(next, stopAt))) continue;
      do {
        if (is(next, sSelector)) {
          res.add(next);
        }
        cache.add(next);
      } while (multiple && next && (next = next[prop]) && !cache.has(next) && (!stopAt || !is(next, stopAt)))
    }
  
    return res;
  }
  
  /**
   * @callback objectOrPropCallback
   * @param {string} key
   * @param {*} value
   */
  
  /**
   * Helper function for excuting by name/value or multiple object key/value pairs.
   * @param {string|object} name the string may also be space separated for multi value.
   * @param {*} [set]
   * @param {objectOrPropCallback} each 
   * @returns {boolean} whether a key/value pair was provided.
   */
  function objectOrProp<T>(name: string|{[k:string]: T}, set: T|undefined|false, each: (k: string, v: T) => void) {
    let res = {};
    let wasSet = false;
    if (typeof name === 'string' && typeof set !== 'undefined') {
      wasSet = true;
      name.split(' ').forEach((n) => (<any>res)[n] = set);
    } else if (name && typeof name === 'object') {
      wasSet = true;
      res = name;
    }
    for (let i in res) {
      each(i, (<any>res)[i]);
    }
    return wasSet;
  }
  
  /**
   * Faster Array.from().
   * @param {Object} object 
   * @param {typeof Array|typeof ElementCollection} [Class] defaults to ElementCollection
   * @returns {*}
   */
  function from<T>(object: Array<Element>|Set<Element>|IElementCollection|NodeList|HTMLCollection): IElementCollection {
    if (typeof object !== 'object' || !object) return new ElementCollection(); 
    if (object instanceof ElementCollection) return object;
    let size = 0;
    if (object instanceof Array) {
      size = object.length;
    } else if(object instanceof Set) {
      size = object.size;
    } else {
      return new ElementCollection(...[...object].filter((el) => el instanceof Element) as Element[]);
    }
    const res = new ElementCollection(size);
    let objArr = arr(res);
    let i = 0;
    for (let item of object) {
      objArr[i++] = item;
    }
    return res;
  }
  
  /**
   * Get a storage container associated with an element.
   */
  function getStore<T>(elem: Node, store: string, defaultValue?: T): T {
    if(!elementStorage.has(elem)) {
      if (defaultValue === undefined) return;
      elementStorage.set(elem, new Map<string, T>());
    }
  
    let types = elementStorage.get(elem);
    if(typeof defaultValue !== 'undefined' && !types.has(store)) {
      types.set(store, defaultValue);
    }
  
    return types.get(store);
  }
  
  function deleteStore(elem: Element, store: string) {
    return elementStorage.get(elem)?.delete(store);
  }

  return {
    wrap,
    ElementCollection,
    getStore, deleteStore, defaultDelegateObject
  }
  
}

