// @ts-check

import Sandbox from '@nyariv/sandboxjs';
import createClass, { EqEvent, wrapType, DelegateObject } from './eQuery'
import { IElementCollection } from './eQuery';
import HTMLSanitizer from './HTMLSanitizer';

const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;

function isIterable (object: any): object is Iterable<unknown> {
  return object !== null && typeof object === 'object' && typeof object[Symbol.iterator] === 'function';
}

function isObject (object: any): object is {[key: string]: unknown} {
  return object !== null && typeof object === 'object';
}

function getRootElement(scopes: IElementScope[]): Element {
  return scopes[0]?.$el.get(0);
}

export class Component {}
  
const closings: any = {
  "(": ")",
  "{": "}",
  "[": "]"
}

const quotes = ["'", '"', "`"];

function walkText(s: string, endJs: string = null) {
  let strings = [];
  let quote = null;
  let closing = null;
  let escape = false;
  let inJs = !!endJs;
  let start = 0;
  let i = 0;
  for (; i < s.length; i++) {
    const char = s[i];
    const next = s[i+1];
    if (inJs) {
      if (quote) {
        if (!escape && quote === char) {
          quote = null;
        } else if (char === '\\') {
          escape = !escape;
        } else if (!escape && quote === '`' && char === "$" && next === "{") {
          const strs = walkText(s.substring(i + 2), "}");
          i += strs[0].length + 2;
        }
      } else if (quotes.includes(char)) {
        quote = char;
      } else if (closing) {
        if (closings[closing] === char) {
          closing = null;
        }
      } else if (closings[char]) {
        closing = char;
      } else if (char === endJs) {
        strings.push(s.substring(start, i));
        return strings;
      } else if (char === "}" && next === "}") {
        strings.push(s.substring(start, i + 2));
        inJs = false;
        i += 1;
        start = i + 1;
      }
    } else {
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
  
const calls: (() => void)[] = [];
let timer: any;
function call(cb: () => void) {
  calls.push(cb);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    let toCall = [...calls];
    calls.length = 0;
    for (let c of toCall) {
      try {
        c();
      } catch (err) {
        console.error(err);
      }
    }
  });
}

interface IElementScope {
  $el: IElementCollection;
  $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
  $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void};
  $delay(ms: number): Promise<void>;
}
interface IRootScope extends IElementScope {
  $refs: {[name: string]: IElementCollection};
  $wrap(element: wrapType): IElementCollection;
}
  
export interface DirectiveExec {
  element: Element,
  directive: string,
  js: string,
  original: string,
  subs: subs,
  delegate: DelegateObject
}
  
export type sub = (() => void)|sub[];
export type subs = sub[];

function walkerInstance() {
  const execSteps: ((scopes: IElementScope[]) => void)[] = [];
  return {
    ready: (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb),
    run: function runNested(scopes: IElementScope[]) {
      execSteps.forEach((cb) => cb(scopes))
    }
  }
}
function runDirective(skope: Skope, exec: DirectiveExec, scopes: IElementScope[]) {
  if (skope.directives[exec.directive]) {
    return skope.directives[exec.directive](exec, scopes);
  }
  return [];
}

