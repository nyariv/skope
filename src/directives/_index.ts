import Skope, { DirectiveExec, IDirectiveDefinition, IElementScope } from '../Skope';
import htmlDirective from './html';
import showDirective from './show';
import modelDirective from './model';
import refDirective from './ref';
import textDirective from './text';
import componentDirective from './component';
import transitionDirective from './transition';
import { Subs } from '../utils';

export default function directives(skope: Skope) {
  const ret: { [name: string]: IDirectiveDefinition } = {};
  for (const dir of [
    refDirective,
    htmlDirective,
    showDirective,
    textDirective,
    modelDirective,
    componentDirective,
    transitionDirective,
  ]) {
    const directive = dir(skope);
    ret[directive.name] = directive;
  }
  return ret;
}
