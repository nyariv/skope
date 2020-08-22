// @ts-check

import Sandbox from '@nyariv/sandboxjs'
import { ElementCollection, wrap, EqEvent, wrapType, getStore, deleteStore, $document, DelegateObject, defaultDelegateObject } from './eQuery'
import { sanitizeHTML } from './HTMLSanitizer';

export const allowedGlobals = Sandbox.SAFE_GLOBALS;
export const allowedPrototypes = Sandbox.SAFE_PROTOTYPES;
export const sandbox = new Sandbox(allowedGlobals, allowedPrototypes);

const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;

function isIterable (object: any): object is Iterable<unknown> {
  return object !== null && typeof object === 'object' && typeof object[Symbol.iterator] === 'function';
}

function isObject (object: any): object is {[key: string]: unknown} {
  return object !== null && typeof object === 'object';
}


function walkFindSubs(elem: Node, up = false): subs {
  if (!elem) return [];
  let subs: subs = [];
  for (let el of (up ? [elem.parentNode] : elem.childNodes)) {
    const found = getStore<subs>(el, 'htmlSubs');
    if (found) {
      subs.push(found);
    } else {
      subs.push(...walkFindSubs(el));
    }
  }
  return subs;
}

declare module './eQuery' {
  interface ElementCollection {
    html(content?: string|Node|ElementCollection): this;
    text(set?: string): string|this;
    detach(): DocumentFragment;
  }
}

ElementCollection.prototype.html = function (content?: string|Node|ElementCollection) {
  if (content === undefined) {
    return this.get(0)?.innerHTML;
  }
  let contentElem: Node;
  if (content instanceof ElementCollection) {
    content = content.detach();
  }
  let elem = this.get(0);
  if (!elem) return this;
  contentElem = preprocessHTML(content);
  let subsNested: subs = [];
  const found = getStore<subs>(elem, 'childrenSubs', subsNested);
  if (found !== subsNested) {
    const subs: subs = getStore<subs>(elem, 'htmlSubs', []);
    subs.push(subsNested);
  }
  subsNested = found;
  unsubNested(subsNested);
  const processed = processHTML(contentElem, subsNested, defaultDelegateObject);
  elem.innerHTML = '';
  elem.appendChild(processed.elem);
  processed.run(getScopes(elem, {}, subsNested));
  return this;
};
ElementCollection.prototype.text = function (set?: string) {
  if (set !== undefined) {
    this.forEach((elem: Element) => {
      unsubNested(walkFindSubs(elem));
      elem.textContent = set;
    });
    return this;
  }
  return this.get(0)?.textContent.trim();
};
ElementCollection.prototype.detach = function () {
  const contentElem = document.createElement('template');
  for (let elem of this) {
    unsubNested(getStore<subs>(elem, 'htmlSubs'));
    contentElem.appendChild(elem);
  };
  return contentElem.content;
};

allowedPrototypes.set(ElementCollection, new Set());
allowedPrototypes.set(FileList, new Set());
allowedPrototypes.set(File, new Set());

const $watch = (cb: () => any, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void} => {
  const subUnsubs = watch(cb, callback);
  return { unsubscribe: () => unsubNested(subUnsubs) };
}

class ElementScope {
  $el: ElementCollection;
  constructor(element: Element) {
    this.$el = wrap(element);
  }

  $dispatch(eventType: string, detail?: any, bubbles = true, cancelable = true) {
    this.$el.trigger(eventType, detail, bubbles, cancelable);
  }
}

function getRootElement(scopes: ElementScope[]): Element {
  return scopes[0]?.$el.get(0);
}

class RootScope extends ElementScope {
  $refs: {[name: string]: ElementCollection} = {};
  $wrap = (element: wrapType) => {
    return wrap(element, this.$el);
  }
  $watch = $watch
}

export class Component {}

allowedPrototypes.set(RootScope, new Set());
allowedPrototypes.set(ElementScope, new Set());

