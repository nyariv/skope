import { watchRun } from '../runtime/watch';
import Skope, { DirectiveExec, IElementScope } from '../Skope';

export default function showDirective(skope: Skope) {
  return {
    name: 'show',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      exec.element.classList.toggle('s-hide', !val);
    }, () => {
      exec.element.classList.toggle('s-hide', false);
    }),
  };
}