function initialize (skope: Skope) {
  const eQuery = createClass(() => skope.sanitizer);
  const { wrap, ElementCollection, getStore, deleteStore, $document, defaultDelegateObject} = eQuery;
  skope.defaultDelegateObject = defaultDelegateObject;
  skope.getStore = getStore;
  skope.deleteStore = deleteStore;
  skope.wrap = wrap;
  
  class ElementScope implements IElementScope {
    $el: IElementCollection;
    constructor(element: Element) {
      this.$el = wrap(element);
    }
  
    $dispatch(eventType: string, detail?: any, bubbles = true, cancelable = true) {
      this.$el.trigger(eventType, detail, bubbles, cancelable);
    }
  
    $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void} {
      const subUnsubs = skope.watch(cb, callback);
      const sub = getStore(this.$el.get(0), 'currentSubs', []);
      sub.push(subUnsubs);
      return { unsubscribe: () => unsubNested(subUnsubs) };
    }
    $delay(ms: number) {
      return new Promise<void>((res) => setTimeout(res, ms));
    }
  }

  class RootScope extends ElementScope {
    $refs: {[name: string]: IElementCollection} = {};
    $wrap(element: wrapType) {
      return wrap(element, this.$el);
    }
  }
  
  ElementCollection.prototype.html = function (content?: string|Node|IElementCollection) {
    if (content === undefined) {
      return this.get(0)?.innerHTML;
    }
    let contentElem: Node;
    if (content instanceof ElementCollection) {
      content = (content as any).detach();
    }
    let elem = this.get(0);
    if (!elem) return this;
    contentElem = preprocessHTML(skope, content as any);
    const currentSubs: subs = getStore<subs>(elem, 'currentSubs', []);
    for (let el of [...elem.children]) {
      unsubNested(getStore<subs>(el, 'currentSubs'));
    }
    const processed = processHTML(skope, contentElem, currentSubs, defaultDelegateObject);
    elem.innerHTML = '';
    elem.appendChild(processed.elem);
    processed.run(getScopes(skope, elem, currentSubs, {}));
    return this;
  };
  ElementCollection.prototype.text = function (set?: string) {
    if (set !== undefined) {
      this.forEach((elem: Element) => {
        unsubNested(getStore<subs>(elem, 'childSubs'));
        elem.textContent = set;
      });
      return this;
    }
    return this.get(0)?.textContent.trim();
  };
  ElementCollection.prototype.detach = function () {
    const contentElem = document.createElement('template');
    for (let elem of this) {
      unsubNested(getStore<subs>(elem, 'currentSubs'));
      contentElem.appendChild(elem);
    };
    return contentElem.content;
  };
  skope.RootScope = RootScope;
  skope.ElementScope = ElementScope;
  skope.prototypeWhitelist.set(FileList, new Set());
  skope.prototypeWhitelist.set(File, new Set());
  skope.prototypeWhitelist.set(RootScope, new Set());
  skope.prototypeWhitelist.set(ElementCollection, new Set());
  skope.prototypeWhitelist.set(ElementScope, new Set());
  skope.ElementCollection = ElementCollection
  
  skope.defineDirective('show', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(watchRun(skope, scopes, exec.js), (val, lastVal) => {
      exec.element.classList.toggle('hide', !val);
    });
  });
  
  skope.defineDirective('text', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(watchRun(skope, scopes, exec.js), (val, lastVal) => {
      //@ts-ignore
      skope.wrap(exec.element).text(val + "");
    });
  });
  
  skope.defineDirective('ref', (exec: DirectiveExec, scopes: IElementScope[]) => {
    if (!exec.js.match(regVarName)) {
      throw createError('Invalid ref name: ' + exec.js, exec.element);
    }
    const name = getScope(skope, exec.element, [], {name: exec.js.trim()});
    skope.run(document, `$refs[name] = $wrap([...($refs[name] || []), $el])`, [...scopes, name]);
    return [() => {
      skope.run(document, `$refs[name] = $refs[name].not($el)`, [...scopes, name]);
    }];
  });
  
  skope.defineDirective('model', (exec: DirectiveExec, scopes: IElementScope[]) => {
    const el: any = exec.element;
    const isContentEditable = (el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''));
    const $el: any = skope.wrap(el);
    let last: any = !isContentEditable ? $el.val() : $el.html();
    if (!el.hasAttribute('name')) {
      el.setAttribute('name', exec.js.trim());
    }
    let reset = false;
    const change = () => {
      last = !isContentEditable ? $el.val() : $el.html();
      skope.run(getRootElement(scopes), exec.js.trim() + ' = ($$value === undefined && !reset) ? ' + exec.js.trim() + ' : $$value', pushScope(skope, scopes, el, exec.subs, {$$value: last, reset}));
      reset = false;
    }
    const sub: subs = [];
    sub.push(exec.delegate.on(el, 'input', change));
    if (el.form) {
      const $form = skope.wrap(el.form);
      sub.push($form.delegate().on($form.get(0), 'reset', () => reset = !!setTimeout(change)));
    }
    Promise.resolve().then(() => {
      sub.push(skope.watch(watchRun(skope, scopes, exec.js.trim()), (val, lastVal) => {
        if (val === last) return;
        if (isContentEditable) {
          $el.html(val + "");
        } else {
          $el.val(val as any);
        }
      }));
    });
    return sub;
  });
  
  skope.defineDirective('html', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(watchRun(skope, scopes, exec.js), (val, lastVal) => {
      if (val instanceof Node || typeof val === 'string' || val instanceof this.ElementCollection) {
        //@ts-ignore
        skope.wrap(exec.element).html(val);
      }
    });
  });

  skope.defineDirective('transition', (exec: DirectiveExec, scopes: IElementScope[]) => {
    const $el = skope.wrap(exec.element);
    $el.addClass('s-transition');
    $el.addClass('s-transition-idle');
    let lastPromise: Promise<unknown>;
    return skope.watch(watchRun(skope, scopes, exec.js), (val, lastVal) => {
      if (val === undefined || lastPromise !== val) {
        $el.addClass('s-transition-idle');
        $el.removeClass('s-transition-active');
        $el.removeClass('s-transition-done');
        $el.removeClass('s-transition-error');
      }
      if (val instanceof Promise) {
        lastPromise = val;
        $el.removeClass('s-transition-idle');
        $el.addClass('s-transition-active');
        val.then(() => {
          if(lastPromise !== val) return;
          $el.removeClass('s-transition-active');
          $el.addClass('s-transition-done');
        }, () => {
          if(lastPromise !== val) return;
          $el.removeClass('s-transition-active');
          $el.addClass('s-transition-error');
        })
      }
    })
  });
}