const components: any = {};
export function defineComponent(name: string, comp: Component) {
  components[name] = comp;
  if (!allowedPrototypes.has(comp.constructor)) {
    allowedPrototypes.set(comp.constructor, new Set());
  }
}

export default function init(elems?: wrapType, component?: string) {
  const runs: (() => void)[] = [];
  (elems ? wrap(elems, $document) : $document.find('[x-app]').not('[x-app] [x-app]'))
    .once('x-processed')
    .forEach((elem) => {
      const comp = component || elem.getAttribute('x-app');
      const subs: subs = [];
      const scope = getStore<ElementScope>(elem, 'scope', components[comp] || getScope(elem, subs, {}, true));
      preprocessHTML(elem);
      const processed = processHTML(elem, subs, defaultDelegateObject);
      elem.setAttribute('x-processed', '');
      runs.push(() => processed.run([scope]));
    });
  runs.forEach((run) => run());
}

function getScope(element: Element, subs: subs, vars: {[variable: string]: any} = {}, root = false) {
  const scope = getStore<ElementScope>(element, 'scope', root ? new RootScope(element) : new ElementScope(element));
  getStore<subs>(element, 'htmlSubs', subs);
  subs.push(() => {
    scope.$el = null;
    deleteStore(element, 'htmlSubs');
    deleteStore(element, 'scope');
  });
  Object.assign(scope, vars);
  return scope;
}

function getDataScope<T>(element: Element, data?: T) {
  return getStore(element, 'dataScope', data);
}

export function getScopes(element: Element, newScope?: {[variable: string]: any}, subs: subs = []): ElementScope[] {
  if (!element) return [];
  const datascope = getDataScope<any>(element);
  const scope = newScope === undefined ? getStore<ElementScope>(element, 'scope') : getScope(element, subs, newScope);
  const scopes: ElementScope[] = [];
  if (scope) scopes.push(scope);
  if (datascope) scopes.push(datascope);
  return [...(element.hasAttribute('x-detached') ? <ElementScope[]>[] : getScopes(element.parentElement)), ...scopes];
}

const calls: (() => void)[] = [];
let timer: number;
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

function watchRun(scopes: ElementScope[], code: string) {
  return () => run(getRootElement(scopes), 'return ' + code, scopes);
}

export function watch(toWatch: () => any, handler: (val: unknown, lastVal: unknown) => void|Promise<void>): subs {
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
    let g = sandbox.subscribeGet((obj: any, name: string) => {
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
      const obj = item[0]
      for (let name of item[1]) {
        subUnsubs.push(sandbox.subscribeSet(obj, name, () => {
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

const sandboxCache: WeakMap<Node, {[code: string]: (...scopes: any[]) => any}> = new WeakMap();
export function run(el: Node, code: string, scopes: ElementScope[]) {
  el = el || document;
  let codes = sandboxCache.get(el) || {};
  sandboxCache.set(el, codes);
  codes[code] = codes[code] || sandbox.compile(code);
  return codes[code](...scopes);
}

const directives: {[name: string]: (exce: DirectiveExec, ...scopes: ElementScope[]) => subs} = {};

export interface DirectiveExec {
  element: Element,
  directive: string,
  js: string,
  original: string,
  subs: subs
}

defineDirective('show', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    exec.element.classList.toggle('hide', !val);
  });
});

defineDirective('text', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    wrap(exec.element).text(val + "");
  });
});

defineDirective('ref', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  if (!exec.js.match(regVarName)) {
    throw new Error('Invalid ref name: ' + exec.js);
  }
  const name = getScope(exec.element, [], {name: exec.js.trim()});
  run(document, `$refs[name] = $wrap([...($refs[name] || []), $el])`, [...scopes, name]);
  return [() => {
    run(document, `$refs[name] = $refs[name].not($el)`, [...scopes, name]);
  }];
});

