import Sandbox from '@nyariv/sandboxjs';
import { wrapType, DelegateObject } from './eQuery';
import { IElementCollection } from './eQuery';
import HTMLSanitizer from './HTMLSanitizer';
export declare class Component {
}
interface IElementScope {
    $el: IElementCollection;
    $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
    $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {
        unsubscribe: () => void;
    };
}
interface IRootScope extends IElementScope {
    $refs: {
        [name: string]: IElementCollection;
    };
    $wrap(element: wrapType): IElementCollection;
}
export interface DirectiveExec {
    element: Element;
    directive: string;
    js: string;
    original: string;
    subs: subs;
    delegate: DelegateObject;
}
export declare type sub = (() => void) | sub[];
export declare type subs = sub[];
export default class Skope {
    components: any;
    sanitizer: HTMLSanitizer;
    directives: {
        [name: string]: (exce: DirectiveExec, scopes: IElementScope[]) => subs;
    };
    globals: import("@nyariv/sandboxjs/dist/node/executor").IGlobals;
    prototypeWhitelist: Map<any, Set<string>>;
    sandbox: Sandbox;
    sandboxCache: WeakMap<Node, {
        [code: string]: (...scopes: any[]) => any;
    }>;
    ElementCollection: new (item?: number | Element, ...items: Element[]) => IElementCollection;
    wrap: (selector: wrapType, context?: IElementCollection) => IElementCollection;
    defaultDelegateObject: DelegateObject;
    getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
    deleteStore: (elem: Element, store: string) => boolean;
    RootScope: new (el: Element) => IRootScope;
    ElementScope: new (el: Element) => IElementScope;
    constructor(options?: {
        sanitizer?: HTMLSanitizer;
    });
    defineComponent(name: string, comp: Component): void;
    watch(toWatch: () => any, handler: (val: unknown, lastVal: unknown) => void | Promise<void>): subs;
    run(el: Node, code: string, scopes: IElementScope[]): any;
    defineDirective(name: string, callback: (exce: DirectiveExec, scopes: IElementScope[]) => subs): void;
    init(elem?: Element, component?: string, alreadyPreprocessed?: boolean): {
        cancel: () => void;
    };
}
export {};
