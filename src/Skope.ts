// @ts-check

import Sandbox, { IExecContext } from '@nyariv/sandboxjs';
import { Change } from '@nyariv/sandboxjs/dist/node/executor';
import createClass, { EqEvent, wrapType, DelegateObject, ownerDoc, isIterable } from './eQuery'
import { IElementCollection as IElemCollection } from './eQuery';
import HTMLSanitizer from './HTMLSanitizer';

const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;

function isObject (object: any): object is {[key: string]: unknown} {
  return object !== null && typeof object === 'object';
}

function getRootScope(skope: Skope, scopes: IElementScope[]): IRootScope|undefined {
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (scopes[i] instanceof skope.RootScope) {
      return scopes[i] as IRootScope;
    }
  }
}

function getRootElement(skope: Skope, scopes: IElementScope[]): Element {
  return getRootScope(skope, scopes)?.$el.get(0);
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

interface IElementCollection extends IElemCollection {
  html(): string;
  html(content: string|Element|DocumentFragment|IElementCollection): IElemCollection;
  text(): string;
  text(set: string): IElementCollection;
}

interface IElementScope {
  $el: IElementCollection;
  $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
  $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void};
  $delay(ms: number): Promise<void>;
}
interface IRootScope extends IElementScope {
  $templates: {[name: string]: HTMLTemplateElement};
  $refs: {[name: string]: IElementCollection};
  $wrap(element: wrapType): IElementCollection;
}
  
export interface DirectiveExec {
  element: Element,
  att: Node,
  directive: string,
  js: string,
  original: string,
  subs: subs,
  delegate: DelegateObject
}
  
export type sub = (() => void)|sub[];
export type subs = sub[];

function runDirective(skope: Skope, exec: DirectiveExec, scopes: IElementScope[]) {
  const dir = skope.directives[exec.directive];
  if (dir) {
    return dir(exec, scopes);
  }
  return [];
}

function createErrorCb(el: Node) {
  return (err: Error) => createError(err?.message, el);
}

