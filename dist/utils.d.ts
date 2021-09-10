import { IExecContext } from '@nyariv/sandboxjs';
import { Change } from '@nyariv/sandboxjs/dist/node/executor';
import type { ISkope } from './Skope';
export declare const regVarName: RegExp;
export declare const regKeyValName: RegExp;
export declare function isObject(object: any): object is {
    [key: string]: unknown;
};
export declare function isIterable(x: unknown): x is Iterable<unknown>;
export declare type Sub = (() => void) | Sub[];
export declare type Subs = Sub[];
export interface IVarSubs {
    subscribeGet?: (callback: (obj: Record<string, unknown>, name: string) => void) => {
        unsubscribe: () => void;
    };
    subscribeSet?: (obj: Record<string, unknown>, name: string, callback: (modification: Change) => void) => {
        unsubscribe: () => void;
    };
}
export declare function createVarSubs(skope: ISkope, context: IExecContext): IVarSubs;
export declare function unsubNested(subs: Sub): void;
export declare function createErrorCb(el: Node): (err: Error) => Error;
export declare function createError(msg: string, el: Node): Error;
export declare function changeErrorCb(cb: (err: Error, el: Node) => void): void;
