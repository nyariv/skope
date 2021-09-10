import type { ISkope, IElementCollection, IElementScope } from '../../Skope';
import { IElementCollection as IElemCollection, WrapType } from '../../eQuery';
export default function createRootScopeClass(skope: ISkope, wrap: (selector: WrapType, context: IElemCollection | Document) => IElemCollection, ElementScope: new (el: Element) => IElementScope): {
    new (el: Element): {
        $templates: {
            [name: string]: HTMLTemplateElement;
        };
        $refs: {
            [name: string]: IElementCollection;
        };
        $wrap(element: WrapType): IElemCollection;
        $el: IElementCollection;
        $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
        $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {
            unsubscribe: () => void;
        };
        $delay(ms: number): Promise<void>;
    };
};
