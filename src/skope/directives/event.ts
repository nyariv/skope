import { DelegateObject, EqEvent } from '../../eQuery';
import { getRootElement, pushScope } from '../runtime/scope';
import type { ISkope, IElementScope } from '../../Skope';
import { createError, regVarName, Subs } from '../../utils';

export default function eventDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject) {
  const transitionParts = att.nodeName.split('$');
  const parts = transitionParts[0].slice(1).split('.');
  const debouce = /^debounce(\((\d+)\))?$/.exec(parts[1] || '');
  const throttle = /^throttle(\((\d+)\))?$/.exec(parts[1] || '');
  const queue = /^queue(\((\d+)\))?$/.exec(parts[1] || '');
  if (parts[1] && !(debouce || throttle || queue || parts[1] === 'once')) {
    createError(`Invalid event directive: ${parts[1]}`, att);
    return;
  }
  const transitionVar = transitionParts[1]?.replace(/-([\w$])/g, (match, letter) => letter.toUpperCase());
  if (transitionVar) {
    if (!regVarName.test(transitionVar)) {
      createError('Invalid variable name in attribute', att);
      return;
    }
  }
  ready((scopes) => {
    if (transitionVar) {
      skope.exec(getRootElement(skope, scopes), `if (typeof ${transitionVar} === 'undefined') var ${transitionVar}`, scopes).run();
    }
    let trans: Promise<unknown>;
    const evCb = (e: EqEvent) => {
      trans = skope.execAsync(getRootElement(skope, scopes), att.nodeValue, pushScope(skope, scopes, element, currentSubs, { $event: e })).run();
      trans.catch(() => {});
      if (transitionVar) {
        skope.exec(getRootElement(skope, scopes), `${transitionVar} = trans`, pushScope(skope, scopes, element, currentSubs, { trans })).run();
      }
    };
    let ev = evCb;
    if (debouce) {
      let timer: any = null;
      ev = (e: EqEvent) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          evCb(e);
        }, Number(debouce[2] || 250));
      };
    }
    if (throttle) {
      if (throttle[2] === undefined) {
        let cont = false;
        ev = (e: EqEvent) => {
          if (cont || !trans) {
            cont = false;
            evCb(e);
            trans.then(() => cont = true, () => cont = true);
          }
        };
      } else {
        let eobj: EqEvent;
        let timer: any = null;
        ev = (e: EqEvent) => {
          eobj = e;
          if (timer !== null) return;
          timer = setTimeout(() => {
            timer = null;
            evCb(eobj);
          }, Number(throttle[2]));
        };
      }
    }

    if (queue) {
      let count = 0;
      let q: Promise<any> = Promise.resolve();
      ev = (e: EqEvent) => {
        if (!queue[2] || Number(queue[2]) > count) {
          count++;
          q = q.then(() => {
            evCb(e);
            return trans;
          }).catch(() => {}).then(() => count--);
        }
      };
    }
    if (parts[1] === 'once') {
      currentSubs.push(delegate.one(element, parts[0], ev));
    } else {
      currentSubs.push(delegate.on(element, parts[0], ev));
    }
  });
}
