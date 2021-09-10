import type { ISkope, IDirectiveExec, IElementScope } from '../../Skope';
import { Subs } from '../../utils';
export default function modelDirective(skope: ISkope): {
    name: string;
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => Subs;
};
