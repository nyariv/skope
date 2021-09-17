import { DelegateObject } from '../../eQuery';
import { getRootElement, pushScope } from '../runtime/scope';
import type { ISkope, IElementScope } from '../../Skope';
import {
  createError, createErrorCb, regVarName, Subs,
} from '../../utils';

export default function variableDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject, flags: { elementScopeAdded: boolean }) {
  const name = att.nodeName.substring(1).replace(/-([\w$])/g, (match, letter) => letter.toUpperCase());
  if (!name.match(regVarName)) {
    createError('Invalid variable name in attribute', att);
    return ready;
  }
  if (!flags.elementScopeAdded) {
    flags.elementScopeAdded = true;
    ready((s: IElementScope[]) => pushScope(skope, s, element, currentSubs));
  }
  ready((scopes) => {
    skope.execAsync(getRootElement(skope, scopes), `let ${name} = ${att.nodeValue}`, scopes).run().catch(createErrorCb(att));
  });
  return ready;
}
