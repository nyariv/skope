import Skope, { DirectiveExec, IElementScope } from '../Skope';
export default function textDirective(skope: Skope): {
    name: string;
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => import("../utils").Subs;
};
