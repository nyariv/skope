import { DelegateObject } from '../eQuery';
import { getRootElement, pushScope } from '../runtime/scope';
import Skope, { IElementScope } from '../Skope';
import {
  createError, createErrorCb, regVarName, Subs,
} from '../utils';

export default function variableDirective(skope: Skope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject, flags: { elementScopeAdded: boolean }) {
  const name = att.nodeName.substring(1).replace(/-([\w$])/g, (match, letter) => letter.toUpperCase());
  if (!name.match(regVarName)) {
    createError('Invalid variable name in attribute', att);
    return ready;
  }
  if (!flags.elementScopeAdded) {
    flags.elementScopeAdded = true;
    const execSteps: ((scopes: IElementScope[]) => void)[] = [];
    ready((s: IElementScope[]) => {
      const scopes = pushScope(skope, s, element, currentSubs);
      for (const cb of execSteps) {
        cb(scopes);
      }
    });
    ready = (cb: (scopes: IElementScope[]) => void) => execSteps.push(cb);
  }
  ready((scopes) => {
    skope.execAsync(getRootElement(skope, scopes), `let ${name} = ${att.nodeValue}`, scopes).run().catch(createErrorCb(att));
  });
  return ready;
}
