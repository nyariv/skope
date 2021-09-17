import { pushScope } from '../runtime/scope';
import { watchRun } from '../runtime/watch';
import type { ISkope, IElementScope } from '../../Skope';
import {
  createError, isIterable, isObject, regKeyValName, regVarName, Subs, unsubNested,
} from '../../utils';

export default function forDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void) {
  const comment = document.createComment('s-for');
  element.after(comment);
  element.remove();
  skope.deleteStore(element, 'currentSubs');
  const items = new Set<Element>();
  const at = element.getAttribute('s-for');
  const split = at.split(' in ');
  if (split.length < 2) {
    createError('In valid s-for directive', att);
    return;
  }
  const exp = split.slice(1).join(' in ');

  const varsExp = split[0];
  let key: string;
  let value: string;
  let match: string;
  const varMatch = varsExp.match(regVarName);
  if (varMatch) {
    [match, value] = varMatch;
  } else {
    [match, key, value] = varsExp.match(regKeyValName);
    if (!match) {
      createError('In valid s-for directive', att);
      return;
    }
  }
  ready((scopes) => {
    const del = skope.wrapElem(comment.parentElement).delegate();
    currentSubs.push(del.off);
    const nestedSubs: Subs = [];
    currentSubs.push(nestedSubs);
    currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, exp), (val) => {
      unsubNested(nestedSubs);
      items.forEach((item) => {
        item.remove(); // @TODO: optimize
      });
      items.clear();
      const runs: (() => void)[] = [];
      const repeat = (item: unknown, i: number | string) => {
        const forSubs: Subs = [];
        nestedSubs.push(forSubs);
        const scope: any = { $index: i };
        if (key) scope[key] = i;
        if (value) scope[value] = item;
        const elem = element.cloneNode(true) as Element;
        elem.removeAttribute('s-for');
        const processed = skope.processHTML(skope, elem, forSubs, del);
        comment.before(processed.elem);
        items.add(elem);
        runs.push(() => processed.run(pushScope(skope, scopes, elem, forSubs, scope)));
      };
      let i = -1;
      if (isIterable(val)) {
        for (const item of val) {
          i++;
          repeat(item, i);
        }
      } else if (isObject(val)) {
        for (const j in val) {
          repeat(val[j], j);
        }
      }
      runs.forEach((run) => run());
    }, () => {
      unsubNested(nestedSubs);
      items.forEach((item) => {
        item.remove(); // @TODO: optimize
      });
      items.clear();
    }));
  });
}
