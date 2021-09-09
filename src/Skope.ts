// @ts-check

import Sandbox, { IExecContext } from '@nyariv/sandboxjs';
import { WrapType, DelegateObject, IElementCollection as IElemCollection } from './eQuery';
import HTMLSanitizer from './HTMLSanitizer';
import { Subs, unsubNested } from './utils';
import { walkerInstance, walkTree } from './parser/walker';
import initialize from './runtime/initialize';
import { getScope } from './runtime/scope';
import registerTemplates from './parser/template';
import { watch } from './runtime/watch';

export interface Component {}

export interface IElementCollection extends IElemCollection {
  html(): string;
  html(content: string | Element | DocumentFragment | IElementCollection): IElemCollection;
  text(): string;
  text(set: string): IElementCollection;
}

export interface IElementScope {
  $el: IElementCollection;
  $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
  $watch(cb: () => any, callback: (val: any, lastVal: any) => void): { unsubscribe: () => void };
  $delay(ms: number): Promise<void>;
}
export interface IRootScope extends IElementScope {
  $templates: { [name: string]: HTMLTemplateElement };
  $refs: { [name: string]: IElementCollection };
  $wrap(element: WrapType): IElementCollection;
}

export interface DirectiveExec {
  element: Element,
  att: Node,
  directive: string,
  js: string,
  original: string,
  subs: Subs,
  delegate: DelegateObject
}

export interface IDirectiveDefinition {
  name: string;
  callback: (exec: DirectiveExec, scopes: IElementScope[]) => Subs
}

export default class Skope {
  components: any = {};

  sanitizer: HTMLSanitizer;

  directives: { [name: string]: (exec: DirectiveExec, scopes: IElementScope[]) => Subs } = {};

  globals = Sandbox.SAFE_GLOBALS;

  prototypeWhitelist = Sandbox.SAFE_PROTOTYPES;

  sandbox: Sandbox;

  sandboxCache: WeakMap<Node, { [code: string]: (...scopes: (any)[]) => {
    context: IExecContext;
    run: () => unknown;
  } | {
    context: IExecContext;
    run: () => Promise<unknown>;
  } }> = new WeakMap();

  ElementCollection: new (item?: number | Element, ...items: Element[]) => IElementCollection;

  wrap: (selector: WrapType, context: IElementCollection | Document) => IElementCollection;

  defaultDelegateObject: DelegateObject;

  getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;

  deleteStore: (elem: Element, store: string) => boolean;

  RootScope: new (el: Element) => IRootScope;

  ElementScope: new (el: Element) => IElementScope;

  styleIds = 0;

  calls: (() => void)[] = [];

  callTimer: any;

  constructor(options?: { sanitizer?: HTMLSanitizer, executionQuote?: bigint, allowRegExp?: boolean }) {
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
      executionQuota: options?.executionQuote || 100000n,
    });
  }

  call(cb: () => void) {
    this.calls.push(cb);
    if (this.callTimer) return;
    this.callTimer = setTimeout(() => {
      this.callTimer = null;
      const toCall = [...this.calls];
      this.calls.length = 0;
      for (const c of toCall) {
        try {
          c();
        } catch (err) {
          console.error(err);
        }
      }
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

  watch<T>(elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): Subs {
    return watch(this, elem, toWatch, handler, errorCb);
  }

  exec(el: Node, code: string, scopes: IElementScope[]): {
    context: IExecContext;
    run: () => unknown;
  } {
    el = el || document;
    const codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    const key = `sync:${code}`;
    codes[key] = codes[key] || this.sandbox.compile(code);
    return codes[key](...scopes);
  }

  execAsync(el: Node, code: string, scopes: IElementScope[]): {
    context: IExecContext;
    run: () => Promise<unknown>;
  } {
    el = el || document;
    const codes: { [code: string]: (...scs: (any)[]) => {
      context: IExecContext;
      run: () => Promise<unknown>;
    } } = this.sandboxCache.get(el) as any || {};
    this.sandboxCache.set(el, codes);
    const key = `async:${code}`;
    codes[key] = codes[key] || this.sandbox.compileAsync(code);
    return codes[key](...scopes);
  }

  defineDirective(exec: IDirectiveDefinition) {
    this.directives[exec.name] = exec.callback;
  }

  init(elem?: Element, component?: string, alreadyPreprocessed = false): { cancel: () => void } {
    const subs: Subs = [];

    if (!alreadyPreprocessed) {
      const sub2 = this.sanitizer.observeAttribute(elem || document.documentElement, 's-static', () => {}, true, true);
      subs.push(sub2.cancel);
    }

    const sub = this.sanitizer.observeAttribute(elem || document.documentElement, 'skope', (el) => {
      const comp = component || el.getAttribute('skope');
      const scope = getScope(this, el, subs, this.components[comp] || {}, true);
      registerTemplates(this, el, [scope]);
      const processed = this.processHTML(this, el, subs, this.defaultDelegateObject);
      this.sanitizer.setAttributeForced(el, 'skope-processed', '');
      processed.run([scope]);
    }, false);

    subs.push(sub.cancel);

    return {
      cancel() {
        unsubNested(subs);
      },
    };
  }

  preprocessHTML(skope: Skope, parent: Element, html: DocumentFragment | Element | string): DocumentFragment | Element {
    let elem: DocumentFragment | Element;
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
      for (const el of elem.querySelectorAll('[s-static]:not([s-static] [s-static])')) {
        for (const child of el.children) {
          skope.sanitizer.sanitizeHTML(child, true);
        }
      }
      skope.sanitizer.sanitizeHTML(elem);
    }
    return elem;
  }

  processHTML(skope: Skope, elem: Node, subs: Subs, delegate: DelegateObject, skipFirst = false) {
    const exec = walkerInstance();
    walkTree(skope, elem, subs, exec.ready, delegate, skipFirst);
    return {
      elem,
      run: exec.run,
    };
  }
}
