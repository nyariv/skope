import type { ISkope, IDirectiveDefinition } from '../../Skope';
import htmlDirective from './s-html';
import showDirective from './s-show';
import modelDirective from './s-model';
import refDirective from './s-ref';
import textDirective from './s-text';
import componentDirective from './s-component';
import transitionDirective from './s-transition';

export default function directives(skope: ISkope) {
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
