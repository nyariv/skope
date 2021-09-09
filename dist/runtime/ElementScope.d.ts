import Skope, { IElementCollection } from '../Skope';
import { IElementCollection as IElemCollection, WrapType } from '../eQuery';
export default function createElementScopeClass(skope: Skope, wrap: (selector: WrapType, context: IElemCollection | Document) => IElemCollection, getStore: <T>(elem: Node, store: string, defaultValue?: T) => T): {
    new (element: Element): {
        $el: IElementCollection;
        $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
        $watch(cb: () => unknown, callback: (val: any, lastVal: any) => void): {
            unsubscribe: () => void;
        };
        $delay(ms: number): Promise<void>;
    };
};
