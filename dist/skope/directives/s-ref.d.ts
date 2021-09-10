import type { ISkope, IDirectiveExec, IElementScope } from '../../Skope';
export default function refDirective(skope: ISkope): {
    name: string;
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => (() => void)[];
};
