import createClass, { wrapType } from "../eQuery";
import { preprocessHTML, processHTML } from "../parser/process";
import { getScopes } from "../parser/scope";
import { registerTemplates } from "../parser/template";
import Skope, { IElementCollection, IElementScope, IRootScope } from "../Skope";
import { subs, unsubNested } from "../utils";
import directivesCollection from '../directives/_index';


export function initialize (skope: Skope) {
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
    let currentSubs: subs = skope.getStore<subs>(elem, 'currentSubs', []);
    let scopes = getScopes(skope, elem, currentSubs);
    if (elem instanceof HTMLIFrameElement) {
      const prev = elem;
      unsubNested(skope.getStore<subs>(elem.contentDocument.body, 'currentSubs'));
      elem = document.createElement('body');
      if (prev.matches('[s-static], [s-static] *')) {
        elem.setAttribute('s-static', '')
      }
      const prevSub = currentSubs;
      currentSubs = skope.getStore<subs>(elem, 'currentSubs', []);
      prevSub.push(currentSubs);
      skope.getStore<subs>(elem, 'currentSubs', currentSubs);
      skope.getStore<IElementScope[]>(elem, 'scopes', scopes);
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
        unsubNested(skope.getStore<subs>(elem, 'childSubs'));
        elem.textContent = toSet;
      });
      return this;
    }
    return this.get(0)?.textContent.trim();
  };
  ElementCollection.prototype.detach = function () {
    const contentElem = document.createElement('template');
    for (let elem of this) {
      unsubNested(skope.getStore<subs>(elem, 'currentSubs'));
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
  
  const directives = directivesCollection(skope);

  for (let dir in directives) {
    skope.defineDirective(dir, directives[dir]);
  }
}