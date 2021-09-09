import { watchRun } from '../runtime/watch';
import Skope, { DirectiveExec, IElementScope } from '../Skope';

export default function htmlDirective(skope: Skope) {
  return {
    name: 'html',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      if (val instanceof Element || typeof val === 'string' || val instanceof skope.ElementCollection) {
        skope.wrapElem(exec.element).html(val);
      }
    }, () => {
      skope.wrapElem(exec.element).html('');
    }),
  };
}
