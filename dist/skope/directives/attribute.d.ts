import { DelegateObject } from '../../eQuery';
import type { ISkope, IElementScope } from '../../Skope';
import { Subs } from '../../utils';
export default function attributeDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject): void;
