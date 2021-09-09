import Skope, { DirectiveExec, IElementScope } from '../Skope';
export default function refDirective(skope: Skope): {
    name: string;
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => (() => void)[];
};
