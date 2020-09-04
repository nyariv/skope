

export const defaultHTMLWhiteList: (new () => Element)[] = [
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
              HTMLAreaElement],
              ['href', 
              'xlink:href', 
              'rel', 
              'shape', 
              'coords'], (el: Element) => { return true; });
sanitizeType([], ['href', ], (el: Element) => { return true; });
sanitizeType([HTMLButtonElement], ['type', 'value'], (el: HTMLButtonElement) => {
  if (el.type !== "reset" && el.type !== "button") {
    el.type = "button"
  }
  return true; 
});
const allowedInputs = new Set([
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
              'maxlength',
              'disabled',
              'required',
              'accept',
              'list'], (el: Element) => {
  return true;
});
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
const regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
const regSystemAtt = /^(:|@|\$|x\-)/;

const srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);

export function santizeAttribute(element: Element, attName: string, attValue: string, preprocess = false): boolean {
  const allowed = types.get(element.constructor as new () => Element);
  if (!allowed) return false;
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
  } else if (element instanceof HTMLInputElement && attName == 'type') {
    return allowedInputs.has(attValue);
  } else if (element instanceof HTMLButtonElement && attName == 'type') {
    return attValue === 'reset' || attValue === 'button';
  }
  return true;
}

export function sanitizeHTML(element: Element|DocumentFragment, staticHtml = false) {
  if (!(element instanceof DocumentFragment)) {
    const allowed = types.get(element.constructor as new () => Element);
    if (!allowed || !allowed.element(element) || (staticHtml && (element instanceof HTMLStyleElement || element instanceof HTMLScriptElement))) {
      element.remove();
      return;
    } else {
      for (let att of [...element.attributes]) {
        const attValue = att.nodeValue;
        const attName = att.nodeName;
        if (!santizeAttribute(element, attName, attValue, !staticHtml) || (staticHtml && ["id", "style"].includes(attName))) {
          element.removeAttribute(att.nodeName);
        }
      }
    }
  }
  if (element.children) {
    for (let el of [...element.children]) {
      sanitizeHTML(el, staticHtml);
    }
  }
}