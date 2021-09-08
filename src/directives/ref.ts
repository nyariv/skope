import { getScope } from "../parser/scope";
import Skope, { DirectiveExec, IElementScope } from "../Skope";
import { createError, regVarName } from "../utils";

export default function refDirective(skope: Skope) {
  return {
    name: 'ref',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => {
      if (!exec.js.match(regVarName)) {
        throw createError('Invalid ref name: ' + exec.js, exec.element);
      }
      const name = getScope(skope, exec.element, [], {name: exec.js.trim()});
      skope.exec(document, `$refs[name] = $wrap([...($refs[name] || []), $el])`, [...scopes, name]).run();
      return [() => {
        skope.exec(document, `$refs[name] = $refs[name].not($el)`, [...scopes, name]).run();
      }];
    }
  }
}