defineDirective('model', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  const el: any = exec.element;
  const isContentEditable = (el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''));
  const isInput = (el instanceof HTMLInputElement && (!el.type || el.type === 'text' || el.type === 'tel')) 
                  || el instanceof HTMLTextAreaElement 
                  || isContentEditable;
  const $el = wrap(el);
  let last: any;
  if (!el.hasAttribute('name')) {
    el.setAttribute('name', exec.js.trim());
  }
  const change = () => {
    last = !isContentEditable ? $el.val() : $el.html();
    run(getRootElement(scopes), exec.js.trim() + ' = $$value === undefined ? ' + exec.js.trim() + ' : $$value', [...scopes, getScope(el, exec.subs, {$$value: last})]);
  }
  el.addEventListener(isInput ? 'input' : 'change', change);
  const subs = watch(watchRun(scopes, exec.js.trim()), (val, lastVal) => {
    if (isContentEditable) {
      $el.html(val + "");
    } else {
      $el.val(val as any);
    }
  });
  return [() => exec.element.removeEventListener(isInput ? 'input' : 'change', change), subs];
});

defineDirective('html', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    if (val instanceof Node || typeof val === 'string' || val instanceof ElementCollection) {
      wrap(exec.element).html(val);
    }
  });
});

export function defineDirective(name: string, callback: (exce: DirectiveExec, ...scopes: ElementScope[]) => subs) {
  directives[name] = callback;
}

function runDirective(exec: DirectiveExec, ...scopes: ElementScope[]) {
  if (directives[exec.directive]) {
    return directives[exec.directive](exec, ...scopes);
  }
  return [];
}

function walkerInstance() {
  const execSteps: ((scopes: ElementScope[]) => ElementScope[])[] = [];
  return {
    ready: (cb: (scopes: ElementScope[]) => ElementScope[]) => execSteps.push(cb),
    run: (scopes: ElementScope[]) => {
      let s = scopes;
      execSteps.forEach((cb) => s = cb(s))
    }
  }
}

function preprocessHTML(html: Node|string): Node {
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
  sanitizeHTML(elem);
  return elem;
}

function processHTML(elem: Node, subs: subs, delegate: DelegateObject) {
  const exec = walkerInstance();
  walkTree(elem, subs, exec.ready, delegate);
  return {
    elem: elem,
    run: exec.run
  }
}

