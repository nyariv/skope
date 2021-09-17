import { DelegateObject } from '../../eQuery';
import type { ISkope, IElementScope } from '../../Skope';
import { Subs } from '../../utils';
export declare function walkerInstance(): {
    ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => number;
    run: (scopes: IElementScope[]) => void;
};
export declare function walkText(s: string, endJs?: string): string[];
export declare function walkTree(skope: ISkope, element: Node, parentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject, skipFirst: boolean): void;
