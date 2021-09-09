import Skope, { IDirectiveDefinition } from '../Skope';
export default function directives(skope: Skope): {
    [name: string]: IDirectiveDefinition;
};
