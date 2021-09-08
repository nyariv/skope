import Skope, { DirectiveExec, IElementScope } from "../Skope";
import htmlDirective from "./html";
import ifDirective from "./if";
import showDirective from "./show";
import modelDirective from "./model";
import refDirective from "./ref";
import textDirective from "./text";
import componentDirective from "./component";
import transitionDirective from "./transition";
import { subs } from "../utils";

export default function directives(skope: Skope) {
  const ret: {[name: string]: (exce: DirectiveExec, scopes: IElementScope[]) => subs} = {};
  for (let dir of [
    refDirective,
    htmlDirective,
    showDirective,
    ifDirective,
    textDirective,
    modelDirective,
    componentDirective,
    transitionDirective
  ]) {
    const directive = dir(skope);
    ret[directive.name] = directive.callback;
  }
  return ret;
}