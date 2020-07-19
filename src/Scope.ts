// @ts-check

import Sandbox from '@nyariv/sandboxjs'
import { ElementCollection as EC, wrap as elementWrap, EqEvent, wrapType, getStore, deleteStore, $document, DelegateObject, defaultDelegateObject } from './eQuery'

export const allowedGlobals = Sandbox.SAFE_GLOBALS;
export const allowedPrototypes = Sandbox.SAFE_PROTOTYPES;
export const sandbox = new Sandbox(allowedGlobals, allowedPrototypes);

const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;
const regForbiddenAttr = /^(on|:|@|x-)/;
const regHrefJS = /^\s*javascript:/;

export function wrap(selector: wrapType, context?: ElementCollection|EC): ElementCollection {
  return Object.assign(Object.create(ElementCollection.prototype), elementWrap(selector, context));
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

export class ElementCollection extends EC {
  html(content?: wrapType) {
    if (content === undefined) {
      return this[0]?.innerHTML;
    }
    let contentElem: Node;
    let elem = this.get(0);
    if (!elem) return this;
    if (typeof content !== 'string') {
      contentElem = wrap(content).detach();
    }
    unsubNested(walkFindSubs(elem));
    let subs: subs = [];
    const found = getStore<subs>(elem, 'htmlSubs', subs);
    if (found === subs) {
      const parentSubs = walkFindSubs(elem, true);
      parentSubs.push(subs);
    } else {
      subs = found;
    }
    const nestedSubs: subs = [];
    subs.push(nestedSubs); // @TODO: potential memory leak of accumilating empty subs arrays
    const processed = processHtml(typeof content !== 'string' ? contentElem : content, nestedSubs, defaultDelegateObject);
    elem.appendChild(processed.elem);
    processed.run(getScopes(elem, {}, subs));
    return this;
  }
  text(set?: string) {
    if (set !== undefined) {
      this.forEach((elem) => {
        unsubNested(walkFindSubs(elem));
        elem.textContent = set;
      });
      return this;
    }
    return this.get(0)?.textContent.trim();
  }
  detach() {
    const contentElem = document.createElement('template');
    this.forEach((elem) => {
      unsubNested(getStore<subs>(elem, 'htmlSubs'));
      contentElem.appendChild(elem);
    });
    return contentElem.content;
  }
}

allowedPrototypes.set(EC, new Set());
allowedPrototypes.set(ElementCollection, new Set());

const $watch = (variable: any, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void} => {
  if (!watchListen) return { unsubscribe: () => undefined };
  watchListen = false;
  const subUnsubs: subs = [];
  let update = false;
  for (let item of watchGets) {
    let lastVal: any;
    let val: any;
    subUnsubs.push(sandbox.subscribeSet(item.obj, item.name, () => {
      val = item.obj[item.name];
      if (val !== lastVal) {
        if (!update) {
          call(() => {
            update = false;
            if (val !== lastVal) {
              const temp = lastVal;
              lastVal = val;
              callback(val, temp);
            }
          });
        }
        update = true;
      }
    }).unsubscribe);
  }
  watchGets.length = 0;
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
  return scopes[0]?.$el[0];
}

let watchGets: {obj: any, name: string}[] = []
let watchListen = false;
class RootScope extends ElementScope {
  $refs = {};
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
  (elems ? wrap(elems, $document) : $document.search('[x-app]').not('[x-app] [x-app]'))
    .once('x-processed')
    .forEach((elem) => {
      const comp = component || elem.getAttribute('x-app');
      const subs: subs = [];
      const scope = getStore<ElementScope>(elem, 'scope', components[comp] || getScope(elem, subs, {}, true));
      console.log(scope)
      const processed = processHtml(elem, subs, defaultDelegateObject);
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
      c();
    }
  });
}