export function unsubNested(subs: sub) {
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

export type sub = (() => void)|sub[];
export type subs = sub[];
function walkTree(element: Node, parentSubs: subs, ready: (cb: (scopes: ElementScope[]) => ElementScope[]) => void, delegate: DelegateObject) {
  let pushed = false;
  const currentSubs: subs = getStore(element, 'htmlSubs') || [];
  const pushSubs = () => {
    if (pushed) return;
    getStore(element, 'htmlSubs', currentSubs);
    pushed = true;
    parentSubs.push(currentSubs);
  }
  if (element instanceof Element) {
    pushSubs();

    const $element = wrap(element);
    element.removeAttribute('x-cloak');
    if (element.hasAttribute('x-if')) {
      const comment = document.createComment('x-if');
      let ifElem: Element;
      const at = element.getAttribute('x-if');
      element.removeAttribute('x-if');
      element.before(comment);
      element.remove();
      deleteStore(element, 'htmlSubs');
      ready((scopes) => {
        getStore<subs>(comment, 'htmlSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs)
        currentSubs.push(watch(watchRun(scopes, at), (val, lastVal) => {
          if (val) {
            if (!ifElem) {
              ifElem = element.cloneNode(true) as Element;
              const processed = processHTML(ifElem, nestedSubs, delegate);
              comment.after(processed.elem);
              processed.run([...scopes, getScope(ifElem, nestedSubs)]);
            }
          } else {
            if (ifElem) {
              ifElem.remove();
              ifElem = undefined;
              unsubNested(nestedSubs);
            }
          }
        }));
        return scopes;
      });
      return;
    }
    if (element.hasAttribute('x-for')) {
      const comment = document.createComment('x-for');
      element.after(comment);
      element.remove();
      deleteStore(element, 'htmlSubs');
      const items = new Set<Element>();
      let exp: string;
      const at = element.getAttribute('x-for');
      element.removeAttribute('x-for');
      let split = at.split(' in ');
      if (split.length < 2) {
        throw new Error('In valid x-for directive: ' + at)
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
        if (!doubleMatch) throw new Error('In valid x-for directive: ' + at)
        key = doubleMatch[1];
        value = doubleMatch[2];
      }
      ready((scopes) => {
        const del = wrap(comment.parentElement).delegate();
        currentSubs.push(del.off);
        getStore<subs>(comment, 'htmlSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs);
        currentSubs.push(watch(watchRun(scopes, exp), (val) => {
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
            const processed = processHTML(elem, forSubs, del);
            comment.before(processed.elem);
            items.add(elem);
            runs.push(() => processed.run([...scopes, getScope(elem, forSubs, scope)]));
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
        }));
        return scopes;
      });
      return;
    }
    if (element.hasAttribute('x-detached')) {
      ready((scopes) => {
        return [getScope(element, currentSubs, {}, true)];
      });
    }
    let elementScopeAdded = false;
    for (let att of element.attributes) {
      if (att.nodeName.startsWith("$")) {
        const name = att.nodeName.substring(1);
        if (!name.match(regVarName)) {
          console.error(`Invalid variable name in attribute ${att.nodeName}`);
          continue;
        };
        if (!elementScopeAdded) {
          elementScopeAdded = true;
          const prevReady = ready;
          ready = (cb: (scopes: ElementScope[]) => void) => {
            prevReady((s: ElementScope[]) => {
              cb(pushScope(s, element, currentSubs));
            });
          };
        }
        ready(scopes => {
          run(getRootElement(scopes), `let ${name} = ${att.nodeValue}`, scopes);
        });
      }
    }
    if (element instanceof HTMLScriptElement) {
      if (element.type === 'scopejs') {
        ready((scopes) => {
          run(getRootElement(scopes), element.innerHTML, scopes);
          return scopes;
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
            const nestedSubs: subs = [];
            currentSubs.push(nestedSubs);
            currentSubs.push(watch(watchRun(scopes, att.nodeValue), (val: any, lastVal) => {
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
            return scopes;
          });
        } else if (att.nodeName.startsWith('@')) {
          const parts = att.nodeName.slice(1).split('.');
          ready((scopes) => {
            const ev = (e: EqEvent) => {
              run(getRootElement(scopes), att.nodeValue, [...scopes, getScope(element, currentSubs, {$event: e})])
            };
            if (parts[1] === 'once') {
              currentSubs.push(delegate.one(element, parts[0], ev));
            } else {
              currentSubs.push(delegate.on(element, parts[0], ev));
            }
            return scopes;
          });
        } else if (att.nodeName.startsWith('x-')) {
          ready((scopes) => {
            currentSubs.push(runDirective({
              element,
              directive: att.nodeName.slice(2),
              js: att.nodeValue,
              original: element.outerHTML,
              subs: currentSubs
            }, ...scopes, getScope(element, currentSubs)));
            return scopes;
          });
        }
      }
    }
  }
  for (let el of element.childNodes) {
    if (el instanceof Element) {
      const execSteps: ((scopes: ElementScope[]) => ElementScope[])[] = [];
      const r = (cb: (scopes: ElementScope[]) => ElementScope[]) => execSteps.push(cb);
      walkTree(el, pushed ? currentSubs : parentSubs, r, delegate);
      ready((scopes) => {
        let s = scopes
        for (let cb of execSteps) s = cb(s);
        return scopes;
      });
    } else if (el.nodeType === 3) {
      const strings = walkText(el.textContent);
      const nodes: Text[] = [];
      let found = false;
      strings.forEach((s) => {
        if (s.startsWith("{{") && s.endsWith("}}")) {
          found = true;
          const placeholder = document.createTextNode("");
          getStore<subs>(placeholder, 'htmlSubs', currentSubs);
          pushSubs();
          ready((scopes) => {
            currentSubs.push(watch(watchRun(scopes, s.slice(2, -2)), (val, lastVal) => {
              placeholder.textContent = val + "";
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
}

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