var regHrefJS = /^\s*javascript\s*:/i;
var regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
var regSystemAtt = /^(:|@|\$|s\-|skope)/;
var defaultHTMLWhiteList = [HTMLBRElement, HTMLBodyElement, HTMLDListElement, HTMLDataElement, HTMLDataListElement, HTMLDialogElement, HTMLDivElement, HTMLFieldSetElement, HTMLFormElement, HTMLHRElement, HTMLHeadingElement, HTMLLIElement, HTMLLegendElement, HTMLMapElement, HTMLMetaElement, HTMLMeterElement, HTMLModElement, HTMLOListElement, HTMLOutputElement, HTMLParagraphElement, HTMLPreElement, HTMLProgressElement, HTMLQuoteElement, HTMLSpanElement, HTMLTableCaptionElement, HTMLTableCellElement, HTMLTableColElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTimeElement, HTMLTitleElement, HTMLUListElement, HTMLUnknownElement, HTMLTemplateElement, HTMLCanvasElement, HTMLElement];
var globalAllowedAtttributes = new Set(['id', 'class', 'style', 'alt', 'role', 'aria-label', 'aria-labelledby', 'aria-hidden', 'tabindex', 'title', 'dir', 'lang', 'height', 'width']);
function sanitizeType(obj, t, allowedAttributes, element) {
  var s = new Set(allowedAttributes);

  for (var type of t) {
    obj.types.set(type, {
      attributes: s,
      element
    });
  }
}
class HTMLSanitizer {
  constructor() {
    this.types = new Map();
    this.srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
    this.allowedInputs = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'month', 'number', 'password', 'radio', 'range', 'reset', 'tel', 'text', 'time', 'url', 'week']);
    sanitizeType(this, defaultHTMLWhiteList, [], () => {
      return true;
    });
    sanitizeType(this, [HTMLAnchorElement, HTMLAreaElement], ['href', 'xlink:href', 'rel', 'shape', 'coords'], el => {
      return true;
    });
    sanitizeType(this, [HTMLButtonElement], ['type', 'value'], el => {
      if (el.type !== "reset" && el.type !== "button") {
        el.type = "button";
      }

      return true;
    });
    sanitizeType(this, [HTMLInputElement, HTMLSelectElement, HTMLOptGroupElement, HTMLOptionElement, HTMLLabelElement, HTMLTextAreaElement], ['value', 'type', 'checked', 'selected', 'name', 'for', 'max', 'min', 'placeholder', 'readonly', 'size', 'multiple', 'step', 'autocomplete', 'cols', 'rows', 'maxlength', 'disabled', 'required', 'accept', 'list'], el => {
      return true;
    });
    sanitizeType(this, [HTMLScriptElement], ['type'], el => {
      if (!el.type || el.type === 'text/javascript') {
        el.type = 'skopejs';
      }

      return el.type === "skopejs";
    });
    sanitizeType(this, [HTMLStyleElement], [], el => {
      return true;
    });
    sanitizeType(this, [HTMLPictureElement, HTMLImageElement, HTMLAudioElement, HTMLTrackElement, HTMLVideoElement, HTMLSourceElement], ['src', 'srcset', 'sizes', 'poster', 'autoplay', 'contorls', 'muted', 'loop', 'volume', 'loading'], el => {
      return true;
    });
  }

  santizeAttribute(element, attName, attValue) {
    var preprocess = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var allowed = this.types.get(element.constructor);
    if (!allowed) return false;
    attName = attName.toLowerCase();

    if (attName.match(regSystemAtt)) {
      if (!preprocess) return false;
    } else if (attName.startsWith('on')) {
      if (preprocess) {
        element.setAttribute('@' + attName.slice(2), attValue);
      }

      return false;
    } else if (allowed.attributes.has(attName) && this.srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
      var isJs = attValue.match(regHrefJS);

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

  sanitizeHTML(element) {
    var staticHtml = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (!(element instanceof DocumentFragment)) {
      var allowed = this.types.get(element.constructor);

      if (!allowed || !allowed.element(element) || staticHtml && (element instanceof HTMLStyleElement || element instanceof HTMLScriptElement)) {
        element.remove();
        return;
      } else {
        for (var att of [...element.attributes]) {
          var attValue = att.nodeValue;
          var attName = att.nodeName;

          if (!this.santizeAttribute(element, attName, attValue, !staticHtml) || staticHtml && ["id", "style"].includes(attName)) {
            element.removeAttribute(att.nodeName);
          }
        }
      }
    }

    if (element.children) {
      for (var el of [...element.children]) {
        this.sanitizeHTML(el, staticHtml);
      }
    }
  }

  observeAttribute(parent, att, cb, staticHtml) {
    var persistant = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    var subs = new Set();
    var selector = "[".concat(att, "]:not([").concat(att, "] [").concat(att, "])");

    var sanitize = elem => {
      if (staticHtml) {
        for (var el of elem.children) {
          this.sanitizeHTML(el, staticHtml);
        }
      } else {
        this.sanitizeHTML(elem, staticHtml);
      }
    };

    function observeLoad(elem, staticHtml) {
      return new Promise(resolve => {
        sanitize(elem);
        var observer = new MutationObserver(muts => {
          for (var mut of muts) {
            for (var target of mut.addedNodes) {
              if (target instanceof Element) {
                this.sanitizeHTML(target, staticHtml);
              }
            }
          }
        });
        document.addEventListener('DOMContentLoaded', () => {
          sub();
          resolve(elem);
        });
        observer.observe(elem, {
          childList: true,
          subtree: true
        });

        var sub = () => {
          observer.disconnect();
          subs.delete(sub);
        };

        subs.add(sub);
      });
    }

    if (document.readyState === 'loading' || persistant) {
      var found = new WeakSet();

      var isFound = elem => {
        if (!elem || elem === parent) return false;
        if (found.has(elem)) return true;
        return isFound(elem.parentElement);
      };

      var observer = new MutationObserver(muts => {
        for (var mut of muts) {
          for (var elem of mut.addedNodes) {
            if (elem instanceof Element) {
              if (document.readyState === 'loading') {
                if (!isFound(elem) && elem.matches(selector)) {
                  found.add(elem);
                  observeLoad(elem, staticHtml).then(el => {
                    cb(el);
                  });
                } else {
                  for (var el of elem.querySelectorAll(selector)) {
                    if (!isFound(el)) {
                      found.add(el);
                      observeLoad(el, staticHtml).then(el => {
                        cb(el);
                      });
                    }
                  }
                }
              } else if (elem.matches(selector)) {
                sanitize(elem);
                cb(elem);
              } else {
                for (var _el of elem.querySelectorAll(selector)) {
                  sanitize(elem);
                  cb(_el);
                }
              }
            }
          }
        }
      });

      if (!persistant) {
        document.addEventListener('DOMContentLoaded', () => {
          sub();
        });
      }

      observer.observe(parent, {
        childList: true,
        subtree: true
      });

      var sub = () => {
        observer.disconnect();
        subs.delete(sub);
      };

      subs.add(sub);
    }

    if (parent.matches(selector)) {
      sanitize(parent);
      cb(parent);
    } else {
      for (var el of parent.querySelectorAll(selector)) {
        sanitize(el);
        cb(el);
      }
    }

    return {
      cancel() {
        for (var _sub of subs) {
          _sub();
        }
      }

    };
  }

}

export { HTMLSanitizer as default, sanitizeType };
//# sourceMappingURL=HTMLSanitizer.js.map
