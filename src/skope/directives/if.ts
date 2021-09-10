import { DelegateObject } from '../../eQuery';
import { pushScope } from '../runtime/scope';
import { watchRun } from '../runtime/watch';
import type { ISkope, IElementScope } from '../../Skope';
import { createError, Subs, unsubNested } from '../../utils';

export default function ifDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void) => void, delegate: DelegateObject) {
  const comment = document.createComment('s-if');
  let ifElem: Element;
  const at = element.getAttribute('s-if');
  element.before(comment);
  element.remove();
  skope.deleteStore(element, 'currentSubs');
  ready((scopes) => {
    skope.getStore<Subs>(comment, 'currentSubs', currentSubs);
    const nestedSubs: Subs = [];
    currentSubs.push(nestedSubs);
    try {
      currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, at), (val, lastVal) => {
        if (val) {
          if (!ifElem) {
            ifElem = element.cloneNode(true) as Element;
            ifElem.removeAttribute('s-if');
            const processed = skope.processHTML(skope, ifElem, nestedSubs, delegate);
            comment.after(processed.elem);
            processed.run(pushScope(skope, scopes, ifElem, nestedSubs));
          }
        } else if (ifElem) {
          ifElem.remove();
          ifElem = undefined;
          unsubNested(nestedSubs);
        }
      }, (err: Error) => {
        if (ifElem) {
          ifElem.remove();
          ifElem = undefined;
          unsubNested(nestedSubs);
        }
      }));
    } catch (err) {
      createError(err.message, att);
    }
  });
}
