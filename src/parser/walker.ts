import { DelegateObject } from '../eQuery';
import { watchRun } from '../runtime/watch';
import Skope, { DirectiveExec, IElementScope } from '../Skope';
import { createError, Subs } from '../utils';
import { getRootElement, pushScope } from '../runtime/scope';
import eventDirective from '../directives/event';
import ifDirective from '../directives/if';
import forDirective from '../directives/for';
import variableDirective from '../directives/variable';
import detachedDirective from '../directives/detached';
import attributeDirective from '../directives/attribute';

export function walkerInstance() {
  const execSteps: ((scopes: IElementScope[]) => void)[] = [];
  return {
    ready: (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb),
    run: function runNested(scopes: IElementScope[]) {
      execSteps.forEach((cb) => cb(scopes));
      execSteps.length = 0;
    },
  };
}

function runDirective(skope: Skope, exec: DirectiveExec, scopes: IElementScope[]) {
  const dir = skope.directives[exec.directive];
  if (dir) {
    return dir(exec, scopes);
  }
  return [];
}

const closings: any = {
  '(': ')',
  '{': '}',
  '[': ']',
};

const quotes = ["'", '"', '`'];

export function walkText(s: string, endJs: string = null) {
  const strings = [];
  let quote = null;
  let closing = null;
  let escape = false;
  let inJs = !!endJs;
  let start = 0;
  let i = 0;
  for (; i < s.length; i++) {
    const char = s[i];
    const next = s[i + 1];
    if (inJs) {
      if (quote) {
        if (!escape && quote === char) {
          quote = null;
        } else if (char === '\\') {
          escape = !escape;
        } else if (!escape && quote === '`' && char === '$' && next === '{') {
          const strs = walkText(s.substring(i + 2), '}');
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
      } else if (char === '}' && next === '}') {
        strings.push(s.substring(start, i + 2));
        inJs = false;
        i += 1;
        start = i + 1;
      }
    } else if (char === '{' && next === '{') {
      inJs = true;
      if (start !== i) {
        strings.push(s.substring(start, i));
      }
      start = i;
      i += 1;
    }
  }
  if (start !== i && start < s.length) {
    strings.push(s.substring(start, i));
  }
  return strings.filter(Boolean);
}

export function walkTree(skope: Skope, element: Node, parentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject, skipFirst: boolean) {
  const currentSubs: Subs = [];
  parentSubs.push(currentSubs);
  const walkNested = () => {
    const execSteps: ((scopes: IElementScope[]) => void)[] = [];
    const r = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
    for (const el of [...element.childNodes]) {
      if (el instanceof Element) {
        walkTree(skope, el, currentSubs, r, delegate, false);
      } else if (el.nodeType === 3) {
        const strings = walkText(el.textContent);
        const nodes: Text[] = [];
        let found = false;
        for (const s of strings) {
          if (s.startsWith('{{') && s.endsWith('}}')) {
            skope.getStore<Subs>(el, 'currentSubs', currentSubs);
            found = true;
            const placeholder = document.createTextNode('');
            ready((scopes) => {
              currentSubs.push(skope.watch(element, watchRun(skope, el, scopes, s.slice(2, -2)), (val, lastVal) => {
                placeholder.textContent = `${val}`;
              }, (err: Error) => {
                placeholder.textContent = '';
              }));
              return scopes;
            });
            nodes.push(placeholder);
          } else {
            nodes.push(document.createTextNode(s));
          }
        }

        if (found) {
          nodes.forEach((n) => {
            el.before(n);
          });
          el.remove();
        }
      }
    }
    ready((scopes) => {
      for (const cb of execSteps) cb(scopes);
    });
  };
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
        if (!parent) return;
        if (!skope.sanitizer.isAttributeForced(parent, 'skope-style')) {
          parent.removeAttribute('skope-style');
        }
        const id = parent.getAttribute('skope-style') || ++skope.styleIds;
        skope.sanitizer.setAttributeForced(parent, 'skope-style', `${id}`);
        let i = element.sheet.cssRules.length - 1;
        for (const rule of [...element.sheet.cssRules].reverse()) {
          if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
            element.sheet.deleteRule(i);
          }
          i--;
        }
        i = 0;
        for (const rule of [...element.sheet.cssRules]) {
          if (rule instanceof CSSStyleRule) {
            const { cssText } = rule.style;
            element.sheet.deleteRule(i);
            element.sheet.insertRule(`[skope-style="${id}"] :is(${rule.selectorText}) { ${cssText} }`, i);
          }
          i++;
        }
      };
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
      ifDirective(skope, element, element.getAttributeNode('s-if'), currentSubs, ready, delegate);
      return;
    }
    if (element.hasAttribute('s-for')) {
      forDirective(skope, element, element.getAttributeNode('s-for'), currentSubs, ready);
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
            delegate,
          }, scopes));
        } catch (err) {
          createError(err.message, element);
        }
      });
      return;
    }
    const flags = { elementScopeAdded: false };
    for (const att of element.attributes) {
      if (att.nodeName.startsWith('$')) {
        ready = variableDirective(skope, element, att, currentSubs, ready, delegate, flags);
      }
    }
    if (element.hasAttribute('s-detached')) {
      ready = detachedDirective(skope, element, element.getAttributeNode('s-detached'), currentSubs, ready, delegate, flags);
    }
    if (element instanceof HTMLIFrameElement && element.hasAttribute('skope-iframe-content')) {
      ready(() => {
        const exec = () => {
          skope.wrapElem(element).html(element.getAttribute('skope-iframe-content'));
          element.removeAttribute('skope-iframe-content');
        };
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
    }
    for (const att of element.attributes) {
      if (att.nodeName.startsWith(':')) {
        attributeDirective(skope, element, att, currentSubs, ready, delegate);
      } else if (att.nodeName.startsWith('@')) {
        eventDirective(skope, element, att, currentSubs, ready, delegate);
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
              delegate,
            }, pushScope(skope, scopes, element, currentSubs)));
          });
        } catch (err) {
          createError(err.message, att);
        }
      }
    }
  }
  if (!(element instanceof Element && element.hasAttribute('s-static'))) {
    walkNested();
  }
}
