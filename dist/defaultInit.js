(function () {
    'use strict';

    var regHrefJS = /^\s*javascript\s*:/i;
    var regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
    var regSystemAtt = /^(:|@|\$|s\-)/;
    var defaultHTMLWhiteList = [HTMLBRElement, HTMLBodyElement, HTMLDListElement, HTMLDataElement, HTMLDataListElement, HTMLDivElement, HTMLFieldSetElement, HTMLFormElement, HTMLHRElement, HTMLHeadingElement, HTMLLIElement, HTMLLegendElement, HTMLMapElement, HTMLMetaElement, HTMLMeterElement, HTMLModElement, HTMLOListElement, HTMLOutputElement, HTMLParagraphElement, HTMLPreElement, HTMLProgressElement, HTMLQuoteElement, HTMLSpanElement, HTMLTableCaptionElement, HTMLTableCellElement, HTMLTableColElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTimeElement, HTMLTitleElement, HTMLUListElement, HTMLUnknownElement, HTMLTemplateElement, HTMLCanvasElement, HTMLElement];
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
    var styleIds = 0;
    var reservedAtrributes = new WeakMap();
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
        sanitizeType(this, [HTMLScriptElement], ['type'], (el, staticHtml) => {
          if (!el.type || el.type === 'text/javascript') {
            el.type = 'skopejs';
            var html = el.innerHTML;
            el.innerHTML = '';
            setTimeout(() => {
              el.innerHTML = html;
            });
          }

          return !staticHtml && el.type === "skopejs";
        });
        sanitizeType(this, [HTMLIFrameElement], [], el => {
          this.setAttributeForced(el, 'skope-iframe-content', el.innerHTML);
          return !el.src && !el.srcdoc;
        });
        var processedStyles = new WeakSet();
        sanitizeType(this, [HTMLStyleElement], [], (el, staticHtml) => {
          if (staticHtml) return false;

          var loaded = () => {
            var parent = el.parentElement;
            if (!parent) return false;
            if (processedStyles.has(el)) return true;
            processedStyles.add(el);

            if (!this.isAttributeForced(parent, 'skope-style')) {
              parent.removeAttribute('skope-style');
            }

            var id = parent.getAttribute('skope-style') || ++styleIds;
            this.setAttributeForced(parent, 'skope-style', id + "");
            var i = el.sheet.cssRules.length - 1;

            for (var rule of [...el.sheet.cssRules].reverse()) {
              if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
                el.sheet.deleteRule(i);
              }

              i--;
            }

            i = 0;

            for (var _rule of [...el.sheet.cssRules]) {
              if (_rule instanceof CSSStyleRule) {
                var cssText = _rule.style.cssText;
                el.sheet.deleteRule(i);
                el.sheet.insertRule("[skope-style=\"".concat(id, "\"] :is(").concat(_rule.selectorText, ") { ").concat(cssText, " }"), i);
              }

              i++;
            }
          };

          if (el.sheet && el.parentElement) {
            loaded();
          } else {
            el.addEventListener('load', loaded);
          }

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

        if (attName.match(regSystemAtt) || attName === 'skope') {
          if (!preprocess) return false;
        } else if (/^on[a-z]+$/.test(attName)) {
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

          if (!allowed || !allowed.element(element, staticHtml)) {
            element.remove();
            return;
          } else {
            for (var att of [...element.attributes]) {
              var _reservedAtrributes$g;

              var attValue = att.nodeValue;
              var attName = att.nodeName;

              if (!((_reservedAtrributes$g = reservedAtrributes.get(element)) !== null && _reservedAtrributes$g !== void 0 && _reservedAtrributes$g.has(attName)) && (!this.santizeAttribute(element, attName, attValue, !staticHtml) || staticHtml && ["id", "style"].includes(attName))) {
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

      isAttributeForced(elem, att) {
        var _reservedAtrributes$g2;

        return (_reservedAtrributes$g2 = reservedAtrributes.get(elem)) === null || _reservedAtrributes$g2 === void 0 ? void 0 : _reservedAtrributes$g2.has(att);
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

        var observeLoad = (elem, staticHtml) => {
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
        };

        var matches = elem => {
          return elem.matches(selector);
        };

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
                          observeLoad(el, staticHtml).then(el => {
                            cb(el);
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
      var skope = new mod.default({
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

      for (var _sub of subs) {
        _sub();
      }

      subs.length = 0;
    };

}());
//# sourceMappingURL=defaultInit.js.map
