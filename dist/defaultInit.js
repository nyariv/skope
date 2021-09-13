(function () {
    'use strict';

    const regHrefJS = /^\s*javascript\s*:/i;
    const regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
    const regSystemAtt = /^(:|@|\$|s-)/;
    const regReservedSystemAtt = /^skope-/;
    const defaultHTMLWhiteList = [
        HTMLBRElement,
        HTMLBodyElement,
        HTMLDListElement,
        HTMLDataElement,
        HTMLDataListElement,
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
        HTMLElement,
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
        'width',
        'slot',
    ]);
    function sanitizeType(obj, t, allowedAttributes, element) {
        const s = new Set(allowedAttributes);
        for (const type of t) {
            obj.types.set(type, { attributes: s, element });
        }
    }
    const reservedAtrributes = new WeakMap();
    class HTMLSanitizer {
        constructor() {
            this.types = new Map();
            this.srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
            this.allowedInputs = new Set([
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
                'week',
            ]);
            sanitizeType(this, defaultHTMLWhiteList, [], () => true);
            sanitizeType(this, [HTMLAnchorElement,
                HTMLAreaElement], ['href',
                'xlink:href',
                'rel',
                'shape',
                'coords'], (el) => true);
            sanitizeType(this, [HTMLButtonElement], ['type', 'value'], (el) => {
                if (el.type !== 'reset' && el.type !== 'button') {
                    el.type = 'button';
                }
                return true;
            });
            sanitizeType(this, [HTMLInputElement,
                HTMLSelectElement,
                HTMLOptGroupElement,
                HTMLOptionElement,
                HTMLLabelElement,
                HTMLTextAreaElement], ['value',
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
                'list'], (el) => true);
            sanitizeType(this, [HTMLScriptElement], ['type'], (el, staticHtml) => {
                if (!el.type || el.type === 'text/javascript') {
                    el.type = 'skopejs';
                    const html = el.innerHTML;
                    el.innerHTML = '';
                    setTimeout(() => {
                        el.innerHTML = html;
                    });
                }
                return !staticHtml && el.type === 'skopejs';
            });
            sanitizeType(this, [HTMLIFrameElement], [], (el) => {
                if (!el.getAttribute('skope-iframe-content')) {
                    this.setAttributeForced(el, 'skope-iframe-content', el.innerHTML);
                }
                el.innerHTML = '';
                return !el.src && !el.srcdoc;
            });
            sanitizeType(this, [HTMLStyleElement], [], (el, staticHtml) => {
                if (staticHtml)
                    return false;
                return true;
            });
            sanitizeType(this, [HTMLPictureElement,
                HTMLImageElement,
                HTMLAudioElement,
                HTMLTrackElement,
                HTMLVideoElement,
                HTMLSourceElement], ['src',
                'srcset',
                'sizes',
                'poster',
                'autoplay',
                'contorls',
                'muted',
                'loop',
                'volume',
                'loading'], (el) => true);
        }
        santizeAttribute(element, attName, attValue, preprocess = false, remove = false) {
            const allowed = this.types.get(element.constructor);
            if (!allowed)
                return false;
            attName = attName.toLowerCase();
            if (this.isAttributeForced(element, attName)) {
                if (remove) {
                    return false;
                }
            }
            else if (attName.match(regSystemAtt) || attName === 'skope') {
                if (!preprocess)
                    return false;
            }
            else if (/^on[a-z]+$/.test(attName)) {
                if (preprocess) {
                    element.setAttribute(`@${attName.slice(2)}`, attValue);
                }
                return false;
            }
            else if (allowed.attributes.has(attName) && this.srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
                const isJs = attValue.match(regHrefJS);
                if (isJs) {
                    if (preprocess && (attName === 'href' || attName === 'xlink:href')) {
                        if (!element.hasAttribute('@click')) {
                            element.setAttribute('@click', attValue.substring(isJs[0].length));
                        }
                    }
                    else {
                        return false;
                    }
                }
                else if (!attValue.match(regValidSrc)) {
                    return false;
                }
            }
            else if (!preprocess && element instanceof HTMLScriptElement) {
                return false;
            }
            else if (!allowed.attributes.has(attName) && !globalAllowedAtttributes.has(attName)) {
                return false;
            }
            else if (element instanceof HTMLInputElement && attName === 'type') {
                return this.allowedInputs.has(attValue);
            }
            else if (element instanceof HTMLButtonElement && attName === 'type') {
                return attValue === 'reset' || attValue === 'button';
            }
            return true;
        }
        sanitizeHTML(element, staticHtml = false) {
            if (!(element instanceof DocumentFragment)) {
                const allowed = this.types.get(element.constructor);
                if (!allowed || !allowed.element(element, staticHtml)) {
                    element.remove();
                    return;
                }
                for (const att of [...element.attributes]) {
                    const attValue = att.nodeValue;
                    const attName = att.nodeName;
                    if (!this.santizeAttribute(element, attName, attValue, !staticHtml) || (staticHtml && ['id', 'style'].includes(attName))) {
                        element.removeAttribute(att.nodeName);
                    }
                }
            }
            if (element.children) {
                const children = element instanceof HTMLTemplateElement ? element.content.children : element.children;
                for (const el of [...children]) {
                    this.sanitizeHTML(el, staticHtml);
                }
            }
        }
        isAttributeForced(elem, att) {
            return reservedAtrributes.get(elem)?.has(att) || (regReservedSystemAtt.test(att) && elem.hasAttribute(att));
        }
        setAttributeForced(elem, att, value) {
            let reserved = reservedAtrributes.get(elem);
            if (!reserved) {
                reserved = new Set();
                reservedAtrributes.set(elem, reserved);
            }
            reserved.add(att);
            elem.setAttribute(att, value);
        }
        observeAttribute(parent, att, cb, staticHtml, persistant = false) {
            const subs = new Set();
            const selector = `[${att}]:not([${att}] [${att}])`;
            const sanitize = (elem) => {
                if (staticHtml) {
                    for (const el of elem.children) {
                        this.sanitizeHTML(el, staticHtml);
                    }
                }
                else {
                    this.sanitizeHTML(elem, staticHtml);
                }
            };
            const observeLoad = (elem, sHtml) => new Promise((resolve) => {
                sanitize(elem);
                const observer = new MutationObserver((muts) => {
                    for (const mut of muts) {
                        for (const target of mut.addedNodes) {
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
                observer.observe(elem, { childList: true, subtree: true });
                const sub = () => {
                    observer.disconnect();
                    subs.delete(sub);
                };
                subs.add(sub);
            });
            const matches = (elem) => elem.matches(selector);
            let loading = false;
            if (document.readyState === 'loading' || persistant) {
                loading = true;
                const found = new WeakSet();
                const isFound = (elem) => {
                    if (!elem || elem === parent)
                        return false;
                    if (found.has(elem))
                        return true;
                    return isFound(elem.parentElement);
                };
                const observer = new MutationObserver((muts) => {
                    for (const mut of muts) {
                        for (const elem of mut.addedNodes) {
                            if (elem instanceof Element) {
                                if (loading) {
                                    if (!isFound(elem) && matches(elem)) {
                                        found.add(elem);
                                        observeLoad(elem, staticHtml).then((el) => {
                                            cb(el);
                                        });
                                    }
                                    else {
                                        for (const el of elem.querySelectorAll(selector)) {
                                            if (!isFound(el)) {
                                                found.add(el);
                                                observeLoad(el, staticHtml).then((ell) => {
                                                    cb(ell);
                                                });
                                            }
                                        }
                                    }
                                }
                                else if (matches(elem)) {
                                    sanitize(elem);
                                    cb(elem);
                                }
                                else {
                                    for (const el of elem.querySelectorAll(selector)) {
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
                            });
                        }
                    });
                }
                observer.observe(parent, { childList: true, subtree: true });
                const sub = () => {
                    observer.disconnect();
                    subs.delete(sub);
                };
                subs.add(sub);
            }
            if (matches(parent)) {
                sanitize(parent);
                cb(parent);
            }
            else {
                for (const el of parent.querySelectorAll(selector)) {
                    sanitize(el);
                    cb(el);
                }
            }
            return {
                cancel() {
                    for (const sub of subs) {
                        sub();
                    }
                },
            };
        }
    }

    const sanitizer = new HTMLSanitizer();
    const imps = ['./Skope.js'];
    const init = import(imps.pop()).then((mod) => {
        const ISkope = mod.default;
        const skope = new ISkope({ sanitizer });
        return (el) => skope.init(el, undefined, true);
    });
    const subs = [];
    let canceled = false;
    let sub = sanitizer.observeAttribute(document.documentElement, 'skope', (el) => {
        init.then((skope) => {
            if (!canceled) {
                sub = skope(el);
                subs.push(sub.cancel);
            }
        });
    }, false);
    subs.push(sub.cancel);
    sub = sanitizer.observeAttribute(document.documentElement, 's-static', () => { }, true, true);
    subs.push(sub.cancel);
    globalThis.cancelSkope = function cancel() {
        canceled = true;
        for (const cb of subs) {
            cb();
        }
        subs.length = 0;
    };

}());
//# sourceMappingURL=defaultInit.js.map
