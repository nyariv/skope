import Sandbox, { IGlobals } from '@nyariv/sandboxjs';
import { ElementCollection as EC, wrapType } from './eQuery';
export declare const allowedGlobals: IGlobals;
export declare const allowedPrototypes: Map<any, Set<string>>;
export declare const sandbox: Sandbox;
export declare function wrap(selector: wrapType, context?: ElementCollection | EC): ElementCollection;
export declare class ElementCollection extends EC {
    html(content: wrapType): this;
    detach(): DocumentFragment;
}
declare class ElementScope {
    $el: ElementCollection;
    constructor(element: Element);
    $dispatch(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): void;
}
declare class RootScope extends ElementScope {
    $refs: {};
    $wrap(element: wrapType): ElementCollection;
}
export declare class Component extends RootScope {
}
export declare function defineComponent(name: string, comp: Component): void;
export default function init(elems?: wrapType, component?: string): void;
export declare function getScopes(element: Element, newScope?: {
    [variable: string]: any;
}, subs?: subs): ElementScope[];
export declare function watch(code: string, cb: (val: any, lastVal?: any) => void, scopes: ElementScope[], ...lastVal: any[]): subs;
export declare function run(code: string, ...scopes: ElementScope[]): any;
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
