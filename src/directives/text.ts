import { watchRun } from '../runtime/watch';
import Skope, { DirectiveExec, IElementScope } from '../Skope';

export default function textDirective(skope: Skope) {
  return {
    name: 'text',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      skope.wrapElem(exec.element).text(`${val}`);
    }, () => {
      skope.wrapElem(exec.element).text('');
    }),
  };
}
