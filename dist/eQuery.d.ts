import HTMLSanitizer from "./HTMLSanitizer";
declare type sortCallback = (a: Element, b: Element) => any;
declare type search = (value?: Element, index?: number) => any;
interface EqEventListener<T> {
    (evt: T & EqEvent): void;
}
interface EqEventListenerAny extends EqEventListener<any> {
}
export interface DelegateObject {
    on<T extends Event>(elem: Element, event: string, callback: EqEventListener<T>): () => void;
    one<T extends Event>(elem: Element, event: string, callback: EqEventListener<T>): () => void;
    off(): void;
}
export interface EqEvent {
    isEqEvent: boolean;
    stoppedImmediatePropagation: boolean;
    stoppedPropagation: boolean;
}
export interface IElementCollection {
    get length(): number;
    get $elements(): Element[];
    [Symbol.iterator](): IterableIterator<Element>;
    forEach(cb: (elem?: Element, i?: number) => void): void;
    map<T>(cb: (elem?: Element, i?: number) => T): T[];
    filter(selector: wrapType | ((elem?: Element, i?: number) => boolean)): IElementCollection;
    some(cb: (elem: Element, i: number) => boolean): boolean;
    every(cb: (elem: Element, i: number) => boolean): boolean;
    slice(start?: number, end?: number): IElementCollection;
    sort(callback?: sortCallback): this;
    reverse(): this;
    unique(): IElementCollection;
    toArray(): Element[];
    toSet(): Set<Element>;
    is(selector: wrapType): boolean;
    not(selector: wrapType): IElementCollection;
    has(selector: wrapType): IElementCollection;
    find(selector: wrapType | search): IElementCollection;
    on<T extends Event>(events: {
        [ev: string]: EqEventListener<T>;
    }, options?: AddEventListenerOptions): this;
    on<T extends Event>(events: string, callback: EqEventListener<T>, options?: AddEventListenerOptions): this;
    off(events?: string, callback?: EqEventListenerAny): this;
    trigger(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): this;
    one<T extends Event>(events: string | {
        [ev: string]: EqEventListener<T>;
    }, callback?: EqEventListener<T> | AddEventListenerOptions, options?: AddEventListenerOptions): this;
    delegate(): DelegateObject;
    click(callback?: EqEventListener<MouseEvent>, options?: AddEventListenerOptions): this;
    hover(handlerIn: EqEventListener<MouseEvent>, handlerOut?: EqEventListener<MouseEvent>): this;
    attr(key: string | {
        [attr: string]: string | number;
    }, set?: string | number): string | this;
    removeAttr(key: string): this;
    val(set?: boolean | string | number | string[]): string | number | string[] | boolean | FileList;
    vals(set?: {
        [name: string]: boolean | string | number | string[];
    }): {
        [name: string]: boolean | string | number | string[] | FileList;
    };
    scrollTop(set?: number): any;
    scrollLeft(set?: number): any;
    label(set?: string): string | this;
    data(key: string | {
        [data: string]: any;
    }, set?: any): any;
    removeData(key: string): this;
    addClass(name: string): this;
    removeClass(name: string): this;
    toggleClass(name: string | {
        [clas: string]: boolean;
    }, force?: boolean): this;
    hasClass(name: string): boolean;
    once(identifier: any): IElementCollection;
    get(index: number): Element;
    index(selector?: wrapType): number;
    first(): IElementCollection;
    last(): IElementCollection;
    eq(index: number): IElementCollection;
    next(selector?: string): IElementCollection;
    nextUntil(selector?: string | Element, filter?: string): IElementCollection;
    nextAll(selector?: string): IElementCollection;
    prev(selector?: string): IElementCollection;
    prevUntil(selector?: string | Element, filter?: string): IElementCollection;
    prevAll(selector?: string): IElementCollection;
    siblings(selector?: string): IElementCollection;
    children(selector?: string): IElementCollection;
}
export declare type selector = Element | IElementCollection | Iterable<Element> | string;
export declare type wrapType = selector | selector[];
export declare function ownerDoc(coll: IElementCollection): HTMLDocument | undefined;
export declare function isIterable(x: unknown): x is Iterable<unknown>;
export default function createClass(sanitizer: () => HTMLSanitizer): {
    getStore: <T>(elem: Node, store: string, defaultValue?: T) => T;
    deleteStore: (elem: Element, store: string) => boolean;
    ElementCollection: new (item?: number | Element, ...items: Element[]) => IElementCollection;
    wrap: (selector: wrapType, context: IElementCollection | Document) => IElementCollection;
    defaultDelegateObject: DelegateObject;
};
export {};