function getScope(skope: Skope, element: Element, subs: subs, vars: {[variable: string]: any} = {}, root = false) {
  let scope = skope.getStore<IElementScope>(element, 'scope');
  if (!scope) {
    skope.getStore<subs>(element, 'currentSubs', subs);
    scope = skope.getStore<IElementScope>(element, 'scope', root ? new skope.RootScope(element) : new skope.ElementScope(element));
    subs.push(() => {
      scope.$el = null;
      skope.deleteStore(element, 'currentSubs');
      skope.deleteStore(element, 'scope');
    });
  }
  Object.assign(scope, vars);
  return scope;
}

function getScopes(skope: Skope, element: Element, subs: subs = [], newScope?: {[variable: string]: any}): IElementScope[] {
  if (!element) return [];
  const scope = newScope === undefined ? skope.getStore<IElementScope>(element, 'scope') : getScope(skope, element, subs, newScope);
  const scopes: IElementScope[] = [];
  if (scope) scopes.push(scope);
  return [...(element.hasAttribute('s-detached') ? [] : getScopes(skope, element.parentElement)), ...scopes];
}


function watchRun(skope: Skope, scopes: IElementScope[], code: string): () => unknown {
  return () => skope.run(getRootElement(scopes), 'return ' + code, scopes);
}

function watchRunAsync(skope: Skope, scopes: IElementScope[], code: string): () =>Promise<unknown> {
  return () => skope.runAsync(getRootElement(scopes), 'return ' + code, scopes);
}

function preprocessHTML(skope: Skope, html: Node|string): Node {
  let elem: DocumentFragment|Element;
  if (typeof html === 'string') {
    const template = document.createElement('template');
    template.innerHTML = html;
    elem = template.content;
  } else if (html instanceof Element) {
    elem = html;
  } else {
    return html;
  }
  skope.sanitizer.sanitizeHTML(elem);
  return elem;
}

function processHTML(skope: Skope, elem: Node, subs: subs, delegate: DelegateObject) {
  const exec = walkerInstance();
  walkTree(skope, elem, subs, exec.ready, delegate);
  return {
    elem: elem,
    run: exec.run
  }
}

function unsubNested(subs: sub) {
  if (!subs) return;
  if (typeof subs === 'function') {
    subs();
    return;
  }
  const s = subs.slice();
  subs.length = 0;
  s.forEach((unsub) => {
    if (Array.isArray(unsub)) {
      unsubNested(unsub);
    } else {
      unsub();
    }
  });
}

function pushScope(skope: Skope, scopes: IElementScope[], elem: Element, sub: subs, vars?: any) {
  const found = skope.getStore<IElementScope>(elem, 'scope');
  const scope = getScope(skope, elem, sub, vars);
  scopes = scopes.slice();
  scopes.push(scope);
  return scopes;
}

function createError(msg: string, el: Element) {
  const err = new Error(msg);
  (err as any).element = el;
  return err;
}

