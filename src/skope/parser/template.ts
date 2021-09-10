import type { ISkope, IElementScope } from '../../Skope';
import { createError } from '../../utils';
import { getRootScope } from '../runtime/scope';

export default function registerTemplates(skope: ISkope, elem: DocumentFragment | Element, scopes: IElementScope[]) {
  const root = getRootScope(skope, scopes);
  if (!root) return;
  const recurse = (el: Element | DocumentFragment) => {
    el.querySelectorAll('template[id]:not([s-static] template, [s-detached] template)').forEach((template: HTMLTemplateElement) => {
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
  };
  recurse(elem);
}
