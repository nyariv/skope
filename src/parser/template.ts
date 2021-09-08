import Skope, { IElementScope } from "../Skope";
import { createError } from "../utils";
import { getRootScope } from "./scope";


export function registerTemplates(skope: Skope, elem: DocumentFragment|Element, scopes: IElementScope[]) {
  const root = getRootScope(skope, scopes);
  if (!root) return;
  const recurse = (elem: Element|DocumentFragment) => {
    elem.querySelectorAll('template[id]:not([s-static] template, [s-detached] template)').forEach((template: HTMLTemplateElement) => {
      if (template.id) {
        if (root.$templates[template.id]) {
          createError('Duplicate template definition', template);
        } else {
          root.$templates[template.id] = template;
        }
      } else {
        recurse(template.content);
      }
    });
  }
  recurse(elem);
}