function initialize (skope: Skope) {
  const eQuery = createClass(() => skope.sanitizer);
  const { wrap, ElementCollection, getStore, deleteStore, defaultDelegateObject} = eQuery;
  skope.defaultDelegateObject = defaultDelegateObject;
  skope.getStore = getStore;
  skope.deleteStore = deleteStore;
  skope.wrap = wrap as (selector: wrapType, context: IElementCollection|Document) => IElementCollection;
  
  class ElementScope implements IElementScope {
    $el: IElementCollection;
    constructor(element: Element) {
      this.$el = wrap(element, element.ownerDocument) as IElementCollection;
    }
  
    $dispatch(eventType: string, detail?: any, bubbles = true, cancelable = true) {
      this.$el.trigger(eventType, detail, bubbles, cancelable);
    }
    $watch(cb: () => unknown, callback: (val: any, lastVal: any) => void): {unsubscribe: () => void} {
      const subUnsubs = skope.watch(this.$el.get(0), cb, callback);
      const sub = getStore(this.$el.get(0), 'currentSubs', []);
      sub.push(subUnsubs);
      return { unsubscribe: () => unsubNested(subUnsubs) };
    }
    $delay(ms: number) {
      return new Promise<void>((res) => setTimeout(res, ms));
    }
  }

  class RootScope extends ElementScope {
    $templates: {[name: string]: HTMLTemplateElement} = {};
    $refs: {[name: string]: IElementCollection} = {};
    constructor(el: Element) {
      super(el);
    }
    $wrap(element: wrapType) {
      return wrap(element, this.$el);
    }
  }

  ElementCollection.prototype.html = function (content?: string|Element|DocumentFragment|IElementCollection) {
    if (content === undefined) {
      return this.get(0)?.innerHTML;
    }
    if (content === null || !(content instanceof DocumentFragment || content instanceof Element || typeof content == 'string' || content instanceof ElementCollection)) {
      return this;
    }
    let elem = this.get(0);
    if (!elem) return this;
    let contentElem: Element|DocumentFragment;
    let html: Element|DocumentFragment|string;
    if (content instanceof ElementCollection) {
      html = (content as any).detach() as DocumentFragment;
    } else {
      html = content;
    }
    let currentSubs: subs = getStore<subs>(elem, 'currentSubs', []);
    let scopes = getScopes(skope, elem, currentSubs);
    if (elem instanceof HTMLIFrameElement) {
      const prev = elem;
      unsubNested(getStore<subs>(elem.contentDocument.body, 'currentSubs'));
      elem = document.createElement('body');
      if (prev.matches('[s-static], [s-static] *')) {
        elem.setAttribute('s-static', '')
      }
      const prevSub = currentSubs;
      currentSubs = getStore<subs>(elem, 'currentSubs', []);
      prevSub.push(currentSubs);
      getStore<subs>(elem, 'currentSubs', currentSubs);
      getStore<IElementScope[]>(elem, 'scopes', scopes);
      const sty = document.createElement('style');
      sty.innerHTML = 'body { padding: 0; margin: 0; }';
      prev.contentDocument.head.appendChild(sty);
      prev.contentDocument.body.replaceWith(elem);
      const recurse = (el: Element): string[] => {
        if (!el || !el.parentElement || el.matches('[skope]') || el.hasAttribute('s-detached')) return [];
        const styles = recurse(el.parentElement);
        styles.push(...skope.wrapElem(el.parentElement).children('style').map((el) => el.innerHTML));
        return styles;
      }
      recurse(prev).forEach((css) => {
        const st = document.createElement('style');
        st.innerHTML = css;
        prev.contentDocument.body.appendChild(st);
      });
    } else if (!(elem instanceof HTMLTemplateElement)) {
      for (let el of [...elem.children]) {
        unsubNested(getStore<subs>(el, 'currentSubs'));
      }
      elem.innerHTML = '';
    }
    if (elem instanceof HTMLTemplateElement) {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = elem.content;
    } else {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = preprocessHTML(skope, elem, html);
      registerTemplates(skope, contentElem, scopes);
    }
    elem.appendChild(contentElem);
    if (!elem.matches('[s-static], [s-static] *')) {
      const processed = processHTML(skope, elem, currentSubs, defaultDelegateObject, true);
      processed.run(scopes);
    }
    return this;
  };
  ElementCollection.prototype.text = function (set?: string) {
    if (set !== undefined) {
      let toSet = set + "";
      this.forEach((elem: Element) => {
        unsubNested(getStore<subs>(elem, 'childSubs'));
        elem.textContent = toSet;
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

  skope.RootScope = RootScope as new () => IRootScope;
  skope.ElementScope = ElementScope;
  skope.prototypeWhitelist.set(FileList, new Set());
  skope.prototypeWhitelist.set(File, new Set());
  skope.prototypeWhitelist.set(RootScope, new Set());
  skope.prototypeWhitelist.set(ElementCollection, new Set());
  skope.prototypeWhitelist.set(ElementScope, new Set());
  skope.ElementCollection = ElementCollection as new () => IElementCollection
  
  skope.defineDirective('show', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(exec.att, watchRun(skope, scopes, exec.js), (val, lastVal) => {
      exec.element.classList.toggle('s-hide', !val);
    }, () => {
      exec.element.classList.toggle('s-hide', false);
    });
  });
  
  skope.defineDirective('text', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(exec.att, watchRun(skope, scopes, exec.js), (val, lastVal) => {
      skope.wrapElem(exec.element).text(val + "");
    }, () => {
      skope.wrapElem(exec.element).text("");
    });
  });
  
  skope.defineDirective('ref', (exec: DirectiveExec, scopes: IElementScope[]) => {
    if (!exec.js.match(regVarName)) {
      throw createError('Invalid ref name: ' + exec.js, exec.element);
    }
    const name = getScope(skope, exec.element, [], {name: exec.js.trim()});
    skope.exec(document, `$refs[name] = $wrap([...($refs[name] || []), $el])`, [...scopes, name]).run();
    return [() => {
      skope.exec(document, `$refs[name] = $refs[name].not($el)`, [...scopes, name]).run();
    }];
  });

  const ddd = document.createElement('div');
  ddd.innerHTML = '<span $$templates="$templates"><span>';
  const $$templatesAttr = ddd.querySelector('span').attributes.item(0);

  skope.defineDirective('component', (exec: DirectiveExec, scopes: IElementScope[]) => {
    const template = getRootScope(skope, scopes)?.$templates[exec.att.nodeValue];
    if (!(template instanceof HTMLTemplateElement)) {
      createError('Template not found', exec.att)
      return [];
    }

    const elem = exec.element;
    const $elem = skope.wrapElem(elem);
    const subs: subs = [];
    const delegate = $elem.delegate();

    const isStatic = elem.hasAttribute('s-static');
    elem.removeAttribute('s-static');
    const templateContent = template.content.cloneNode(true) as DocumentFragment;
    const slot = templateContent.querySelector('[slot]');

    for (let attribute of template.attributes) {
      const name = attribute.nodeName.toLowerCase();
      if (name === 'id') continue;
      if (elem.hasAttribute(name)) continue;
      elem.setAttributeNode(attribute.cloneNode(true) as Attr);
    }
    elem.setAttributeNode($$templatesAttr.cloneNode(true) as Attr);

    if (slot) {
      slot.innerHTML = '';
      if (elem.hasAttribute('s-detached')) {
        slot.setAttribute('s-detached', elem.getAttribute('s-detached'));
      }
      if (elem.hasAttribute('s-html')) {
        slot.setAttribute('s-html', elem.getAttribute('s-html'));
      }
      if (elem.hasAttribute('s-text')) {
        slot.setAttribute('s-text', elem.getAttribute('s-text'));
      }
    }
    elem.removeAttribute('s-html');
    elem.removeAttribute('s-text');
    const slotContent = document.createElement('template');

    const isIframe = elem instanceof HTMLIFrameElement;
    if (isIframe) {
      if (slot) {
        slotContent.innerHTML = elem.getAttribute('skope-iframe-content');
      }
      elem.removeAttribute('skope-iframe-content');
    } else {
      slotContent.content.append(...elem.childNodes);
      elem.appendChild(templateContent);
    }

    elem.removeAttribute('s-component');
    elem.setAttribute('s-detached', '');
    processHTML(skope, elem, subs, delegate).run(pushScope(skope, scopes, elem, subs));
    if (isIframe) {
      $elem.html(templateContent);
    }
    elem.removeAttribute('s-detached');
    elem.setAttribute('s-component', exec.att.nodeValue);
    elem.setAttribute('component-processed', '');

    if (slot) {
      getStore<IElementScope[]>(slot, 'scopes', scopes);
      if (isIframe) {
        if (isStatic) {
          slot.setAttribute('s-static', '');
        }
        preprocessHTML(skope, slot, slotContent.content);
        slot.appendChild(slotContent.content);
        processHTML(skope, slot, subs, exec.delegate).run(scopes);
      } else {
        slot.appendChild(slotContent.content);
        /** @todo handle mutation observer race condition */
        setTimeout(() => {
          if (isStatic) {
            slot.setAttribute('s-static', '');
          }
          processHTML(skope, slot, subs, exec.delegate).run(scopes);
        });
      }
    }
    return subs;
  });
  
  skope.defineDirective('model', (exec: DirectiveExec, scopes: IElementScope[]) => {
    const el: any = exec.element;
    const isContentEditable = (el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''));
    const $el: any = skope.wrapElem(el);
    let last: any = !isContentEditable ? $el.val() : $el.html();
    if (!el.hasAttribute('name')) {
      el.setAttribute('name', exec.js.trim());
    }
    let reset = false;
    const change = () => {
      last = !isContentEditable ? $el.val() : $el.html();
      try {
        skope.exec(getRootElement(skope, scopes), exec.js.trim() + ' = ($$value === undefined && !reset) ? ' + exec.js.trim() + ' : $$value', pushScope(skope, scopes, el, exec.subs, {$$value: last, reset})).run();
        reset = false;
      } catch (err) {
        createError(err?.message, exec.element);
      }
    }
    const sub: subs = [];
    sub.push(exec.delegate.on(el, 'input', change));
    if (el.form) {
      const $form = skope.wrap(el.form, el.ownerDocument);
      sub.push($form.delegate().on($form.get(0), 'reset', () => reset = !!setTimeout(change)));
    }
    sub.push(skope.watch(exec.att, watchRun(skope, scopes, exec.js.trim()), (val, lastVal) => {
      if (val === last) return;
      if (isContentEditable) {
        $el.html(val + "");
      } else {
        $el.val(val as any);
      }
    }, () => {
      if (isContentEditable) {
        $el.html("");
      }
    }));
    return sub;
  });
  
  skope.defineDirective('html', (exec: DirectiveExec, scopes: IElementScope[]) => {
    return skope.watch(exec.att, watchRun(skope, scopes, exec.js), (val, lastVal) => {
      if (val instanceof Element || typeof val === 'string' || val instanceof skope.ElementCollection) {
        skope.wrapElem(exec.element).html(val);
      }
    }, () => {
      skope.wrapElem(exec.element).html("");
    });
  });

  skope.defineDirective('transition', (exec: DirectiveExec, scopes: IElementScope[]) => {
    const $el = skope.wrapElem(exec.element);
    $el.addClass('s-transition');
    $el.addClass('s-transition-idle');
    let lastPromise: Promise<unknown>;
    return skope.watch(exec.att, watchRun(skope, scopes, exec.js), (val, lastVal) => {
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

function getScope(skope: Skope, element: Element, subs: subs, vars: {[variable: string]: any} = {}, root?: boolean): IElementScope|IRootScope {
  let scope = skope.getStore<IElementScope>(element, 'scope');
  if (root) {
    scope = skope.getStore<IElementScope>(element, 'rootScope');
  }
  if (!scope) {
    skope.getStore<subs>(element, 'currentSubs', subs);
    if (root) {
      scope = skope.getStore<IElementScope>(element, 'rootScope', new skope.RootScope(element));
      skope.getStore<IElementScope>(element, 'scope', scope);
    } else {
      scope = skope.getStore<IElementScope>(element, 'scope', new skope.ElementScope(element));
    }
    subs.push(() => {
      scope.$el = null;
      skope.deleteStore(element, 'currentSubs');
      skope.deleteStore(element, 'scope');
      skope.deleteStore(element, 'rootScope');
    });
  }
  Object.assign(scope, vars);
  return scope;
}

function getScopes(skope: Skope, element: Element, subs: subs = [], newScope?: {[variable: string]: any}): IElementScope[] {
  if (!element) return [];
  const scope = newScope === undefined ? skope.getStore<IElementScope>(element, 'scope') : getScope(skope, element, subs, newScope);
  const scopes: IElementScope[] = skope.getStore<IElementScope[]>(element, 'scopes') || [];
  if (scopes.length) {
    return [...scopes, scope];
  }
  if (scope) scopes.push(scope);
  return [...(element.hasAttribute('s-detached') ? [] : getScopes(skope, element.parentElement)), ...scopes];
}

interface IVarSubs {
  subscribeGet?: (callback: (obj: object, name: string) => void) => {
    unsubscribe: () => void;
  };
  subscribeSet?: (obj: object, name: string, callback: (modification: Change) => void) => {
    unsubscribe: () => void;
  }
}

const varSubsStore: WeakMap<() => unknown|Promise<unknown>, IVarSubs> = new WeakMap();

function createVarSubs(skope: Skope, context: IExecContext) {
  const varSubs: IVarSubs = {};
  varSubs.subscribeGet = (callback: (obj: object, name: string) => void) => skope.sandbox.subscribeGet(callback, context);
  varSubs.subscribeSet = (obj: object, name: string, callback: (modification: Change) => void) => skope.sandbox.subscribeSet(obj, name, callback, context);
  return varSubs;
}

function watchRun(skope: Skope, scopes: IElementScope[], code: string): () => unknown {
  const exec = skope.exec(getRootElement(skope, scopes), 'return ' + code, scopes);
  varSubsStore.set(exec.run, createVarSubs(skope, exec.context));
  return exec.run;
}

function preprocessHTML(skope: Skope, parent: Element, html: DocumentFragment|Element|string): DocumentFragment|Element {
  let elem: DocumentFragment|Element;
  if (typeof html === 'string') {
    const template = document.createElement('template');
    template.innerHTML = html;
    elem = template.content;
  } else {
    elem = html;
  }
  if (parent.matches('[s-static], [s-static] *')) {
    skope.sanitizer.sanitizeHTML(elem, true);
  } else {
    for (let el of elem.querySelectorAll('[s-static]:not([s-static] [s-static])')) {
      for (let child of el.children) {
        skope.sanitizer.sanitizeHTML(child, true);
      }
    }
    skope.sanitizer.sanitizeHTML(elem);
  }
  return elem;
}

function registerTemplates(skope: Skope, elem: DocumentFragment|Element, scopes: IElementScope[]) {
  const root = getRootScope(skope, scopes);
  if (!root) return;
  const recurse = (elem: Element|DocumentFragment) => {
    elem.querySelectorAll('template[id]:not([s-static] template, [s-detached] template)').forEach((template: HTMLTemplateElement) => {
      if (template.id) {
        if (root.$templates[template.id]) {
          createError('Duplicate template definition', template);
        } else {
          root.$templates[template.id] = template;
        }
      } else {
        recurse(template.content);
      }
    });
  }
  recurse(elem);
}

function walkerInstance() {
  const execSteps: ((scopes: IElementScope[]) => void)[] = [];
  return {
    ready: (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb),
    run: function runNested(scopes: IElementScope[]) {
      execSteps.forEach((cb) => cb(scopes));
      execSteps.length = 0;
    }
  }
}

function processHTML(skope: Skope, elem: Node, subs: subs, delegate: DelegateObject, skipFirst = false) {
  const exec = walkerInstance();
  walkTree(skope, elem, subs, exec.ready, delegate, skipFirst);
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
  const scope = getScope(skope, elem, sub, vars);
  if (scope === scopes[scopes.length - 1]) return [...scopes];
  return [...scopes, scope];
}

function createError(msg: string, el: Node) {
  const err = new Error(msg);
  (err as any).element = el;
  console.error(err, el);
  return err;
}

function walkTree(skope: Skope, element: Node, parentSubs: subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject, skipFirst: boolean) {
  let currentSubs: subs = [];
  parentSubs.push(currentSubs);
  const walkNested = () => {
    const execSteps: ((scopes: IElementScope[]) => void)[] = [];
    const r = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    for (let el of [...element.childNodes]) {
      if (el instanceof Element) {
        walkTree(skope, el, currentSubs, r, delegate, false);
      } else if (el.nodeType === 3) {
        const strings = walkText(el.textContent);
        const nodes: Text[] = [];
        let found = false;
        strings.forEach((s) => {
          if (s.startsWith("{{") && s.endsWith("}}")) {
            skope.getStore<subs>(el, 'currentSubs', currentSubs);
            found = true;
            const placeholder = document.createTextNode("");
            ready((scopes) => {
              try {
                currentSubs.push(skope.watch(element, watchRun(skope, scopes, s.slice(2, -2)), (val, lastVal) => {
                  placeholder.textContent = val + "";
                }, (err: Error) => {() => {
                  placeholder.textContent = "";
                }
                }));
                return scopes;
              } catch (err) {
                createError(err.message, element);
              }
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
  if (skipFirst) {
    walkNested();
    return;
  }
  if (element instanceof Element) {
    if (element instanceof HTMLTemplateElement) {
      return;
    }
    if (element instanceof HTMLStyleElement) {
      const loaded = () => {
        const parent = element.parentElement;
        if (!parent) return false;
        if (!skope.sanitizer.isAttributeForced(parent, 'skope-style')) {
          parent.removeAttribute('skope-style');
        }
        const id = parent.getAttribute('skope-style') || ++skope.styleIds;
        skope.sanitizer.setAttributeForced(parent, 'skope-style', id + "");
        let i = element.sheet.cssRules.length - 1;
        for (let rule of [...element.sheet.cssRules].reverse()) {
          if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
            element.sheet.deleteRule(i);
          }
          i--;
        }
        i = 0;
        for (let rule of [...element.sheet.cssRules]) {
          if (rule instanceof CSSStyleRule) {
            var cssText = rule.style.cssText;
            element.sheet.deleteRule(i);
            element.sheet.insertRule(`[skope-style="${id}"] :is(${rule.selectorText}) { ${cssText} }`, i);
          }
          i++;
        }
      }
      if (element.sheet && element.parentElement) {
        loaded();
      } else {
        element.addEventListener('load', loaded);
      }
      return;
    }
    skope.getStore(element, 'currentSubs', parentSubs);
    element.removeAttribute('s-cloak');
    if (element.hasAttribute('s-if')) {
      const comment = document.createComment('s-if');
      let ifElem: Element;
      const at = element.getAttribute('s-if');
      element.before(comment);
      element.remove();
      skope.deleteStore(element, 'currentSubs');
      ready((scopes) => {
        skope.getStore<subs>(comment, 'currentSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs)
        try {
          currentSubs.push(skope.watch(element.getAttributeNode('s-if'), watchRun(skope, scopes, at), (val, lastVal) => {
            if (val) {
              if (!ifElem) {
                ifElem = element.cloneNode(true) as Element;
                ifElem.removeAttribute('s-if');
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
          }, (err: Error) => {
            if (ifElem) {
              ifElem.remove();
              ifElem = undefined;
              unsubNested(nestedSubs);
            }
          }));
        } catch (err) {
          createError(err.message,  element.getAttributeNode('s-if'));
        }
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
      let split = at.split(' in ');
      if (split.length < 2) {
        throw createError('In valid s-for directive: ' + at, element.getAttributeNode('s-for'));
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
        if (!doubleMatch) throw createError('In valid s-for directive: ' + at, element.getAttributeNode('s-for'));
        key = doubleMatch[1];
        value = doubleMatch[2];
      }
      ready((scopes) => {
        const del = skope.wrapElem(comment.parentElement).delegate();
        currentSubs.push(del.off);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs);
        try {
          currentSubs.push(skope.watch(element.getAttributeNode('s-for'), watchRun(skope, scopes, exp), (val) => {
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
              elem.removeAttribute('s-for');
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
          }, () => {
            unsubNested(nestedSubs);
            items.forEach((item) => {
              item.remove(); // @TODO: optimize
            });
            items.clear();
          }));
        } catch (err) {
          createError(err.message, element.getAttributeNode('s-for'))
        }
      });
      return;
    }
    if (element.hasAttribute('s-component')) {
      ready((scopes) => {
        try {
          currentSubs.push(runDirective(skope, {
            element,
            att: element.getAttributeNode('s-component'),
            directive: 'component',
            js: '',
            original: element.outerHTML,
            subs: currentSubs,
            delegate
          }, scopes));
        } catch (err) {
          createError(err.message,  element);
        }
      });
      return;
    }
    let elementScopeAdded = false;
    for (let att of element.attributes) {
      if (att.nodeName.startsWith("$")) {
        const name = att.nodeName.substring(1).replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());
        if (!name.match(regVarName)) {
          createError(`Invalid variable name in attribute`, att);
          continue;
        };
        if (!elementScopeAdded) {
          elementScopeAdded = true;
          const execSteps: ((scopes: IElementScope[]) => void)[] = [];
          ready((s: IElementScope[]) => {
            let scopes = pushScope(skope, s, element, currentSubs);
            for (let cb of execSteps) {
              cb(scopes);
            }
          });
          ready = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
        }
        ready(scopes => {
          skope.execAsync(getRootElement(skope, scopes), `let ${name} = ${att.nodeValue}`, scopes).run().catch(createErrorCb(att));
        });
      }
    }
    if (element.hasAttribute('s-detached')) {
      let nestedScopes: [IRootScope, IElementScope?];
      const execSteps: ((scopes: IElementScope[]) => void)[] = [];
      ready((scopes) => {
        nestedScopes = [getScope(skope, element, currentSubs, {}, true) as IRootScope];
        if (elementScopeAdded) {
          nestedScopes[0].$templates = {...(scopes[scopes.length - 1] as any).$templates || {}};
          delete (scopes[scopes.length - 1] as any).$templates;
          nestedScopes.push(scopes[scopes.length - 1]);
        }
        for (let cb of execSteps) {
          cb(nestedScopes);
        }
      });
      ready = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    }
    if (element instanceof HTMLIFrameElement && element.hasAttribute('skope-iframe-content')) {
      ready(() => {
        const exec = () => {
          skope.wrapElem(element).html(element.getAttribute('skope-iframe-content'));
          element.removeAttribute('skope-iframe-content');
        }
        if (element.contentDocument.readyState !== 'complete') {
          element.addEventListener('load', exec);
        } else {
          exec();
        }
      });
    }
    if (element instanceof HTMLScriptElement) {
      if (element.type === 'skopejs') {
        ready((scopes) => {
          try {
            skope.exec(getRootElement(skope, scopes), element.innerHTML, scopes).run();
          } catch (err) {
            createError(err?.message, element);
          }
        });
      } else {
        element.remove();
      }
      return;
    } else {
      for (let att of element.attributes) {
        if (att.nodeName.startsWith(':')) {
          const at = att.nodeName.slice(1);
          const parts = at.split('.');
          ready((scopes) => {
            const $element = skope.wrapElem(element);
            try {
              currentSubs.push(skope.watch(att, watchRun(skope, scopes, att.nodeValue), (val: any, lastVal) => {
                if (typeof val === 'object' && ['style', 'class'].includes(at)) {
                  Object.entries(val).forEach((a) => Promise.resolve(a[1]).then((v) => {
                    if (at === 'class') {
                        $element.toggleClass(a[0], !!v);
                    } else {
                      if (element instanceof HTMLElement || element instanceof SVGElement) {
                        (<any>element.style)[a[0]] = v;
                      }
                    }
                  }, () => {
                    if (at === 'class') {
                      $element.toggleClass(a[0], false);
                    }
                  }));
                } else {
                  if (parts.length === 2 && ['style', 'class'].includes(parts[0])) {
                    if (parts[0] === 'class') {
                        $element.toggleClass(parts[1], !!val);
                    } else {
                      if (element instanceof HTMLElement || element instanceof SVGElement) {
                        (<any>element.style)[parts[1]] = val;
                      }
                    }
                  } else {
                    $element.attr(at, val + "");
                  }
                }
              }, () => {}));
            } catch (err) {
              createError(err.message, att)
            }
          });
        } else if (att.nodeName.startsWith('@')) {
          const transitionParts = att.nodeName.split('$');
          const parts = transitionParts[0].slice(1).split('.');
          const debouce = /^debounce(\((\d+)\))?$/.exec(parts[1] || "");
          const throttle = /^throttle(\((\d+)\))?$/.exec(parts[1] || "");
          const queue = /^queue(\((\d+)\))?$/.exec(parts[1] || "");
          if (parts[1] && !(debouce || throttle || queue || parts[1] === 'once')) {
            createError('Invalid event directive: ' + parts[1], att);
            continue;
          }
          const transitionVar = transitionParts[1]?.replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());;
          if (transitionVar) {
            if (!regVarName.test(transitionVar)) {
              createError(`Invalid variable name in attribute`, att);
              continue;
            }
          }
          ready((scopes) => {
            if (transitionVar) {
              skope.exec(getRootElement(skope, scopes), `if (typeof ${transitionVar} === 'undefined') var ${transitionVar}`, scopes).run();
            }
            let trans: Promise<unknown>;
            const evCb = (e: EqEvent) => {
              trans = skope.execAsync(getRootElement(skope, scopes), att.nodeValue, pushScope(skope, scopes, element, currentSubs, {$event: e})).run();
              trans.catch(() => {});
              if (transitionVar) {
                skope.exec(getRootElement(skope, scopes), `${transitionVar} = trans`, pushScope(skope, scopes, element, currentSubs, {trans})).run();
              }
            }
            let ev = evCb;
            if (debouce) {
              let timer: any = null;
              ev = (e: EqEvent) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                  timer = null;
                  evCb(e);
                }, Number(debouce[2] || 250));
              }
            }
            if (throttle) {
              if (throttle[2] === undefined) {
                let ready = false;
                ev = (e: EqEvent) => {
                  if (ready || !trans) {
                    ready = false;
                    evCb(e);
                    trans.then(() => ready = true, () => ready = true);
                  }
                }
              } else {
                let eobj: EqEvent;
                let timer: any = null;
                ev = (e: EqEvent) => {
                  eobj = e;
                  if (timer !== null) return
                  timer = setTimeout(() => {
                    timer = null;
                    evCb(eobj);
                  }, Number(throttle[2]));
                }
              }
            }

            if (queue) {
              let count = 0;
              let q: Promise<any> = Promise.resolve();
              ev = (e: EqEvent) => {
                if (!queue[2]  || Number(queue[2]) > count) {
                  count++;
                  q = q.then(() => {
                    evCb(e);
                    return trans;
                  }).catch(() => {}).then(() => count--);
                }
              }
            }
            if (parts[1] === 'once') {
              currentSubs.push(delegate.one(element, parts[0], ev));
            } else {
              currentSubs.push(delegate.on(element, parts[0], ev));
            }
          });
        } else if (att.nodeName.startsWith('s-')) {
          try {
            ready((scopes) => {
              currentSubs.push(runDirective(skope, {
                element,
                att,
                directive: att.nodeName.slice(2),
                js: att.nodeValue,
                original: element.outerHTML,
                subs: currentSubs,
                delegate
              }, pushScope(skope, scopes, element, currentSubs)));
            });
          } catch (err) {
            createError(err.message, att);
          }
        }
      }
    }
  }
  if (element instanceof Element && element.hasAttribute('s-static')) {
  } else {
    walkNested();
  }
}

export default class Skope {
  components: any = {};
  sanitizer: HTMLSanitizer;
  directives: {[name: string]: (exce: DirectiveExec, scopes: IElementScope[]) => subs} = {};

  globals = Sandbox.SAFE_GLOBALS;
  prototypeWhitelist = Sandbox.SAFE_PROTOTYPES;
  sandbox: Sandbox;
  sandboxCache: WeakMap<Node, {[code: string]: (...scopes: (any)[]) => {
    context: IExecContext;
    run: () => unknown;
  }|{
    context: IExecContext;
    run: () => Promise<unknown>;
  }}> = new WeakMap();
  ElementCollection: new (item?: number|Element, ...items: Element[]) => IElementCollection;
  wrap: (selector: wrapType, context: IElementCollection|Document) => IElementCollection;
  defaultDelegateObject: DelegateObject;
  getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
  deleteStore: (elem: Element, store: string) => boolean;
  RootScope: new (el: Element) => IRootScope;
  ElementScope: new (el: Element) => IElementScope;
  styleIds = 0;

  constructor(options?: {sanitizer?: HTMLSanitizer, executionQuote?: bigint, allowRegExp?: boolean}) {
    this.sanitizer = options?.sanitizer || new HTMLSanitizer();
    delete this.globals.Function;
    delete this.globals.eval;
    if (!options?.allowRegExp) {
      delete this.globals.RegExp;
    }
    initialize(this);
    this.sandbox = new Sandbox({
      globals: this.globals, 
      prototypeWhitelist: this.prototypeWhitelist,
      executionQuota: options?.executionQuote || 100000n
    });
  }

  defineComponent(name: string, comp: Component) {
    this.components[name] = comp;
    const prot = Object.getPrototypeOf(comp);
    if (prot !== Object.getPrototypeOf({}) && !this.sandbox.context.prototypeWhitelist.has(prot)) {
      this.sandbox.context.prototypeWhitelist.set(prot, new Set());
    }
  }

  wrapElem(el: Element) {
    return this.wrap(el, el.ownerDocument);
  }
  
  watch<T>(elem: Node, toWatch: () => T, handler: (val: T, lastVal: T|undefined) => void|Promise<void>, errorCb?: (err: Error) => void): subs {
    const watchGets: Map<any, Set<string>> = new Map();
    const subUnsubs: subs = [];
    let varSubs = varSubsStore.get(toWatch);
    if (!varSubs) {
      const context = this.sandbox.getContext(toWatch);
      if (!context) {
        createError('Non-sandbox watch callback', elem);
        return;
      }
      varSubs = createVarSubs(this, context);
    }
    let lastVal: any;
    let update = false;
    let start = Date.now();
    let count = 0;
    let lastPromise: any;
    let ignore = new WeakMap<any, Set<string>>()
    const digest = () => {
      if ((Date.now() - start) > 4000) {
        count = 0;
        start = Date.now();
      } else {
        if (count++ > 200) {
          createError('Too many digests', elem);
          return;
        }
      }
      unsubNested(subUnsubs);
      let g = varSubs?.subscribeGet((obj: any, name: string) => {
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
        createError(err?.message, elem);
        return;
      }
      g.unsubscribe();
      for (let item of watchGets) {
        const obj = item[0];
        for (let name of item[1]) {
          subUnsubs.push(varSubs?.subscribeSet(obj, name, () => {
            let names = ignore.get(obj);
            if (!names) {
              names = new Set();
              ignore.set(obj, names);
            }
            names.add(name);
          }).unsubscribe);
        }
      }
      for (let item of watchGets) {
        const obj = item[0];
        for (let name of item[1]) {
          subUnsubs.push(this.sandbox.subscribeSetGlobal(obj, name, (mod) => {
            if (ignore.get(obj)?.has(name)) {
              ignore.get(obj).delete(name);
              return;
            }
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
      const promise = Promise.resolve(!errorCb ? undefined : val);
      lastPromise = promise;
      promise.then((v) => {
        if (lastPromise !== promise) return;
        v = !errorCb ? val : v;
        if (v !== lastVal) {
          const temp = lastVal;
          lastVal = v;
          try {
            handler(v, temp);
          } catch (err) {
            createError(err?.message, elem);
          }
        }
      }, errorCb)
    }
    digest();
    return subUnsubs;
  }

  exec(el: Node, code: string, scopes: IElementScope[]): {
    context: IExecContext;
    run: () => unknown;
  } {
    el = el || document;
    let codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    const key = 'sync:' + code;
    codes[key] = codes[key] || this.sandbox.compile(code);
    return codes[key](...scopes);
  }

  execAsync(el: Node, code: string, scopes: IElementScope[]): {
    context: IExecContext;
    run: () => Promise<unknown>;
  } {
    el = el || document;
    let codes: {[code: string]: (...scopes: (any)[]) => {
      context: IExecContext;
      run: () => Promise<unknown>;
    }} = this.sandboxCache.get(el) as any || {};
    this.sandboxCache.set(el, codes);
    const key = 'async:' + code;
    codes[key] = codes[key] || this.sandbox.compileAsync(code);
    return codes[key](...scopes);
  }
  
  defineDirective(name: string, callback: (exce: DirectiveExec, scopes: IElementScope[]) => subs) {
    this.directives[name] = callback;
  }
  
  init(elem?: Element, component?: string, alreadyPreprocessed = false): {cancel: () => void} {
    const subs: subs = [];
  
    if (!alreadyPreprocessed) {
      let sub2 = this.sanitizer.observeAttribute(elem || document.documentElement, 's-static', () => {}, true, true);
      subs.push(sub2.cancel);
    }
    
    let sub = this.sanitizer.observeAttribute(elem || document.documentElement, 'skope', (el) => {
      const comp = component || el.getAttribute('skope');
      const scope = getScope(this, el, subs, this.components[comp] || {}, true);
      registerTemplates(this, el, [scope]);
      const processed = processHTML(this, el, subs, this.defaultDelegateObject);
      this.sanitizer.setAttributeForced(el, 'skope-processed', '');
      processed.run([scope]);
    }, false);

    subs.push(sub.cancel);

    return {
      cancel() {
        unsubNested(subs);
      }
    }
  }
}
