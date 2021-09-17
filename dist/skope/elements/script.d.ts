import type { IElementScope, ISkope } from '../../Skope';
export default function scriptElement(skope: ISkope, element: HTMLScriptElement, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void): void;
