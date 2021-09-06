

const regHrefJS = /^\s*javascript\s*:/i;
const regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
const regSystemAtt = /^(:|@|\$|s\-)/;
const defaultHTMLWhiteList: (new () => Element)[] = [
  HTMLBRElement,
  HTMLBodyElement,
  HTMLDListElement,
  HTMLDataElement,
  HTMLDataListElement,
  HTMLDialogElement,
  HTMLDivElement,
  HTMLFieldSetElement,
  HTMLFormElement,
  HTMLHRElement,
  HTMLHeadingElement,
  HTMLLIElement,
  HTMLLegendElement,
  HTMLMapElement,
  HTMLMetaElement,
  HTMLMeterElement,
  HTMLModElement,
  HTMLOListElement,
  HTMLOutputElement,
  HTMLParagraphElement,
  HTMLPreElement,
  HTMLProgressElement,
  HTMLQuoteElement,
  HTMLSpanElement,
  HTMLTableCaptionElement,
  HTMLTableCellElement,
  HTMLTableColElement,
  HTMLTableElement,
  HTMLTableSectionElement,
  HTMLTableRowElement,
  HTMLTimeElement,
  HTMLTitleElement,
  HTMLUListElement,

  HTMLUnknownElement,
  HTMLTemplateElement,
  HTMLCanvasElement,
  HTMLElement
];

const globalAllowedAtttributes = new Set([
  'id', 
  'class', 
  'style', 
  'alt', 
  'role',
  'aria-label',
  'aria-labelledby',
  'aria-hidden',
  'tabindex', 
  'title', 
  'dir', 
  'lang',
  'height',
  'width'
]);

export function sanitizeType(obj: HTMLSanitizer, t: (new () => Element)[], allowedAttributes: string[], element: (el: Element, preprocess: boolean) => boolean) {
  const s = new Set(allowedAttributes);
  for (let type of t) {
    obj.types.set(type, {attributes: s, element});
  }
}


let styleIds = 0;
const reservedAtrributes: WeakMap<Element, Set<string>> = new WeakMap();

export default class HTMLSanitizer {
  types: Map<new () => Element, {attributes: Set<string>, element: (el: Element, staticHtml: boolean) => boolean|void}> = new Map();
  srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
  allowedInputs = new Set([
    'button',
    'checkbox',
    'color', 
    'date', 
    'datetime-local', 
    'email', 
    'file', 
    'month', 
    'number', 
    'password',
    'radio', 
    'range',
    'reset',
    'tel', 
    'text', 
    'time', 
    'url', 
    'week'
  ]);
  