export function watch(root: Node, code: string, cb: (val: any, lastVal: any) => void|Promise<void>, scopes: any[], digestObj?: {
    digest: () => void, 
    count: number, 
    countStart: number, 
    lastVal: any,
    subs: subs
  }): subs {
  const gets = new Map<any, Set<string>>();
  let unsub = sandbox.subscribeGet((obj, name) => {
    const names = gets.get(obj) || new Set();
    names.add(name);
    gets.set(obj, names);
  }).unsubscribe;
  let val: any;
  try {
    val = run(root, 'return ' + code, ...scopes);
  } catch (err) {
    console.error(err);
  }
  unsub();
  const digest = () => {
    call(() => {
      if ((Date.now() - digestObj.countStart) > 500) {
        if (digestObj.count++ > 100) {
          throw new Error('Infinite digest detected');
        }
        digestObj.count = 0;
        digestObj.countStart = Date.now();
      }
      unsubNested(digestObj.subs);
      const s = watch(root, code, cb, scopes, digestObj);
      digestObj.subs.push(...s);
    });
  }
  let lastVal = undefined;
  if (!digestObj) {
    let subs: subs = [];
    digestObj = { 
      digest, 
      count: 0,
      countStart: Date.now(),
      lastVal: val,
      subs
    };
  } else {
    lastVal = digestObj.lastVal
    digestObj.digest = digest;
    digestObj.lastVal = val;
  }
  gets.forEach((g, obj) => {
    g.forEach((name) => {
      digestObj.subs.push(sandbox.subscribeSet(obj, name, () => {
        digestObj.digest();
      },).unsubscribe);
    });
  });
  if (lastVal !== val) {
    const res = cb(val, digestObj.lastVal);
    if (res instanceof Promise) {
      res.then(() => {
        digestObj.digest()
      }, (err) => {
        console.error(err);
      });
    }
  }
  return digestObj.subs;
}

const sandboxCache: WeakMap<Node, {[code: string]: (...scopes: any[]) => any}> = new WeakMap();
export function run(el: Node, code: string, ...scopes: any[]) {
  el = el || document;
  let codes = sandboxCache.get(el) || {};
  sandboxCache.set(el, codes);
  codes[code] = codes[code] || sandbox.compile(code);
  const unsub = sandbox.subscribeGet((obj: any, name: string) => {
    if (obj[name] === $watch) {
      watchListen = true;
    } else if (watchListen) {
      watchGets.push({obj, name});
    }
  });
  watchListen = false;
  const ret = codes[code](...scopes);
  unsub.unsubscribe();
  watchGets.length = 0;
  return ret;
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
  return watch(getRootElement(scopes), exec.js, (val, lastVal) => {
    exec.element.classList.toggle('hide', !val);
  }, scopes);
});

defineDirective('text', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  return watch(getRootElement(scopes), exec.js, (val, lastVal) => {
    wrap(exec.element).text(val);
  }, scopes);
});

