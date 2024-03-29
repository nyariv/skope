import type { ISkope, IElementScope, IRootScope } from '../../Skope';
import { Subs } from '../../utils';

export function getRootScope(skope: ISkope, scopes: IElementScope[]): IRootScope | undefined {
  for (let i = scopes.length - 1; i >= 0; i--) {
    if (scopes[i] instanceof skope.RootScope) {
      return scopes[i] as IRootScope;
    }
  }
  return undefined;
}

export function getRootElement(skope: ISkope, scopes: IElementScope[]): Element {
  return getRootScope(skope, scopes)?.$el.get(0);
}

export function getScope(skope: ISkope, element: Element, subs: Subs, vars: { [variable: string]: any } = {}, root?: boolean): IElementScope | IRootScope {
  let scope = skope.getStore<IElementScope>(element, 'scope');
  if (root) {
    scope = skope.getStore<IElementScope>(element, 'rootScope');
  }
  if (!scope) {
    skope.getStore<Subs>(element, 'currentSubs', subs);
    if (root) {
      scope = skope.getStore<IElementScope>(element, 'rootScope', new skope.RootScope(element));
      skope.getStore<IElementScope>(element, 'scope', scope);
    } else {
      scope = skope.getStore<IElementScope>(element, 'scope', new skope.ElementScope(element));
    }
    subs.push(() => {
      scope.$el = null;
      skope.deleteStore(element, 'currentSubs');
      skope.deleteStore(element, 'scope');
      skope.deleteStore(element, 'rootScope');
    });
  }
  Object.assign(scope, vars);
  return scope;
}

export function getScopes(skope: ISkope, element: Element, subs: Subs = [], newScope?: { [variable: string]: any }): IElementScope[] {
  if (!element) return [];
  const scope = newScope === undefined ? skope.getStore<IElementScope>(element, 'scope') : getScope(skope, element, subs, newScope);
  const scopes: IElementScope[] = skope.getStore<IElementScope[]>(element, 'scopes') || [];
  if (scopes.length) {
    return [...scopes, scope];
  }
  if (scope) scopes.push(scope);
  return [...(element.hasAttribute('s-detached') ? [] : getScopes(skope, element.parentElement)), ...scopes];
}

export function pushScope(skope: ISkope, scopes: IElementScope[], elem: Element, sub: Subs, vars?: any) {
  const scope = getScope(skope, elem, sub, vars);
  if (scope === scopes[scopes.length - 1]) return [...scopes];
  return [...scopes, scope];
}