  constructor() {
    sanitizeType(this, defaultHTMLWhiteList, [], () => { return true;});
    
    sanitizeType(this, [HTMLAnchorElement, 
                  HTMLAreaElement],
                  ['href', 
                  'xlink:href', 
                  'rel', 
                  'shape', 
                  'coords'], (el: Element) => { return true; });
    sanitizeType(this, [HTMLButtonElement], ['type', 'value'], (el: HTMLButtonElement) => {
      if (el.type !== "reset" && el.type !== "button") {
        el.type = "button"
      }
      return true; 
    });
    sanitizeType(this, [HTMLInputElement,
                  HTMLSelectElement,
                  HTMLOptGroupElement,
                  HTMLOptionElement,
                  HTMLLabelElement,
                  HTMLTextAreaElement], 
                  ['value', 
                  'type', 
                  'checked', 
                  'selected', 
                  'name', 
                  'for',
                  'max',
                  'min',
                  'placeholder',
                  'readonly',
                  'size',
                  'multiple',
                  'step',
                  'autocomplete',
                  'cols',
                  'rows',
                  'maxlength',
                  'disabled',
                  'required',
                  'accept',
                  'list'], (el: Element) => {
      return true;
    });
    sanitizeType(this, [HTMLScriptElement], ['type'], (el: HTMLScriptElement, staticHtml) => {
      if (!el.type || el.type === 'text/javascript') {
        el.type = 'skopejs';
      }
      return !staticHtml && el.type === "skopejs";
    });

    sanitizeType(this, [HTMLIFrameElement], [], (el: HTMLIFrameElement) => {
      this.setAttributeForced(el, 'skope-iframe-content', el.innerHTML);
      el.innerHTML = '';
      return !el.src && !el.srcdoc;
    })

    const processedStyles: WeakSet<HTMLStyleElement> = new WeakSet();
    sanitizeType(this, [HTMLStyleElement], [], (el: HTMLStyleElement, staticHtml) => {
      if (staticHtml) return false;
      const loaded = () => {
        const parent = el.parentElement;
        if (!parent) return false;
        if (processedStyles.has(el)) return true;
        processedStyles.add(el);
        if (!this.isAttributeForced(parent, 'skope-style')) {
          parent.removeAttribute('skope-style');
        }
        const id = parent.getAttribute('skope-style') || ++styleIds;
        this.setAttributeForced(parent, 'skope-style', id + "");
        let i = el.sheet.cssRules.length - 1;
        for (let rule of [...el.sheet.cssRules].reverse()) {
          if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
            el.sheet.deleteRule(i);
          }
          i--;
        }
        i = 0;
        for (let rule of [...el.sheet.cssRules]) {
          if (rule instanceof CSSStyleRule) {
            var cssText = rule.style.cssText;
            el.sheet.deleteRule(i);
            el.sheet.insertRule(`[skope-style="${id}"] :is(${rule.selectorText}) { ${cssText} }`, i);
          }
          i++;
        }
      }
      if (el.sheet && el.parentElement) {
        loaded();
      } else {
        el.addEventListener('load', loaded);
      }
      return true; 
    });
    sanitizeType(this, [HTMLPictureElement, 
                  HTMLImageElement, 
                  HTMLAudioElement,
                  HTMLTrackElement,
                  HTMLVideoElement,
                  HTMLSourceElement], 
                  ['src',
                  'srcset',
                  'sizes',
                  'poster', 
                  'autoplay', 
                  'contorls', 
                  'muted', 
                  'loop', 
                  'volume',
                  'loading'], (el: Element) => { return true; });
  }

  santizeAttribute(element: Element, attName: string, attValue: string, preprocess = false): boolean {
    const allowed = this.types.get(element.constructor as new () => Element);
    if (!allowed) return false;
    attName = attName.toLowerCase();
    if (attName.match(regSystemAtt) || attName === 'skope') {
      if (!preprocess) return false;
    } else if (/^on[a-z]+$/.test(attName)) {
      if (preprocess) {
        element.setAttribute('@' + attName.slice(2), attValue);
      }
      return false;
    } else if (allowed.attributes.has(attName) && this.srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
      const isJs = attValue.match(regHrefJS);
      if (isJs) {
        if (preprocess && (attName === 'href' || attName === 'xlink:href')) {
          if (!element.hasAttribute('@click')) {
            element.setAttribute('@click', attValue.substring(isJs[0].length));
          }
          element.setAttribute(attName, 'javascript:void(0)');
        } else {
          return false;
        }
      } else if (!attValue.match(regValidSrc)) {
        return false;
      }
    } else if (!allowed.attributes.has(attName) && !globalAllowedAtttributes.has(attName)) {
      return false;
    } else if (element instanceof HTMLInputElement && attName == 'type') {
      return this.allowedInputs.has(attValue);
    } else if (element instanceof HTMLButtonElement && attName == 'type') {
      return attValue === 'reset' || attValue === 'button';
    }
    return true;
  }

  sanitizeHTML(element: Element|DocumentFragment, staticHtml = false) {
    if (!(element instanceof DocumentFragment)) {
      const allowed = this.types.get(element.constructor as new () => Element);
      if (!allowed || !allowed.element(element, staticHtml)) {
        element.remove();
        return;
      } else {
        for (let att of [...element.attributes]) {
          const attValue = att.nodeValue;
          const attName = att.nodeName;
          if (!reservedAtrributes.get(element)?.has(attName) && (!this.santizeAttribute(element, attName, attValue, !staticHtml) || (staticHtml && ["id", "style"].includes(attName)))) {
            element.removeAttribute(att.nodeName);
          }
        }
      }
    }
    if (element.children) {
      for (let el of [...element.children]) {
        this.sanitizeHTML(el, staticHtml);
      }
    }
  }

  isAttributeForced(elem: Element, att: string) {
    return reservedAtrributes.get(elem)?.has(att);
  }

  setAttributeForced(elem: Element, att: string, value: string) {
    let reserved = reservedAtrributes.get(elem);
    if (!reserved) {
      reserved = new Set();
      reservedAtrributes.set(elem, reserved);
    }
    reserved.add(att);
    elem.setAttribute(att, value);
  }

  observeAttribute(parent: Element, att: string, cb: (elem: Element) => void, staticHtml: boolean, persistant = false): {cancel: () => void} {
    const subs: Set<() => void> = new Set();

    let selector = `[${att}]:not([${att}] [${att}])`;
    const sanitize = (elem: Element) => {
      if (staticHtml) {
        for (let el of elem.children) {
          this.sanitizeHTML(el, staticHtml);
        }
      } else {
        this.sanitizeHTML(elem, staticHtml);
      }
    }

    const observeLoad = (elem: Element, staticHtml: boolean) => {
      return new Promise<Element>((resolve) => {
        sanitize(elem);
        const observer = new MutationObserver((muts) => {
          for (let mut of muts) {
            for (let target of mut.addedNodes) {
              if (target instanceof Element) {
                this.sanitizeHTML(target, staticHtml);
              }
            }
          }
        });
        document.addEventListener('readystatechange', () => {
          if (document.readyState !== 'loading') {
            setTimeout(() => {
              sub();
              resolve(elem);
            })
          }
        });
        observer.observe(elem, {childList: true, subtree: true});
        const sub = () => {
          observer.disconnect();
          subs.delete(sub);
        }
        subs.add(sub);
      });
    }

    const matches = (elem: Element) => {
      return elem.matches(selector);
    }

    let loading = false;
  
    if (document.readyState === 'loading' || persistant) {
      loading = true;
      const found = new WeakSet();
      const isFound = (elem: Element): boolean => {
        if (!elem || elem === parent) return false;
        if (found.has(elem)) return true;
        return isFound(elem.parentElement);
      }
      const observer = new MutationObserver((muts) => {
        for (let mut of muts) {
          for (let elem of mut.addedNodes) {
            if (elem instanceof Element) {
              if (loading) {
                if (!isFound(elem) && matches(elem)) {
                  found.add(elem);
                  observeLoad(elem, staticHtml).then((el) => {
                    cb(el);
                  })
                } else {
                  for (let el of elem.querySelectorAll(selector)) {
                    if (!isFound(el)) {
                      found.add(el);
                      observeLoad(el, staticHtml).then((el) => {
                        cb(el);
                      })
                    }
                  }
                }
              } else if (matches(elem)) {
                sanitize(elem);
                cb(elem);
              } else {
                for (let el of elem.querySelectorAll(selector)) {
                  sanitize(elem);
                  cb(el);
                }
              }
            }
          }
        }
      });
      if (!persistant) {
        document.addEventListener('readystatechange', () => {
          if (document.readyState !== 'loading') {
            setTimeout(() => {
              loading = false;
              sub();
            })
          }
        });
      }
      observer.observe(parent, {childList: true, subtree: true});
      const sub = () => {
        observer.disconnect();
        subs.delete(sub);
      }
      subs.add(sub);
    }
  
    if (matches(parent)) {
      sanitize(parent);
      cb(parent);
    } else {
      for (let el of parent.querySelectorAll(selector)) {
        sanitize(el);
        cb(el);
      }
    }

    return {
      cancel() {
        for (let sub of subs) {
          sub();
        }
      }
    }
  }
  
}