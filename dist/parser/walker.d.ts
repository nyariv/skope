import { DelegateObject } from '../eQuery';
import Skope, { IElementScope } from '../Skope';
import { Subs } from '../utils';
export declare function walkerInstance(): {
    ready: (cb: (scopes: IElementScope[]) => void) => number;
    run: (scopes: IElementScope[]) => void;
};
export declare function walkText(s: string, endJs?: string): string[];
export declare function walkTree(skope: Skope, element: Node, parentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject, skipFirst: boolean): void;
