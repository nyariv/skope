import createClass, { WrapType } from '../eQuery';
import { getScopes } from './scope';
import registerTemplates from '../parser/template';
import Skope, {
  IDirectiveDefinition, IElementCollection, IElementScope, IRootScope,
} from '../Skope';
import { Subs, unsubNested } from '../utils';
import directivesCollection from '../directives/_index';
import createElementScopeClass from './ElementScope';
import createRootScopeClass from './RootScope';

export default function initialize(skope: Skope) {
  const eQuery = createClass(() => skope.sanitizer);
  const {
    wrap, ElementCollection, getStore, deleteStore, defaultDelegateObject,
  } = eQuery;
  skope.defaultDelegateObject = defaultDelegateObject;
  skope.getStore = getStore;
  skope.deleteStore = deleteStore;
  skope.wrap = wrap as (selector: WrapType, context: IElementCollection | Document) => IElementCollection;

  const ElementScope = createElementScopeClass(skope, wrap, getStore);

  const RootScope = createRootScopeClass(skope, wrap, ElementScope);

  ElementCollection.prototype.html = function h(content?: string | Element | DocumentFragment | IElementCollection) {
    if (content === undefined) {
      return this.get(0)?.innerHTML;
    }
    if (content === null || !(content instanceof DocumentFragment || content instanceof Element || typeof content === 'string' || content instanceof ElementCollection)) {
      return this;
    }
    let elem = this.get(0);
    if (!elem) return this;
    let contentElem: Element | DocumentFragment;
    let html: Element | DocumentFragment | string;
    if (content instanceof ElementCollection) {
      html = (content as any).detach() as DocumentFragment;
    } else {
      html = content;
    }
    let currentSubs: Subs = skope.getStore<Subs>(elem, 'currentSubs', []);
    let scopes = getScopes(skope, elem, currentSubs);
    if (elem instanceof HTMLIFrameElement) {
      const prev = elem;
      unsubNested(skope.getStore<Subs>(elem.contentDocument.body, 'currentSubs'));
      elem = document.createElement('body');
      if (prev.matches('[s-static], [s-static] *')) {
        elem.setAttribute('s-static', '');
      }
      const prevSub = currentSubs;
      currentSubs = skope.getStore<Subs>(elem, 'currentSubs', []);
      prevSub.push(currentSubs);
      skope.getStore<Subs>(elem, 'currentSubs', currentSubs);
      skope.getStore<IElementScope[]>(elem, 'scopes', scopes);
      const sty = document.createElement('style');
      sty.innerHTML = 'body { padding: 0; margin: 0; }';
      prev.contentDocument.head.appendChild(sty);
      prev.contentDocument.body.replaceWith(elem);
      const recurse = (el: Element): string[] => {
        if (!el || !el.parentElement || el.matches('[skope]') || el.hasAttribute('s-detached')) return [];
        const styles = recurse(el.parentElement);
        styles.push(...skope.wrapElem(el.parentElement).children('style').map((e) => e.innerHTML));
        return styles;
      };
      recurse(prev).forEach((css) => {
        const st = document.createElement('style');
        st.innerHTML = css;
        prev.contentDocument.body.appendChild(st);
      });
    } else if (!(elem instanceof HTMLTemplateElement)) {
      for (const el of [...elem.children]) {
        unsubNested(getStore<Subs>(el, 'currentSubs'));
      }
      elem.innerHTML = '';
    }
    if (elem instanceof HTMLTemplateElement) {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = elem.content;
    } else {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = skope.preprocessHTML(skope, elem, html);
      registerTemplates(skope, contentElem, scopes);
    }
    elem.appendChild(contentElem);
    if (!elem.matches('[s-static], [s-static] *')) {
      const processed = skope.processHTML(skope, elem, currentSubs, defaultDelegateObject, true);
      processed.run(scopes);
    }
    return this;
  };
  ElementCollection.prototype.text = function t(set?: string) {
    if (set !== undefined) {
      const toSet = `${set}`;
      this.forEach((elem: Element) => {
        unsubNested(skope.getStore<Subs>(elem, 'childSubs'));
        elem.textContent = toSet;
      });
      return this;
    }
    return this.get(0)?.textContent.trim();
  };
  ElementCollection.prototype.detach = function d() {
    const contentElem = document.createElement('template');
    for (const elem of this) {
      unsubNested(skope.getStore<Subs>(elem, 'currentSubs'));
      contentElem.appendChild(elem);
    }
    return contentElem.content;
  };

  skope.RootScope = RootScope as new () => IRootScope;
  skope.ElementScope = ElementScope;
  skope.prototypeWhitelist.set(FileList, new Set());
  skope.prototypeWhitelist.set(File, new Set());
  skope.prototypeWhitelist.set(RootScope, new Set());
  skope.prototypeWhitelist.set(ElementCollection, new Set());
  skope.prototypeWhitelist.set(ElementScope, new Set());
  skope.ElementCollection = ElementCollection as new () => IElementCollection;

  const directives = directivesCollection(skope);

  for (const dir in directives) {
    skope.defineDirective(directives[dir]);
  }
}
