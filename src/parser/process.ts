import { DelegateObject, EqEvent } from "../eQuery";
import { walkerInstance } from "./walker";
import { watchRun } from "../runtime/watch";
import Skope, { DirectiveExec, IElementScope, IRootScope } from "../Skope";
import { createError, createErrorCb, isIterable, isObject, regKeyValName, regVarName, subs, unsubNested } from "../utils";
import { getRootElement, getScope, pushScope } from "./scope";


export function preprocessHTML(skope: Skope, parent: Element, html: DocumentFragment|Element|string): DocumentFragment|Element {
  let elem: DocumentFragment|Element;
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
    for (let el of elem.querySelectorAll('[s-static]:not([s-static] [s-static])')) {
      for (let child of el.children) {
        skope.sanitizer.sanitizeHTML(child, true);
      }
    }
    skope.sanitizer.sanitizeHTML(elem);
  }
  return elem;
}

export function processHTML(skope: Skope, elem: Node, subs: subs, delegate: DelegateObject, skipFirst = false) {
  const exec = walkerInstance();
  walkTree(skope, elem, subs, exec.ready, delegate, skipFirst);
  return {
    elem: elem,
    run: exec.run
  }
}


const closings: any = {
  "(": ")",
  "{": "}",
  "[": "]"
}

const quotes = ["'", '"', "`"];

function walkText(s: string, endJs: string = null) {
  let strings = [];
  let quote = null;
  let closing = null;
  let escape = false;
  let inJs = !!endJs;
  let start = 0;
  let i = 0;
  for (; i < s.length; i++) {
    const char = s[i];
    const next = s[i+1];
    if (inJs) {
      if (quote) {
        if (!escape && quote === char) {
          quote = null;
        } else if (char === '\\') {
          escape = !escape;
        } else if (!escape && quote === '`' && char === "$" && next === "{") {
          const strs = walkText(s.substring(i + 2), "}");
          i += strs[0].length + 2;
        }
      } else if (quotes.includes(char)) {
        quote = char;
      } else if (closing) {
        if (closings[closing] === char) {
          closing = null;
        }
      } else if (closings[char]) {
        closing = char;
      } else if (char === endJs) {
        strings.push(s.substring(start, i));
        return strings;
      } else if (char === "}" && next === "}") {
        strings.push(s.substring(start, i + 2));
        inJs = false;
        i += 1;
        start = i + 1;
      }
    } else {
      if (char === "{" && next === "{") {
        inJs = true;
        if (start !== i) {
          strings.push(s.substring(start, i));
        }
        start = i;
        i += 1;
      }
    }
  }
  if (start !== i && start < s.length) {
    strings.push(s.substring(start, i));
  }
  return strings.filter(Boolean);
}

function runDirective(skope: Skope, exec: DirectiveExec, scopes: IElementScope[]) {
  const dir = skope.directives[exec.directive];
  if (dir) {
    return dir(exec, scopes);
  }
  return [];
}

