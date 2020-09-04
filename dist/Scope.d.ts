import Sandbox from '@nyariv/sandboxjs';
import { ElementCollection, wrapType, DelegateObject } from './eQuery';
export declare const allowedGlobals: import("@nyariv/sandboxjs/dist/executor").IGlobals;
export declare const allowedPrototypes: Map<any, Set<string>>;
export declare const sandbox: Sandbox;
declare module './eQuery' {
    interface ElementCollection {
        html(content?: string | Node | ElementCollection): this;
        text(set?: string): string | this;
        detach(): DocumentFragment;
    }
}
declare class ElementScope {
    $el: ElementCollection;
    constructor(element: Element);
    $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
    $watch(cb: () => any, callback: (val: any, lastVal: any) => void): {
        unsubscribe: () => void;
    };
}
export declare class Component {
}
export declare function defineComponent(name: string, comp: Component): void;
export default function init(elems?: wrapType, component?: string): void;
export declare function getScopes(element: Element, subs?: subs, newScope?: {
    [variable: string]: any;
}): ElementScope[];
export declare function watch(toWatch: () => any, handler: (val: unknown, lastVal: unknown) => void | Promise<void>): subs;
export declare function run(el: Node, code: string, scopes: ElementScope[]): any;
export interface DirectiveExec {
    element: Element;
    directive: string;
    js: string;
    original: string;
    subs: subs;
    delegate: DelegateObject;
}
export declare function defineDirective(name: string, callback: (exce: DirectiveExec, scopes: ElementScope[]) => subs): void;
export declare function unsubNested(subs: sub): void;
export declare type sub = (() => void) | sub[];
export declare type subs = sub[];
export {};
