import { getRootElement } from '../runtime/scope';
import type { IElementScope, ISkope } from '../../Skope';
import { createError } from '../../utils';

export default function scriptElement(skope: ISkope, element: HTMLScriptElement, ready: (cb: (scopes: IElementScope[]) => void) => void) {
  if (element.type === 'skopejs') {
    ready((scopes) => {
      try {
        skope.exec(getRootElement(skope, scopes), element.innerHTML, scopes).run();
      } catch (err) {
        createError(err?.message, element);
      }
    });
  } else {
    element.remove();
  }
}
