import Skope, { IElementScope, IRootScope } from '../Skope';
import { Subs } from '../utils';
export declare function getRootScope(skope: Skope, scopes: IElementScope[]): IRootScope | undefined;
export declare function getRootElement(skope: Skope, scopes: IElementScope[]): Element;
export declare function getScope(skope: Skope, element: Element, subs: Subs, vars?: {
    [variable: string]: any;
}, root?: boolean): IElementScope | IRootScope;
export declare function getScopes(skope: Skope, element: Element, subs?: Subs, newScope?: {
    [variable: string]: any;
}): IElementScope[];
export declare function pushScope(skope: Skope, scopes: IElementScope[], elem: Element, sub: Subs, vars?: any): IElementScope[];