function walkTree(skope: Skope, element: Node, parentSubs: subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject) {
  let currentSubs: subs = [];
  parentSubs.push(currentSubs);
  if (element instanceof Element) {
    skope.getStore(element, 'currentSubs', parentSubs);
    const $element = skope.wrap(element);
    element.removeAttribute('s-cloak');
    if (element.hasAttribute('s-if')) {
      const comment = document.createComment('s-if');
      let ifElem: Element;
      const at = element.getAttribute('s-if');
      element.removeAttribute('s-if');
      element.before(comment);
      element.remove();
      skope.deleteStore(element, 'currentSubs');
      ready((scopes) => {
        skope.getStore<subs>(comment, 'currentSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs)
        currentSubs.push(skope.watch(watchRun(skope, scopes, at), (val, lastVal) => {
          if (val) {
            if (!ifElem) {
              ifElem = element.cloneNode(true) as Element;
              const processed = processHTML(skope, ifElem, nestedSubs, delegate);
              comment.after(processed.elem);
              processed.run(pushScope(skope, scopes, ifElem, nestedSubs));
            }
          } else {
            if (ifElem) {
              ifElem.remove();
              ifElem = undefined;
              unsubNested(nestedSubs);
            }
          }
        }));
      });
      return;
    }
    if (element.hasAttribute('s-for')) {
      const comment = document.createComment('s-for');
      element.after(comment);
      element.remove();
      skope.deleteStore(element, 'currentSubs');
      const items = new Set<Element>();
      let exp: string;
      const at = element.getAttribute('s-for');
      element.removeAttribute('s-for');
      let split = at.split(' in ');
      if (split.length < 2) {
        throw createError('In valid s-for directive: ' + at, element);
      } else {
        exp = split.slice(1).join(' in ');
      }
      const varsExp = split[0];
      const varMatch = varsExp.match(regVarName);
      let key: string;
      let value: string;
      if (varMatch) {
        value = varMatch[1];
      } else {
        const doubleMatch = varsExp.match(regKeyValName)
        if (!doubleMatch) throw createError('In valid s-for directive: ' + at, element);
        key = doubleMatch[1];
        value = doubleMatch[2];
      }
      ready((scopes) => {
        const del = skope.wrap(comment.parentElement).delegate();
        currentSubs.push(del.off);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs);
        currentSubs.push(watchAsync(skope, watchRunAsync(skope, scopes, exp), (val) => {
          unsubNested(nestedSubs);
          items.forEach((item) => {
            item.remove(); // @TODO: optimize
          });
          items.clear();
          const runs: (() => void)[] = [];
          const repeat = (item: unknown, i: number|string) => {
            const forSubs: subs = [];
            nestedSubs.push(forSubs);
            const scope: any = {$index: i};
            if (key) scope[key] = i;
            if (value) scope[value] = item;
            const elem = element.cloneNode(true) as Element;
            const processed = processHTML(skope, elem, forSubs, del);
            comment.before(processed.elem);
            items.add(elem);
            runs.push(() => processed.run(pushScope(skope, scopes, elem, forSubs, scope)));
          }
          let i = -1;
          if (isIterable(val)) {
            for (let item of val) {
              i++;
              repeat(item, i);
            }
          } else if (isObject(val)) {
            for (let i in val) {
              repeat(val[i], i);
            }
          }
          runs.forEach((run) => run());
        }, (err) => {
          unsubNested(nestedSubs);
          items.forEach((item) => {
            item.remove(); // @TODO: optimize
          });
          items.clear();
        }));
      });
      return;
    }
    if (element.hasAttribute('s-detached')) {
      let nestedScopes: IElementScope[];
      ready((scopes) => {
        nestedScopes = [getScope(skope, element, currentSubs, {}, true)];
      });
      const prevReady = ready;
      ready = (cb: (scopes: IElementScope[]) => void) => prevReady(() => cb(nestedScopes));
    }
    let elementScopeAdded = false;
    for (let att of element.attributes) {
      if (att.nodeName.startsWith("$")) {
        const name = att.nodeName.substring(1).replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());
        if (!name.match(regVarName)) {
          console.error(`Invalid variable name in attribute ${att.nodeName}`);
          continue;
        };
        if (!elementScopeAdded) {
          elementScopeAdded = true;
          const prevReady = ready;
          ready = (cb: (scopes: IElementScope[]) => void) => {
            prevReady((s: IElementScope[]) => {
              cb(pushScope(skope, s, element, currentSubs));
            });
          };
        }
        ready(scopes => {
          skope.runAsync(getRootElement(scopes), `let ${name} = ${att.nodeValue}`, scopes);
        });
      }
    }
    if (element instanceof HTMLScriptElement) {
      if (element.type === 'skopejs') {
        ready((scopes) => {
          skope.run(getRootElement(scopes), element.innerHTML, scopes);
        });
      } else {
        element.remove();
      }
      return;
    } else {
      for (let att of element.attributes) {
        if (att.nodeName.startsWith(':')) {
          const at = att.nodeName.slice(1);
          ready((scopes) => {
            currentSubs.push(skope.watch(watchRun(skope, scopes, att.nodeValue), (val: any, lastVal) => {
              if (typeof val === 'object' && ['style', 'class'].includes(at)) {
                if (at === 'class') {
                  $element.toggleClass(val);
                } else {
                  if (element instanceof HTMLElement || element instanceof SVGElement) {
                    for (let c in val) {
                      (<any>element.style)[c] = val[c];
                    }
                  }
                }
              } else {
                $element.attr(at, val + "");
              }
            }));
          });
        } else if (att.nodeName.startsWith('@')) {
          const transitionParts = att.nodeName.split('$');
          const parts = transitionParts[0].slice(1).split('.');
          const transitionVar = transitionParts[1]?.replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());;
          if (transitionVar) {
            if (!regVarName.test(transitionVar)) {
              console.error(`Invalid variable name in attribute ${att.nodeName}`);
              continue;
            }
          }
          ready((scopes) => {
            let trans: Promise<unknown>;
            const ev = (e: EqEvent) => {
              trans = skope.runAsync(getRootElement(scopes), att.nodeValue, pushScope(skope, scopes, element, currentSubs, {$event: e}));
              if (transitionVar) {
                skope.run(getRootElement(scopes), `${transitionVar} = trans`, pushScope(skope, scopes, element, currentSubs, {trans}));
              }
            }
            if (transitionVar) {
              skope.run(getRootElement(scopes), `if (typeof ${transitionVar} === 'undefined') var ${transitionVar}`, scopes);
            }
            if (parts[1] === 'once') {
              currentSubs.push(delegate.one(element, parts[0], ev));
            } else {
              currentSubs.push(delegate.on(element, parts[0], ev));
            }
          });
        } else if (att.nodeName.startsWith('s-')) {
          ready((scopes) => {
            currentSubs.push(runDirective(skope, {
              element,
              directive: att.nodeName.slice(2),
              js: att.nodeValue,
              original: element.outerHTML,
              subs: currentSubs,
              delegate
            }, pushScope(skope, scopes, element, currentSubs)));
          });
        }
      }
    }
  }
  if (element instanceof Element && element.hasAttribute('s-static')) {
  } else {
    const execSteps: ((scopes: IElementScope[]) => void)[] = [];
    const r = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    for (let el of [...element.childNodes]) {
      const execSteps: ((scopes: IElementScope[]) => void)[] = [];
      if (el instanceof Element) {
        walkTree(skope, el, currentSubs, r, delegate);
      } else if (el.nodeType === 3) {
        const strings = walkText(el.textContent);
        const nodes: Text[] = [];
        let found = false;
        strings.forEach((s) => {
          if (s.startsWith("{{") && s.endsWith("}}")) {
            found = true;
            const placeholder = document.createTextNode("");
            ready((scopes) => {
              currentSubs.push(watchAsync(skope, watchRunAsync(skope, scopes, s.slice(2, -2)), (val, lastVal) => {
                placeholder.textContent = val + "";
              }, (err) => {
                placeholder.textContent = "";
              }));
              return scopes;
            });
            nodes.push(placeholder);
          } else {
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
    }
    ready((scopes) => {
      for (let cb of execSteps) cb(scopes);
    });
  }
}

function watchAsync<T>(skope: Skope, toWatch: () => Promise<T>, handler: (val: T, lastVal: T|undefined) => void|Promise<void>, errorCb: (err: unknown) => void): subs {
  let lastVal: T;
  return skope.watch(toWatch, (val) => {
    val.then(async (v) => {
      handler(v, lastVal);
      lastVal = v;
    }, errorCb);
  });
}

export default class Skope {
  components: any = {};
  sanitizer: HTMLSanitizer;
  directives: {[name: string]: (exce: DirectiveExec, scopes: IElementScope[]) => subs} = {};

  globals = Sandbox.SAFE_GLOBALS;
  prototypeWhitelist = Sandbox.SAFE_PROTOTYPES;
  sandbox: Sandbox;
  sandboxCache: WeakMap<Node, {[code: string]: (...scopes: any[]) => any}> = new WeakMap();
  ElementCollection: new (item?: number|Element, ...items: Element[]) => IElementCollection;
  wrap: (selector: wrapType, context?: IElementCollection) => IElementCollection;
  defaultDelegateObject: DelegateObject;
  getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
  deleteStore: (elem: Element, store: string) => boolean;
  RootScope: new (el: Element) => IRootScope;
  ElementScope: new (el: Element) => IElementScope;

  constructor(options?: {sanitizer?: HTMLSanitizer}) {
    this.sanitizer = options?.sanitizer || new HTMLSanitizer();
    delete this.globals.Function;
    delete this.globals.eval;
    initialize(this);
    this.sandbox = new Sandbox({
      globals: this.globals, 
      prototypeWhitelist: this.prototypeWhitelist
    });
  }

  defineComponent(name: string, comp: Component) {
    this.components[name] = comp;
    if (comp.constructor !== {}.constructor && !this.prototypeWhitelist.has(comp.constructor)) {
      this.prototypeWhitelist.set(comp.constructor, new Set());
    }
  }
  
  watch<T>(toWatch: () => T, handler: (val: T, lastVal: T|undefined) => void|Promise<void>): subs {
    const watchGets: Map<any, Set<string>> = new Map();
    const subUnsubs: subs = [];
    let lastVal: any;
    let update = false;
    let start = Date.now();
    let count = 0;
    const digest = () => {
      if ((Date.now() - start) > 4000) {
        count = 0;
        start = Date.now();
      } else {
        if (count++ > 200) {
          throw new Error('Too many digests too quickly');
        }
      }
      unsubNested(subUnsubs);
      let g = this.sandbox.subscribeGet((obj: any, name: string) => {
        if (obj === undefined) return;
        const list = watchGets.get(obj) || new Set();
        list.add(name);
        watchGets.set(obj, list);
      });
      let val: any;
      try {
        val = toWatch();
      } catch (err) {
        g.unsubscribe();
        throw err;
      }
      g.unsubscribe();
      for (let item of watchGets) {
        const obj = item[0];
        for (let name of item[1]) {
          subUnsubs.push(this.sandbox.subscribeSet(obj, name, () => {
            if (update) return;
            update = true;
            call(() => {
              update = false;
              digest();
            });
          }).unsubscribe);
        }
      }
      watchGets.clear();
      if (val !== lastVal) {
        const temp = lastVal;
        lastVal = val;
        handler(val, temp);
      }
    }
    digest();
    return subUnsubs;
  }

  run(el: Node, code: string, scopes: IElementScope[]): unknown {
    el = el || document;
    let codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    const key = 'sync:' + code;
    codes[key] = codes[key] || this.sandbox.compile(code);
    try {
      return codes[key](...scopes);
    } catch (err) {
      const elem = scopes[scopes.length - 1]?.$el.get(0);
      err.element = elem;
      console.error(err);
      return undefined;
    };
  }

  runAsync(el: Node, code: string, scopes: IElementScope[]): Promise<unknown> {
    el = el || document;
    let codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    const key = 'async:' + code;
    codes[key] = codes[key] || this.sandbox.compileAsync(code);
    return codes[key](...scopes).catch((err: unknown) => {
      const elem = scopes[scopes.length - 1]?.$el.get(0);
      if (err instanceof Error) {
        (err as any).element = elem;
      }
      throw err;
    });
  }
  
  defineDirective(name: string, callback: (exce: DirectiveExec, scopes: IElementScope[]) => subs) {
    this.directives[name] = callback;
  }
  
  init(elem?: Element, component?: string, alreadyPreprocessed = false): {cancel: () => void} {
    const subs: subs = [];
    let sub = this.sanitizer.observeAttribute(elem || document.documentElement, 'skope', (el) => {
      const comp = component || el.getAttribute('skope');
      const scope = getScope(this, el, subs, this.components[comp] || {}, true);
      const processed = processHTML(this, el, subs, this.defaultDelegateObject);
      el.setAttribute('s-processed', '');
      processed.run([scope]);
    }, false);

    subs.push(sub.cancel);
  
    if (!alreadyPreprocessed) {
      sub = this.sanitizer.observeAttribute(elem || document.documentElement, 's-static', () => {}, true, true);
      subs.push(sub.cancel);
    }

    return {
      cancel() {
        unsubNested(subs);
      }
    }
  }
}