defineDirective('ref', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  if (!exec.js.match(regVarName)) {
    throw new Error('Invalid ref name: ' + exec.js);
  }
  const name = getScope(exec.element, [], {name: exec.js.trim()});
  run(document, `$refs[name] = $el`, ...scopes, name);
  return [() => {
    run(document, `delete $refs[name]`, ...scopes, name);
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
  const change = () => {
    last = !isContentEditable ? $el.val() : $el.html();
    run(getRootElement(scopes), exec.js + ' = $$value', ...scopes, getScope(el, exec.subs, {$$value: last}));
  }
  el.addEventListener(isInput ? 'input' : 'change', change);
  const subs = watch(getRootElement(scopes), exec.js, (val, lastVal) => {
    if (isContentEditable) {
      $el.html(val);
    } else {
      $el.val(val);
    }
  }, scopes);
  return [() => exec.element.removeEventListener(isInput ? 'input' : 'change', change), subs];
});

defineDirective('html', (exec: DirectiveExec, ...scopes: ElementScope[]) => {
  return watch(getRootElement(scopes), exec.js, (val, lastVal) => {
    exec.element.innerHTML = '';
    const nestedSubs: subs = [];
    exec.subs.push(nestedSubs);
    unsubNested(walkFindSubs(exec.element));
    const processed = processHtml(val, nestedSubs, defaultDelegateObject);
    exec.element.appendChild(processed.elem);
    processed.run(scopes);
  }, scopes);
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

function processHtml(elem: Node|string, subs: subs, delegate: DelegateObject) {
  let template: HTMLTemplateElement;
  const exec = walkerInstance();
  if (typeof elem === 'string') {
    template = document.createElement('template');
    template.innerHTML = elem;
    walkTree(template.content, subs, exec.ready, delegate);
  } else {
    walkTree(elem, subs, exec.ready, delegate);
  }
  return {
    elem: typeof elem === 'string' ? template.content : elem,
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
    if (["OBJECT", "EMBED"].includes(element.tagName)) {
      element.remove();
      return;
    }
    pushSubs();

    const $element = wrap(element);
    element.removeAttribute('x-cloak');
    if (element.hasAttribute('x-if')) {
      const html = element.outerHTML;
      const comment = document.createComment('x-if');
      let ifElem: Element;
      element.before(comment);
      element.remove();
      deleteStore(element, 'htmlSubs');
      ready((scopes) => {
        getStore<subs>(comment, 'htmlSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs)
        currentSubs.push(watch(getRootElement(scopes), element.getAttribute('x-if'), (val, lastVal) => {
          if (val) {
            if (!ifElem) {
              const template = document.createElement('template');
              template.innerHTML = html;
              ifElem = template.content.firstElementChild;
              ifElem.removeAttribute('x-if');
              const processed = processHtml(ifElem, nestedSubs, delegate);
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
        }, scopes));
        return scopes;
      });
      return;
    }
    if (element.hasAttribute('x-for')) {
      const html = element.outerHTML;
      const comment = document.createComment('x-for');
      element.after(comment);
      element.remove();
      deleteStore(element, 'htmlSubs');
      const items = new Set<Element>();
      let exp: string;
      const at = element.getAttribute('x-for');
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
        currentSubs.push(watch(getRootElement(scopes), exp, (val: any[], lastVal) => {
          unsubNested(nestedSubs);
          items.forEach((item) => {
            item.remove();
          });
          items.clear();
          const runs: (() => void)[] = [];
          let i = -1;
          for (let item of val) {
            i++;
            const forSubs: subs = [];
            nestedSubs.push(forSubs);
            const scope: any = {$index: i};
            if (key) scope[key] = i;
            if (value) scope[value] = item;
            const template = document.createElement('template');
            template.innerHTML = html;
            const elem = template.content.firstElementChild;
            elem.removeAttribute('x-for');
            const processed = processHtml(elem, forSubs, del);
            comment.before(processed.elem);
            items.add(elem);
            runs.push(() => processed.run([...scopes, getScope(elem, forSubs, scope)]));
          }
          runs.forEach((run) => run());
        }, scopes));
        return scopes;
      });
      return;
    }
    if (element.hasAttribute('x-detached')) {
      ready((scopes) => {
        return [getScope(element, currentSubs, {}, true)];
      });
    }
    if (element.hasAttribute('x-data')) {
      ready(scopes => {
        scopes = scopes.slice();
        scopes.push(getScope(element, currentSubs));
        scopes.push(getDataScope(element, run(getRootElement(scopes), 'return ' + (element.getAttribute('x-data') || '{}'), ...scopes)));
        return scopes;
      });
    }
    if (element instanceof HTMLScriptElement) {
      if (element.type === 'scopejs') {
        ready((scopes) => {
          run(getRootElement(scopes), element.innerHTML, ...scopes);
          return scopes;
        });
      } else {
        element.remove();
      }
      return;
    } else {
      for (let att of element.attributes) {
        if (att.nodeName.startsWith('on')) {
          element.setAttribute('@' + att.nodeName.slice(2), att.nodeValue);
          element.removeAttribute(att.nodeName);
        } else if (['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from'].includes(att.nodeName) && att.nodeValue !== 'javascript:void(0)') {
          const isJs = att.nodeValue.match(regHrefJS);
          if (isJs) {
            if (att.nodeName === 'href' || att.nodeName === 'xlink:href') {
              if (!element.hasAttribute('@click')) {
                element.setAttribute('@click', att.nodeValue.substring(isJs[0].length));
              }
              element.setAttribute(att.nodeName, 'javascript:void(0)');
            } else {
              element.removeAttribute(att.nodeName);
            }
          }
        } else if (att.nodeName === 'srcdoc' && element instanceof HTMLIFrameElement) {
          const html = att.nodeValue;
          element.removeAttribute(att.nodeName);
          if (!element.hasAttribute(':srcdoc')) {
            element.setAttribute(':srcdoc', html);
          }
        }
      }
      for (let att of element.attributes) {
        if (att.nodeName.startsWith(':')) {
          const at = att.nodeName.slice(1);
          ready((scopes) => {
            const nestedSubs: subs = [];
            currentSubs.push(nestedSubs);
            currentSubs.push(watch(getRootElement(scopes), att.nodeValue, (val, lastVal) => {
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
              } else if (at === "srcdoc" && element instanceof HTMLIFrameElement) {
                element.contentWindow.document.querySelector(':root')?.remove();
                unsubNested(nestedSubs);
                const processed = processHtml(val, nestedSubs, delegate);
                element.contentWindow.document.appendChild(processed.elem);
                processed.run([...scopes, getScope(element, currentSubs)]);
              } else if (!at.match(regForbiddenAttr)) {
                $element.attr(at, val);
              }
            }, scopes));
            return scopes;
          });
        } else if (att.nodeName.startsWith('@')) {
          const parts = att.nodeName.slice(1).split('.');
          ready((scopes) => {
            const ev = (e: EqEvent) => {
              run(getRootElement(scopes), att.nodeValue, ...scopes, getScope(element, currentSubs, {$event: e}))
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
            currentSubs.push(watch(getRootElement(scopes), s.slice(2, -2), (val, lastVal) => {
              placeholder.textContent = val;
            }, scopes));
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