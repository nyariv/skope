import { getRootElement } from './scope';
import type { ISkope, IElementScope } from '../../Skope';
import {
  createError, createVarSubs, Subs, unsubNested,
} from '../../utils';

export function watchRun(skope: ISkope, el: Node, scopes: IElementScope[], code: string): () => unknown {
  try {
    const exec = skope.exec(getRootElement(skope, scopes), `return ${code}`, scopes);
    skope.varSubsStore.set(exec.run, createVarSubs(skope, exec.context));
    return exec.run;
  } catch (err) {
    createError(err.message, el);
    const r = () => {};
    skope.varSubsStore.set(r, { subscribeGet() { return { unsubscribe() {} }; }, subscribeSet() { return { unsubscribe() {} }; } });
    return r;
  }
}

export function watch<T>(skope: ISkope, elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): Subs {
  const watchGets: Map<any, Set<string>> = new Map();
  const subUnsubs: Subs = [];
  let varSubs = skope.varSubsStore.get(toWatch);
  if (!varSubs) {
    const context = skope.sandbox.getContext(toWatch);
    if (!context) {
      createError('Non-sandbox watch callback', elem);
      return subUnsubs;
    }
    varSubs = createVarSubs(skope, context);
  }
  let lastVal: any;
  let update = false;
  let start = Date.now();
  let count = 0;
  let lastPromise: any;
  const ignore = new WeakMap<any, Set<string>>();
  const digest = () => {
    if ((Date.now() - start) > 4000) {
      count = 0;
      start = Date.now();
    } else if (count++ > 200) {
      createError('Too many digests', elem);
      return;
    }
    unsubNested(subUnsubs);
    const g = varSubs?.subscribeGet((obj: any, name: string) => {
      if (obj === undefined) return;
      const list = watchGets.get(obj) || new Set();
      list.add(name);
      watchGets.set(obj, list);
    });
    let val: any;
    try {
      val = toWatch();
    } catch (err) {
      g.unsubscribe();
      createError(err?.message, elem);
      return;
    }
    g.unsubscribe();
    for (const item of watchGets) {
      const obj = item[0];
      for (const name of item[1]) {
        subUnsubs.push(varSubs?.subscribeSet(obj, name, () => {
          let names = ignore.get(obj);
          if (!names) {
            names = new Set();
            ignore.set(obj, names);
          }
          names.add(name);
        }).unsubscribe);
      }
    }
    /* eslint-disable @typescript-eslint/no-loop-func */
    for (const item of watchGets) {
      const obj = item[0];
      for (const name of item[1]) {
        subUnsubs.push(skope.sandbox.subscribeSetGlobal(obj, name, (mod) => {
          if (ignore.get(obj)?.has(name)) {
            ignore.get(obj).delete(name);
            return;
          }
          if (update) return;
          update = true;
          skope.call(() => {
            update = false;
            digest();
          });
        }).unsubscribe);
      }
    }
    /* eslint-enable @typescript-eslint/no-loop-func */
    watchGets.clear();
    const promise = Promise.resolve(!errorCb ? undefined : val);
    lastPromise = promise;
    promise.then((v) => {
      if (lastPromise !== promise) return;
      v = !errorCb ? val : v;
      if (v !== lastVal) {
        const temp = lastVal;
        lastVal = v;
        try {
          handler(v, temp);
        } catch (err) {
          createError(err?.message, elem);
        }
      }
    }, errorCb);
  };
  digest();
  return subUnsubs;
}
