import Skope, { DirectiveExec, IElementScope } from '../Skope';
import { Subs } from '../utils';
export default function modelDirective(skope: Skope): {
    name: string;
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => Subs;
};
