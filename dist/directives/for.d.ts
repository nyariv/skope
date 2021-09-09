import Skope, { IElementScope } from '../Skope';
import { Subs } from '../utils';
export default function forDirective(skope: Skope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void): void;
