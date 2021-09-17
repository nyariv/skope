import { DelegateObject } from '../../eQuery';
import { watchRun } from '../runtime/watch';
import type { ISkope, IElementScope } from '../../Skope';
import { Subs } from '../../utils';

export default function attributeDirective(skope: ISkope, element: Element, att: Attr, currentSubs: Subs, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void, delegate: DelegateObject) {
  const at = att.nodeName.slice(1);
  const parts = at.split('.');
  ready((scopes) => {
    const $element = skope.wrapElem(element);
    currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, att.nodeValue), (val: any, lastVal) => {
      if (typeof val === 'object' && ['style', 'class'].includes(at)) {
        Object.entries(val).forEach((a) => Promise.resolve(a[1]).then((v) => {
          if (at === 'class') {
            $element.toggleClass(a[0], !!v);
          } else if (element instanceof HTMLElement || element instanceof SVGElement) {
            (<any>element.style)[a[0]] = v;
          }
        }, () => {
          if (at === 'class') {
            $element.toggleClass(a[0], false);
          }
        }));
      } else if (parts.length === 2 && ['style', 'class'].includes(parts[0])) {
        if (parts[0] === 'class') {
          $element.toggleClass(parts[1], !!val);
        } else if (element instanceof HTMLElement || element instanceof SVGElement) {
          (<any>element.style)[parts[1]] = val;
        }
      } else {
        $element.attr(at, `${val}`);
      }
    }, () => {}));
  });
}
