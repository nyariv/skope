import Sandbox, { IExecContext } from '@nyariv/sandboxjs';
import { WrapType, DelegateObject, IElementCollection as IElemCollection } from './eQuery';
import { IHTMLSanitizer } from './HTMLSanitizer';
import { IVarSubs, Subs } from './utils';
export interface Component {
}
export interface IElementCollection extends IElemCollection {
    html(): string;
    html(content: string | Element | DocumentFragment | IElementCollection): IElemCollection;
    text(): string;
    text(set: string): IElementCollection;
}
export interface IElementScope {
    $el: IElementCollection;
    $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
    $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {
        unsubscribe: () => void;
    };
    $delay(ms: number): Promise<void>;
}
export interface IRootScope extends IElementScope {
    $templates: {
        [name: string]: HTMLTemplateElement;
    };
    $refs: {
        [name: string]: IElementCollection;
    };
    $wrap(element: WrapType): IElementCollection;
}
export interface IDirectiveExec {
    element: Element;
    att: Node;
    directive: string;
    js: string;
    original: string;
    subs: Subs;
    delegate: DelegateObject;
}
export interface IDirectiveDefinition {
    name: string;
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => Subs;
}
export interface ISkope {
    components: any;
    sanitizer: IHTMLSanitizer;
    directives: {
        [name: string]: (exec: IDirectiveExec, scopes: IElementScope[]) => Subs;
    };
    globals: import('@nyariv/sandboxjs/dist/node/executor').IGlobals;
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
    wrap: (selector: WrapType, context: IElementCollection | Document) => IElementCollection;
    defaultDelegateObject: DelegateObject;
    getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
    deleteStore: (elem: Element, store: string) => boolean;
    RootScope: new (el: Element) => IRootScope;
    ElementScope: new (el: Element) => IElementScope;
    styleIds: number;
    calls: (() => void)[];
    callTimer: any;
    varSubsStore: WeakMap<() => unknown | Promise<unknown>, IVarSubs>;
    call(cb: () => void): void;
    defineComponent(name: string, comp: Component): void;
    wrapElem(el: Element): IElementCollection;
    watch<T>(elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): Subs;
    exec(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => unknown;
    };
    execAsync(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => Promise<unknown>;
    };
    defineDirective(exec: IDirectiveDefinition): void;
    init(elem?: Element, component?: string, alreadyPreprocessed?: boolean): {
        cancel: () => void;
    };
    preprocessHTML(skope: ISkope, parent: Element, html: DocumentFragment | Element | string): DocumentFragment | Element;
    processHTML(skope: ISkope, elem: Node, subs: Subs, delegate: DelegateObject, skipFirst?: boolean): {
        elem: Node;
        run: (scopes: IElementScope[]) => void;
    };
}
export default class Skope implements ISkope {
    components: any;
    sanitizer: IHTMLSanitizer;
    directives: {
        [name: string]: (exec: IDirectiveExec, scopes: IElementScope[]) => Subs;
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
    wrap: (selector: WrapType, context: IElementCollection | Document) => IElementCollection;
    defaultDelegateObject: DelegateObject;
    getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
    deleteStore: (elem: Element, store: string) => boolean;
    RootScope: new (el: Element) => IRootScope;
    ElementScope: new (el: Element) => IElementScope;
    styleIds: number;
    calls: (() => void)[];
    callTimer: any;
    varSubsStore: WeakMap<() => unknown | Promise<unknown>, IVarSubs>;
    constructor(options?: {
        sanitizer?: IHTMLSanitizer;
        executionQuote?: bigint;
        allowRegExp?: boolean;
    });
    call(cb: () => void): void;
    defineComponent(name: string, comp: Component): void;
    wrapElem(el: Element): IElementCollection;
    watch<T>(elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): Subs;
    exec(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => unknown;
    };
    execAsync(el: Node, code: string, scopes: IElementScope[]): {
        context: IExecContext;
        run: () => Promise<unknown>;
    };
    defineDirective(exec: IDirectiveDefinition): void;
    init(elem?: Element, component?: string, alreadyPreprocessed?: boolean): {
        cancel: () => void;
    };
    preprocessHTML(skope: ISkope, parent: Element, html: DocumentFragment | Element | string): DocumentFragment | Element;
    processHTML(skope: ISkope, elem: Node, subs: Subs, delegate: DelegateObject, skipFirst?: boolean): {
        elem: Node;
        run: (scopes: IElementScope[]) => void;
    };
}
