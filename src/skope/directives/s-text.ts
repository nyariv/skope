import { watchRun } from '../runtime/watch';
import type { ISkope, IDirectiveExec, IElementScope } from '../../Skope';

export default function textDirective(skope: ISkope) {
  return {
    name: 'text',
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      skope.wrapElem(exec.element).text(`${val}`);
    }, () => {
      skope.wrapElem(exec.element).text('');
    }),
  };
}
