import { IExecContext } from "@nyariv/sandboxjs";
import { Change } from "@nyariv/sandboxjs/dist/node/executor";
import Skope, { IElementScope, IRootScope } from "./Skope";

export const regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
export const regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;


export function isObject (object: any): object is {[key: string]: unknown} {
  return object !== null && typeof object === 'object';
}

export function isIterable(x: unknown): x is Iterable<unknown> {
  return x && typeof x === 'object' && Symbol.iterator in x;
}
  
export type sub = (() => void)|sub[];
export type subs = sub[];


interface IVarSubs {
  subscribeGet?: (callback: (obj: object, name: string) => void) => {
    unsubscribe: () => void;
  };
  subscribeSet?: (obj: object, name: string, callback: (modification: Change) => void) => {
    unsubscribe: () => void;
  }
}

export const varSubsStore: WeakMap<() => unknown|Promise<unknown>, IVarSubs> = new WeakMap();

export function createVarSubs(skope: Skope, context: IExecContext) {
  const varSubs: IVarSubs = {};
  varSubs.subscribeGet = (callback: (obj: object, name: string) => void) => skope.sandbox.subscribeGet(callback, context);
  varSubs.subscribeSet = (obj: object, name: string, callback: (modification: Change) => void) => skope.sandbox.subscribeSet(obj, name, callback, context);
  return varSubs;
}

export function unsubNested(subs: sub) {
  if (!subs) return;
  if (typeof subs === 'function') {
    subs();
    return;
  }
  const s = subs.slice();
  subs.length = 0;
  s.forEach((unsub) => {
    if (Array.isArray(unsub)) {
      unsubNested(unsub);
    } else {
      unsub();
    }
  });
}

export function createErrorCb(el: Node) {
  return (err: Error) => createError(err?.message, el);
}

export function createError(msg: string, el: Node) {
  const err = new Error(msg);
  (err as any).element = el;
  console.error(err, el);
  return err;
}