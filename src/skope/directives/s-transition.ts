import { watchRun } from '../runtime/watch';
import type {
  ISkope, IDirectiveExec, IDirectiveDefinition, IElementScope,
} from '../../Skope';

export default function transitionDirective(skope: ISkope): IDirectiveDefinition {
  return {
    name: 'transition',
    callback: (exec: IDirectiveExec, scopes: IElementScope[]) => {
      const $el = skope.wrapElem(exec.element);
      $el.addClass('s-transition');
      $el.addClass('s-transition-idle');
      let lastPromise: Promise<unknown>;
      return skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
        if (val === undefined || lastPromise !== val) {
          $el.addClass('s-transition-idle');
          $el.removeClass('s-transition-active');
          $el.removeClass('s-transition-done');
          $el.removeClass('s-transition-error');
        }
        if (val instanceof Promise) {
          lastPromise = val;
          $el.removeClass('s-transition-idle');
          $el.addClass('s-transition-active');
          val.then(() => {
            if (lastPromise !== val) return;
            $el.removeClass('s-transition-active');
            $el.addClass('s-transition-done');
          }, () => {
            if (lastPromise !== val) return;
            $el.removeClass('s-transition-active');
            $el.addClass('s-transition-error');
          });
        }
      });
    },
  };
}
