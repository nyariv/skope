import Sandbox from '@nyariv/sandboxjs';
import { ElementCollection as EC, wrapType } from './eQuery';
export declare const allowedGlobals: import("@nyariv/sandboxjs").IGlobals;
export declare const allowedPrototypes: Map<any, Set<string>>;
export declare const sandbox: Sandbox;
export declare function wrap(selector: wrapType, context?: ElementCollection | EC): ElementCollection;
export declare class ElementCollection extends EC {
    html(content?: wrapType): string | this;
    text(set?: string): string | this;
    detach(): DocumentFragment;
}
declare class ElementScope {
    $el: ElementCollection;
    constructor(element: Element);
    $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
}
export declare class Component {
}
export declare function defineComponent(name: string, comp: Component): void;
export default function init(elems?: wrapType, component?: string): void;
export declare function getScopes(element: Element, newScope?: {
    [variable: string]: any;
}, subs?: subs): ElementScope[];
export declare function watch(root: Node, code: string, cb: (val: any, lastVal: any) => void | Promise<void>, scopes: any[], digestObj?: {
    digest: () => void;
    count: number;
    countStart: Date;
    lastVal: any;
    subs: subs;
}): subs;
export declare function run(el: Node, code: string, ...scopes: any[]): any;
export interface DirectiveExec {
    element: Element;
    directive: string;
    js: string;
    original: string;
    subs: subs;
}
export declare function defineDirective(name: string, callback: (exce: DirectiveExec, ...scopes: ElementScope[]) => subs): void;
export declare function unsubNested(subs: sub): void;
export declare type sub = (() => void) | sub[];
export declare type subs = sub[];
export {};
