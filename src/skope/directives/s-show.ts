import { watchRun } from '../runtime/watch';
import type { ISkope, IDirectiveExec, IElementScope } from '../../Skope';

export default function showDirective(skope: ISkope) {
  return {
    name: 'show',
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      exec.element.classList.toggle('s-hide', !val);
    }, () => {
      exec.element.classList.toggle('s-hide', false);
    }),
  };
}
