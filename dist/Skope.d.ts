import Sandbox, { IExecContext } from '@nyariv/sandboxjs';
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
    $delay(ms: number): Promise<void>;
}
interface IRootScope extends IElementScope {
    $refs: {
        [name: string]: IElementCollection;
    };
    $wrap(element: wrapType): IElementCollection;
}
export interface DirectiveExec {
    element: Element;
    att: Node;
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
        [code: string]: (...scopes: (any)[]) => {
            context: IExecContext;
            run: () => unknown;
        } | {
            context: IExecContext;
            run: () => Promise<unknown>;
        };
    }>;
    ElementCollection: new (item?: number | Element, ...items: Element[]) => IElementCollection;
    wrap: (selector: wrapType, context: IElementCollection | Document) => IElementCollection;
    defaultDelegateObject: DelegateObject;
    getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
    deleteStore: (elem: Element, store: string) => boolean;
    RootScope: new (el: Element) => IRootScope;
    ElementScope: new (el: Element) => IElementScope;
    constructor(options?: {
        sanitizer?: HTMLSanitizer;
        executionQuote?: bigint;
        allowRegExp?: boolean;
    });
    defineComponent(name: string, comp: Component): void;
    wrapElem(el: Element): IElementCollection;
    watch<T>(elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): subs;
    exec(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => unknown;
    };
    execAsync(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => Promise<unknown>;
    };
    defineDirective(name: string, callback: (exce: DirectiveExec, scopes: IElementScope[]) => subs): void;
    init(elem?: Element, component?: string, alreadyPreprocessed?: boolean): {
        cancel: () => void;
    };
}
export {};
