import type { ISkope, IDirectiveExec, IElementScope } from '../../Skope';
export default function showDirective(skope: ISkope): {
    name: string;
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => import("../../utils").Subs;
};
