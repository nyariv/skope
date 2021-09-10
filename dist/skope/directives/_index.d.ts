import type { ISkope, IDirectiveDefinition } from '../../Skope';
export default function directives(skope: ISkope): {
    [name: string]: IDirectiveDefinition;
};
