import { getRootElement, pushScope } from '../runtime/scope';
import { watchRun } from '../runtime/watch';
import Skope, { DirectiveExec, IElementScope } from '../Skope';
import { createError, Subs } from '../utils';

export default function modelDirective(skope: Skope) {
  return {
    name: 'model',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => {
      const el: any = exec.element;
      const isContentEditable = (el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === ''));
      const $el: any = skope.wrapElem(el);
      let last: any = !isContentEditable ? $el.val() : $el.html();
      if (!el.hasAttribute('name')) {
        el.setAttribute('name', exec.js.trim());
      }
      let reset = false;
      const change = () => {
        last = !isContentEditable ? $el.val() : $el.html();
        try {
          skope.exec(getRootElement(skope, scopes), `${exec.js.trim()} = ($$value === undefined && !reset) ? ${exec.js.trim()} : $$value`, pushScope(skope, scopes, el, exec.subs, { $$value: last, reset })).run();
          reset = false;
        } catch (err) {
          createError(err?.message, exec.att);
        }
      };
      const sub: Subs = [];
      sub.push(exec.delegate.on(el, 'input', change));
      if (el.form) {
        const $form = skope.wrap(el.form, el.ownerDocument);
        sub.push($form.delegate().on($form.get(0), 'reset', () => reset = !!setTimeout(change)));
      }
      sub.push(skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js.trim()), (val, lastVal) => {
        if (val === last) return;
        if (isContentEditable) {
          $el.html(`${val}`);
        } else {
          $el.val(val as any);
        }
      }, () => {
        if (isContentEditable) {
          $el.html('');
        }
      }));
      return sub;
    },
  };
}
