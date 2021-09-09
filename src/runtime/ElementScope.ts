import Skope, { IElementCollection, IElementScope } from '../Skope';
import { unsubNested } from '../utils';
import { IElementCollection as IElemCollection, WrapType } from '../eQuery';

export default function createElementScopeClass(skope: Skope,
  wrap: (selector: WrapType, context: IElemCollection | Document) => IElemCollection,
  getStore: <T>(elem: Node, store: string, defaultValue?: T) => T) {
  const ElementScope = class implements IElementScope {
    $el: IElementCollection;

    constructor(element: Element) {
      this.$el = wrap(element, element.ownerDocument) as IElementCollection;
    }

    $dispatch(eventType: string, detail?: any, bubbles = true, cancelable = true) {
      this.$el.trigger(eventType, detail, bubbles, cancelable);
    }

    $watch(cb: () => unknown, callback: (val: any, lastVal: any) => void): { unsubscribe: () => void } {
      const subUnsubs = skope.watch(this.$el.get(0), cb, callback);
      const sub = getStore(this.$el.get(0), 'currentSubs', []);
      sub.push(subUnsubs);
      return { unsubscribe: () => unsubNested(subUnsubs) };
    }

    $delay(ms: number) {
      return new Promise<void>((res) => setTimeout(res, ms));
    }
  };

  return ElementScope;
}