export function walkTree(skope: Skope, element: Node, parentSubs: subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject, skipFirst: boolean) {
  let currentSubs: subs = [];
  parentSubs.push(currentSubs);
  const walkNested = () => {
    const execSteps: ((scopes: IElementScope[]) => void)[] = [];
    const r = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    for (let el of [...element.childNodes]) {
      if (el instanceof Element) {
        walkTree(skope, el, currentSubs, r, delegate, false);
      } else if (el.nodeType === 3) {
        const strings = walkText(el.textContent);
        const nodes: Text[] = [];
        let found = false;
        strings.forEach((s) => {
          if (s.startsWith("{{") && s.endsWith("}}")) {
            skope.getStore<subs>(el, 'currentSubs', currentSubs);
            found = true;
            const placeholder = document.createTextNode("");
            ready((scopes) => {
              currentSubs.push(skope.watch(element, watchRun(skope, el, scopes, s.slice(2, -2)), (val, lastVal) => {
                placeholder.textContent = val + "";
              }, (err: Error) => {() => {
                placeholder.textContent = "";
              }
              }));
              return scopes;
            });
            nodes.push(placeholder);
          } else {
            nodes.push(document.createTextNode(s));
          }
        });
  
        if (found) {
          nodes.forEach((n) => {
            el.before(n);
          });
          el.remove();
        }
      }
    }
    ready((scopes) => {
      for (let cb of execSteps) cb(scopes);
    });
  }
  if (skipFirst) {
    walkNested();
    return;
  }
  if (element instanceof Element) {
    if (element instanceof HTMLTemplateElement) {
      return;
    }
    if (element instanceof HTMLStyleElement) {
      const loaded = () => {
        const parent = element.parentElement;
        if (!parent) return false;
        if (!skope.sanitizer.isAttributeForced(parent, 'skope-style')) {
          parent.removeAttribute('skope-style');
        }
        const id = parent.getAttribute('skope-style') || ++skope.styleIds;
        skope.sanitizer.setAttributeForced(parent, 'skope-style', id + "");
        let i = element.sheet.cssRules.length - 1;
        for (let rule of [...element.sheet.cssRules].reverse()) {
          if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
            element.sheet.deleteRule(i);
          }
          i--;
        }
        i = 0;
        for (let rule of [...element.sheet.cssRules]) {
          if (rule instanceof CSSStyleRule) {
            var cssText = rule.style.cssText;
            element.sheet.deleteRule(i);
            element.sheet.insertRule(`[skope-style="${id}"] :is(${rule.selectorText}) { ${cssText} }`, i);
          }
          i++;
        }
      }
      if (element.sheet && element.parentElement) {
        loaded();
      } else {
        element.addEventListener('load', loaded);
      }
      return;
    }
    skope.getStore(element, 'currentSubs', parentSubs);
    element.removeAttribute('s-cloak');
    if (element.hasAttribute('s-if')) {
      const comment = document.createComment('s-if');
      let ifElem: Element;
      const at = element.getAttribute('s-if');
      element.before(comment);
      element.remove();
      skope.deleteStore(element, 'currentSubs');
      ready((scopes) => {
        skope.getStore<subs>(comment, 'currentSubs', currentSubs);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs)
        currentSubs.push(skope.watch(element.getAttributeNode('s-if'), watchRun(skope, element.getAttributeNode('s-if'), scopes, at), (val, lastVal) => {
          if (val) {
            if (!ifElem) {
              ifElem = element.cloneNode(true) as Element;
              ifElem.removeAttribute('s-if');
              const processed = processHTML(skope, ifElem, nestedSubs, delegate);
              comment.after(processed.elem);
              processed.run(pushScope(skope, scopes, ifElem, nestedSubs));
            }
          } else {
            if (ifElem) {
              ifElem.remove();
              ifElem = undefined;
              unsubNested(nestedSubs);
            }
          }
        }, (err: Error) => {
          if (ifElem) {
            ifElem.remove();
            ifElem = undefined;
            unsubNested(nestedSubs);
          }
        }));
      });
      return;
    }
    if (element.hasAttribute('s-for')) {
      const comment = document.createComment('s-for');
      element.after(comment);
      element.remove();
      skope.deleteStore(element, 'currentSubs');
      const items = new Set<Element>();
      let exp: string;
      const at = element.getAttribute('s-for');
      let split = at.split(' in ');
      if (split.length < 2) {
        throw createError('In valid s-for directive: ' + at, element.getAttributeNode('s-for'));
      } else {
        exp = split.slice(1).join(' in ');
      }
      const varsExp = split[0];
      const varMatch = varsExp.match(regVarName);
      let key: string;
      let value: string;
      if (varMatch) {
        value = varMatch[1];
      } else {
        const doubleMatch = varsExp.match(regKeyValName)
        if (!doubleMatch) throw createError('In valid s-for directive: ' + at, element.getAttributeNode('s-for'));
        key = doubleMatch[1];
        value = doubleMatch[2];
      }
      ready((scopes) => {
        const del = skope.wrapElem(comment.parentElement).delegate();
        currentSubs.push(del.off);
        const nestedSubs: subs = [];
        currentSubs.push(nestedSubs);
        currentSubs.push(skope.watch(element.getAttributeNode('s-for'), watchRun(skope, element.getAttributeNode('s-for'), scopes, exp), (val) => {
          unsubNested(nestedSubs);
          items.forEach((item) => {
            item.remove(); // @TODO: optimize
          });
          items.clear();
          const runs: (() => void)[] = [];
          const repeat = (item: unknown, i: number|string) => {
            const forSubs: subs = [];
            nestedSubs.push(forSubs);
            const scope: any = {$index: i};
            if (key) scope[key] = i;
            if (value) scope[value] = item;
            const elem = element.cloneNode(true) as Element;
            elem.removeAttribute('s-for');
            const processed = processHTML(skope, elem, forSubs, del);
            comment.before(processed.elem);
            items.add(elem);
            runs.push(() => processed.run(pushScope(skope, scopes, elem, forSubs, scope)));
          }
          let i = -1;
          if (isIterable(val)) {
            for (let item of val) {
              i++;
              repeat(item, i);
            }
          } else if (isObject(val)) {
            for (let i in val) {
              repeat(val[i], i);
            }
          }
          runs.forEach((run) => run());
        }, () => {
          unsubNested(nestedSubs);
          items.forEach((item) => {
            item.remove(); // @TODO: optimize
          });
          items.clear();
        }));
      });
      return;
    }
    if (element.hasAttribute('s-component')) {
      ready((scopes) => {
        try {
          currentSubs.push(runDirective(skope, {
            element,
            att: element.getAttributeNode('s-component'),
            directive: 'component',
            js: '',
            original: element.outerHTML,
            subs: currentSubs,
            delegate
          }, scopes));
        } catch (err) {
          createError(err.message,  element);
        }
      });
      return;
    }
    let elementScopeAdded = false;
    for (let att of element.attributes) {
      if (att.nodeName.startsWith("$")) {
        const name = att.nodeName.substring(1).replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());
        if (!name.match(regVarName)) {
          createError(`Invalid variable name in attribute`, att);
          continue;
        };
        if (!elementScopeAdded) {
          elementScopeAdded = true;
          const execSteps: ((scopes: IElementScope[]) => void)[] = [];
          ready((s: IElementScope[]) => {
            let scopes = pushScope(skope, s, element, currentSubs);
            for (let cb of execSteps) {
              cb(scopes);
            }
          });
          ready = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
        }
        ready(scopes => {
          skope.execAsync(getRootElement(skope, scopes), `let ${name} = ${att.nodeValue}`, scopes).run().catch(createErrorCb(att));
        });
      }
    }
    if (element.hasAttribute('s-detached')) {
      let nestedScopes: [IRootScope, IElementScope?];
      const execSteps: ((scopes: IElementScope[]) => void)[] = [];
      ready((scopes) => {
        nestedScopes = [getScope(skope, element, currentSubs, {}, true) as IRootScope];
        if (elementScopeAdded) {
          nestedScopes[0].$templates = {...(scopes[scopes.length - 1] as any).$templates || {}};
          delete (scopes[scopes.length - 1] as any).$templates;
          nestedScopes.push(scopes[scopes.length - 1]);
        }
        for (let cb of execSteps) {
          cb(nestedScopes);
        }
      });
      ready = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    }
    if (element instanceof HTMLIFrameElement && element.hasAttribute('skope-iframe-content')) {
      ready(() => {
        const exec = () => {
          skope.wrapElem(element).html(element.getAttribute('skope-iframe-content'));
          element.removeAttribute('skope-iframe-content');
        }
        if (element.contentDocument.readyState !== 'complete') {
          element.addEventListener('load', exec);
        } else {
          exec();
        }
      });
    }
    if (element instanceof HTMLScriptElement) {
      if (element.type === 'skopejs') {
        ready((scopes) => {
          try {
            skope.exec(getRootElement(skope, scopes), element.innerHTML, scopes).run();
          } catch (err) {
            createError(err?.message, element);
          }
        });
      } else {
        element.remove();
      }
      return;
    } else {
      for (let att of element.attributes) {
        if (att.nodeName.startsWith(':')) {
          const at = att.nodeName.slice(1);
          const parts = at.split('.');
          ready((scopes) => {
            const $element = skope.wrapElem(element);
            currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, att.nodeValue), (val: any, lastVal) => {
              if (typeof val === 'object' && ['style', 'class'].includes(at)) {
                Object.entries(val).forEach((a) => Promise.resolve(a[1]).then((v) => {
                  if (at === 'class') {
                      $element.toggleClass(a[0], !!v);
                  } else {
                    if (element instanceof HTMLElement || element instanceof SVGElement) {
                      (<any>element.style)[a[0]] = v;
                    }
                  }
                }, () => {
                  if (at === 'class') {
                    $element.toggleClass(a[0], false);
                  }
                }));
              } else {
                if (parts.length === 2 && ['style', 'class'].includes(parts[0])) {
                  if (parts[0] === 'class') {
                      $element.toggleClass(parts[1], !!val);
                  } else {
                    if (element instanceof HTMLElement || element instanceof SVGElement) {
                      (<any>element.style)[parts[1]] = val;
                    }
                  }
                } else {
                  $element.attr(at, val + "");
                }
              }
            }, () => {}));
          });
        } else if (att.nodeName.startsWith('@')) {
          const transitionParts = att.nodeName.split('$');
          const parts = transitionParts[0].slice(1).split('.');
          const debouce = /^debounce(\((\d+)\))?$/.exec(parts[1] || "");
          const throttle = /^throttle(\((\d+)\))?$/.exec(parts[1] || "");
          const queue = /^queue(\((\d+)\))?$/.exec(parts[1] || "");
          if (parts[1] && !(debouce || throttle || queue || parts[1] === 'once')) {
            createError('Invalid event directive: ' + parts[1], att);
            continue;
          }
          const transitionVar = transitionParts[1]?.replace(/\-([\w\$])/g, (match, letter) => letter.toUpperCase());;
          if (transitionVar) {
            if (!regVarName.test(transitionVar)) {
              createError(`Invalid variable name in attribute`, att);
              continue;
            }
          }
          ready((scopes) => {
            if (transitionVar) {
              skope.exec(getRootElement(skope, scopes), `if (typeof ${transitionVar} === 'undefined') var ${transitionVar}`, scopes).run();
            }
            let trans: Promise<unknown>;
            const evCb = (e: EqEvent) => {
              trans = skope.execAsync(getRootElement(skope, scopes), att.nodeValue, pushScope(skope, scopes, element, currentSubs, {$event: e})).run();
              trans.catch(() => {});
              if (transitionVar) {
                skope.exec(getRootElement(skope, scopes), `${transitionVar} = trans`, pushScope(skope, scopes, element, currentSubs, {trans})).run();
              }
            }
            let ev = evCb;
            if (debouce) {
              let timer: any = null;
              ev = (e: EqEvent) => {
                clearTimeout(timer);
                timer = setTimeout(() => {
                  timer = null;
                  evCb(e);
                }, Number(debouce[2] || 250));
              }
            }
            if (throttle) {
              if (throttle[2] === undefined) {
                let ready = false;
                ev = (e: EqEvent) => {
                  if (ready || !trans) {
                    ready = false;
                    evCb(e);
                    trans.then(() => ready = true, () => ready = true);
                  }
                }
              } else {
                let eobj: EqEvent;
                let timer: any = null;
                ev = (e: EqEvent) => {
                  eobj = e;
                  if (timer !== null) return
                  timer = setTimeout(() => {
                    timer = null;
                    evCb(eobj);
                  }, Number(throttle[2]));
                }
              }
            }

            if (queue) {
              let count = 0;
              let q: Promise<any> = Promise.resolve();
              ev = (e: EqEvent) => {
                if (!queue[2]  || Number(queue[2]) > count) {
                  count++;
                  q = q.then(() => {
                    evCb(e);
                    return trans;
                  }).catch(() => {}).then(() => count--);
                }
              }
            }
            if (parts[1] === 'once') {
              currentSubs.push(delegate.one(element, parts[0], ev));
            } else {
              currentSubs.push(delegate.on(element, parts[0], ev));
            }
          });
        } else if (att.nodeName.startsWith('s-')) {
          try {
            ready((scopes) => {
              currentSubs.push(runDirective(skope, {
                element,
                att,
                directive: att.nodeName.slice(2),
                js: att.nodeValue,
                original: element.outerHTML,
                subs: currentSubs,
                delegate
              }, pushScope(skope, scopes, element, currentSubs)));
            });
          } catch (err) {
            createError(err.message, att);
          }
        }
      }
    }
  }
  if (element instanceof Element && element.hasAttribute('s-static')) {
  } else {
    walkNested();
  }
}