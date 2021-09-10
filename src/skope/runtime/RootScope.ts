import type { ISkope, IElementCollection, IElementScope } from '../../Skope';
import { IElementCollection as IElemCollection, WrapType } from '../../eQuery';

export default function createRootScopeClass(skope: ISkope,
  wrap: (selector: WrapType, context: IElemCollection | Document) => IElemCollection,
  ElementScope: new (el: Element) => IElementScope) {
  const RootScope = class extends ElementScope {
    $templates: { [name: string]: HTMLTemplateElement } = {};

    $refs: { [name: string]: IElementCollection } = {};

    $wrap(element: WrapType) {
      return wrap(element, this.$el);
    }
  };

  return RootScope;
}
