import type { ISkope, IElementScope, IRootScope } from '../../Skope';
import { Subs } from '../../utils';
export declare function getRootScope(skope: ISkope, scopes: IElementScope[]): IRootScope | undefined;
export declare function getRootElement(skope: ISkope, scopes: IElementScope[]): Element;
export declare function getScope(skope: ISkope, element: Element, subs: Subs, vars?: {
    [variable: string]: any;
}, root?: boolean): IElementScope | IRootScope;
export declare function getScopes(skope: ISkope, element: Element, subs?: Subs, newScope?: {
    [variable: string]: any;
}): IElementScope[];
export declare function pushScope(skope: ISkope, scopes: IElementScope[], elem: Element, sub: Subs, vars?: any): IElementScope[];
