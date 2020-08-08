

export const defaultHTMLWhiteList: (new () => Element)[] = [
  HTMLBRElement,
  HTMLBodyElement,
  HTMLDListElement,
  HTMLDataElement,
  HTMLDataListElement,
  HTMLDialogElement,
  HTMLDivElement,
  HTMLFieldSetElement,
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
]

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

const types: Map<new () => Element, {attributes: Set<string>, element: (el: Element) => boolean|void}> = new Map();

function sanitizeType(t: (new () => Element)[], allowedAttributes: string[], element: (el: Element) => boolean) {
  const s = new Set(allowedAttributes);
  for (let type of t) {
    types.set(type, {attributes: s, element});
  }
}

sanitizeType(defaultHTMLWhiteList, [], () => { return true;});

sanitizeType([HTMLAnchorElement, 
              SVGAElement, 
              HTMLAreaElement],
              ['href', 
              'xlink:href', 
              'rel', 
              'shape', 
              'coords'], (el: Element) => { return true; });
sanitizeType([], ['href', ], (el: Element) => { return true; });
sanitizeType([HTMLButtonElement], ['type'], (el: Element) => { return true; });
sanitizeType([HTMLInputElement,
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
              'disabled',
              'required'], (el: Element) => { return true;});
sanitizeType([HTMLScriptElement], ['type'], (el: HTMLScriptElement) => {
  if (!el.type || el.type === 'text/javascript') {
    el.type = 'scopejs';
  }
  return el.type === "scopejs";
});
sanitizeType([HTMLStyleElement], [], (el: Element) => { return true; });
sanitizeType([HTMLPictureElement, 
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

const regHrefJS = /^\s*javascript:/i;
const regValidSrc = /^((https?:)?\/\/|\/|#)/;
const regSystemAtt = /^(:|@|x-)/;

const srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);

export function santizeAttribute(element: Element, attName: string, attValue: string, preprocess = false): boolean {
  const allowed = types.get(element.constructor as new () => Element);
  attName = attName.toLowerCase();
  if (attName.match(regSystemAtt)) {
    if (!preprocess) return false;
  } else if (attName.startsWith('on')) {
    if (preprocess) {
      element.setAttribute('@' + attName.slice(2), attValue);
    }
    return false;
  } else if (allowed.attributes.has(attName) && srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
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
  }
  return true;
}

export function sanitizeHTML(element: Element|DocumentFragment) {
  const allowed = types.get(element.constructor as new () => Element);
  if (!(element instanceof DocumentFragment)) {
    if (!allowed || !allowed.element(element)) {
      element.remove();
      return;
    } else {
      for (let att of element.attributes) {
        const attValue = att.nodeValue;
        const attName = att.nodeName;
        if (!santizeAttribute(element, attName, attValue, true)) {
          element.removeAttribute(att.nodeName);
        }
      }
    }
  }
  for (let el of element.children) {
    sanitizeHTML(el);
  }
}