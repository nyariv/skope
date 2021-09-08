import { watchRun } from "../runtime/watch";
import Skope, { DirectiveExec, IElementScope } from "../Skope";

export default function ifDirective(skope: Skope) {
  return {
    name: 'if',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => {
      return skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
        exec.element.classList.toggle('s-hide', !val);
      }, () => {
        exec.element.classList.toggle('s-hide', false);
      });
    }
  }
}