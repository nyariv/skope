import type { ISkope, IElementScope } from '../../Skope';
import { Subs } from '../../utils';
export declare function watchRun(skope: ISkope, el: Node, scopes: IElementScope[], code: string): () => unknown;
export declare function watch<T>(skope: ISkope, elem: Node, toWatch: () => T, handler: (val: T, lastVal: T | undefined) => void | Promise<void>, errorCb?: (err: Error) => void): Subs;
