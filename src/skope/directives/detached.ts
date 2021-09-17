import { DelegateObject } from '../../eQuery';
import { getScope } from '../runtime/scope';
import type { ISkope, IElementScope, IRootScope } from '../../Skope';
import { Subs } from '../../utils';

export default function detachedDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject, flags: { elementScopeAdded: boolean }) {
  ready((scopes) => {
    const nestedScopes: [IRootScope, IElementScope?] = [getScope(skope, element, currentSubs, {}, true) as IRootScope];
    if (flags.elementScopeAdded) {
      nestedScopes[0].$templates = { ...(scopes[scopes.length - 1] as any).$templates || {} };
      delete (scopes[scopes.length - 1] as any).$templates;
      nestedScopes.push(scopes[scopes.length - 1]);
    }
    return nestedScopes;
  });
}
