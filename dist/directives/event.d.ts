import { DelegateObject } from '../eQuery';
import Skope, { IElementScope } from '../Skope';
import { Subs } from '../utils';
export default function eventDirective(skope: Skope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject): void;