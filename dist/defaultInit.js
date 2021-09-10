(function () {
    'use strict';

    var regHrefJS = /^\s*javascript\s*:/i;
    var regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
    var regSystemAtt = /^(:|@|\$|s-)/;
    var regReservedSystemAtt = /^skope-/;
    var defaultHTMLWhiteList = [HTMLBRElement, HTMLBodyElement, HTMLDListElement, HTMLDataElement, HTMLDataListElement, HTMLDivElement, HTMLFieldSetElement, HTMLFormElement, HTMLHRElement, HTMLHeadingElement, HTMLLIElement, HTMLLegendElement, HTMLMapElement, HTMLMetaElement, HTMLMeterElement, HTMLModElement, HTMLOListElement, HTMLOutputElement, HTMLParagraphElement, HTMLPreElement, HTMLProgressElement, HTMLQuoteElement, HTMLSpanElement, HTMLTableCaptionElement, HTMLTableCellElement, HTMLTableColElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTimeElement, HTMLTitleElement, HTMLUListElement, HTMLUnknownElement, HTMLTemplateElement, HTMLCanvasElement, HTMLElement];
    var globalAllowedAtttributes = new Set(['id', 'class', 'style', 'alt', 'role', 'aria-label', 'aria-labelledby', 'aria-hidden', 'tabindex', 'title', 'dir', 'lang', 'height', 'width', 'slot']);
    function sanitizeType(obj, t, allowedAttributes, element) {
      var s = new Set(allowedAttributes);

      for (var type of t) {
        obj.types.set(type, {
          attributes: s,
          element
        });
      }
    }
    var reservedAtrributes = new WeakMap();
    class HTMLSanitizer {
      constructor() {
        this.types = new Map();
        this.srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
        this.allowedInputs = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'month', 'number', 'password', 'radio', 'range', 'reset', 'tel', 'text', 'time', 'url', 'week']);
        sanitizeType(this, defaultHTMLWhiteList, [], () => true);
        sanitizeType(this, [HTMLAnchorElement, HTMLAreaElement], ['href', 'xlink:href', 'rel', 'shape', 'coords'], el => true);
        sanitizeType(this, [HTMLButtonElement], ['type', 'value'], el => {
          if (el.type !== 'reset' && el.type !== 'button') {
            el.type = 'button';
          }

          return true;
        });
        sanitizeType(this, [HTMLInputElement, HTMLSelectElement, HTMLOptGroupElement, HTMLOptionElement, HTMLLabelElement, HTMLTextAreaElement], ['value', 'type', 'checked', 'selected', 'name', 'for', 'max', 'min', 'placeholder', 'readonly', 'size', 'multiple', 'step', 'autocomplete', 'cols', 'rows', 'maxlength', 'disabled', 'required', 'accept', 'list'], el => true);
        sanitizeType(this, [HTMLScriptElement], ['type'], (el, staticHtml) => {
          if (!el.type || el.type === 'text/javascript') {
            el.type = 'skopejs';
            var html = el.innerHTML;
            el.innerHTML = '';
            setTimeout(() => {
              el.innerHTML = html;
            });
          }

          return !staticHtml && el.type === 'skopejs';
        });
        sanitizeType(this, [HTMLIFrameElement], [], el => {
          if (!el.getAttribute('skope-iframe-content')) {
            this.setAttributeForced(el, 'skope-iframe-content', el.innerHTML);
          }

          el.innerHTML = '';
          return !el.src && !el.srcdoc;
        });
        sanitizeType(this, [HTMLStyleElement], [], (el, staticHtml) => {
          if (staticHtml) return false;
          return true;
        });
        sanitizeType(this, [HTMLPictureElement, HTMLImageElement, HTMLAudioElement, HTMLTrackElement, HTMLVideoElement, HTMLSourceElement], ['src', 'srcset', 'sizes', 'poster', 'autoplay', 'contorls', 'muted', 'loop', 'volume', 'loading'], el => true);
      }

      santizeAttribute(element, attName, attValue) {
        var preprocess = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
        var remove = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
        var allowed = this.types.get(element.constructor);
        if (!allowed) return false;
        attName = attName.toLowerCase();

        if (this.isAttributeForced(element, attName)) {
          if (remove) {
            return false;
          }
        } else if (attName.match(regSystemAtt) || attName === 'skope') {
          if (!preprocess) return false;
        } else if (/^on[a-z]+$/.test(attName)) {
          if (preprocess) {
            element.setAttribute("@".concat(attName.slice(2)), attValue);
          }

          return false;
        } else if (allowed.attributes.has(attName) && this.srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
          var isJs = attValue.match(regHrefJS);

          if (isJs) {
            if (preprocess && (attName === 'href' || attName === 'xlink:href')) {
              if (!element.hasAttribute('@click')) {
                element.setAttribute('@click', attValue.substring(isJs[0].length));
              }
            } else {
              return false;
            }
          } else if (!attValue.match(regValidSrc)) {
            return false;
          }
        } else if (!preprocess && element instanceof HTMLScriptElement) {
          return false;
        } else if (!allowed.attributes.has(attName) && !globalAllowedAtttributes.has(attName)) {
          return false;
        } else if (element instanceof HTMLInputElement && attName === 'type') {
          return this.allowedInputs.has(attValue);
        } else if (element instanceof HTMLButtonElement && attName === 'type') {
          return attValue === 'reset' || attValue === 'button';
        }

        return true;
      }

      sanitizeHTML(element) {
        var staticHtml = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

        if (!(element instanceof DocumentFragment)) {
          var allowed = this.types.get(element.constructor);

          if (!allowed || !allowed.element(element, staticHtml)) {
            element.remove();
            return;
          }

          for (var att of [...element.attributes]) {
            var attValue = att.nodeValue;
            var attName = att.nodeName;

            if (!this.santizeAttribute(element, attName, attValue, !staticHtml) || staticHtml && ['id', 'style'].includes(attName)) {
              element.removeAttribute(att.nodeName);
            }
          }
        }

        if (element.children) {
          var children = element instanceof HTMLTemplateElement ? element.content.children : element.children;

          for (var el of [...children]) {
            this.sanitizeHTML(el, staticHtml);
          }
        }
      }

      isAttributeForced(elem, att) {
        var _reservedAtrributes$g;

        return ((_reservedAtrributes$g = reservedAtrributes.get(elem)) === null || _reservedAtrributes$g === void 0 ? void 0 : _reservedAtrributes$g.has(att)) || regReservedSystemAtt.test(att) && elem.hasAttribute(att);
      }

      setAttributeForced(elem, att, value) {
        var reserved = reservedAtrributes.get(elem);

        if (!reserved) {
          reserved = new Set();
          reservedAtrributes.set(elem, reserved);
        }

        reserved.add(att);
        elem.setAttribute(att, value);
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

        var observeLoad = (elem, sHtml) => new Promise(resolve => {
          sanitize(elem);
          var observer = new MutationObserver(muts => {
            for (var mut of muts) {
              for (var target of mut.addedNodes) {
                if (target instanceof Element) {
                  this.sanitizeHTML(target, sHtml);
                }
              }
            }
          });
          document.addEventListener('readystatechange', () => {
            if (document.readyState !== 'loading') {
              setTimeout(() => {
                sub();
                resolve(elem);
              });
            }
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

        var matches = elem => elem.matches(selector);

        var loading = false;

        if (document.readyState === 'loading' || persistant) {
          loading = true;
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
                  if (loading) {
                    if (!isFound(elem) && matches(elem)) {
                      found.add(elem);
                      observeLoad(elem, staticHtml).then(el => {
                        cb(el);
                      });
                    } else {
                      for (var el of elem.querySelectorAll(selector)) {
                        if (!isFound(el)) {
                          found.add(el);
                          observeLoad(el, staticHtml).then(ell => {
                            cb(ell);
                          });
                        }
                      }
                    }
                  } else if (matches(elem)) {
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
            document.addEventListener('readystatechange', () => {
              if (document.readyState !== 'loading') {
                setTimeout(() => {
                  loading = false;
                  sub();
                });
              }
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

        if (matches(parent)) {
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

    var sanitizer = new HTMLSanitizer();
    var imps = ['./Skope.js'];
    var init = import(imps.pop()).then(mod => {
      var ISkope = mod.default;
      var skope = new ISkope({
        sanitizer
      });
      return el => skope.init(el, undefined, true);
    });
    var subs = [];
    var canceled = false;
    var sub = sanitizer.observeAttribute(document.documentElement, 'skope', el => {
      init.then(skope => {
        if (!canceled) {
          sub = skope(el);
          subs.push(sub.cancel);
        }
      });
    }, false);
    subs.push(sub.cancel);
    sub = sanitizer.observeAttribute(document.documentElement, 's-static', () => {}, true, true);
    subs.push(sub.cancel);

    globalThis.cancelSkope = function cancel() {
      canceled = true;

      for (var cb of subs) {
        cb();
      }

      subs.length = 0;
    };

}());
//# sourceMappingURL=defaultInit.js.map
