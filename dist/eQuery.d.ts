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
export declare const defaultDelegateObject: DelegateObject;
export declare class ElementCollection {
    constructor(...items: (Element | number)[]);
    get size(): number;
    get $elements(): Element[];
    [Symbol.iterator](): IterableIterator<Element>;
    forEach(cb: (elem?: Element, i?: number) => void): void;
    map<T>(cb: (elem?: Element, i?: number) => T): T[];
    filter(selector: wrapType | ((elem?: Element, i?: number) => boolean)): ElementCollection;
    some(cb: (elem: Element, i: number) => boolean): boolean;
    every(cb: (elem: Element, i: number) => boolean): boolean;
    slice(start?: number, end?: number): ElementCollection;
    sort(callback?: sortCallback): this;
    reverse(): this;
    unique(): ElementCollection;
    toArray(): Element[];
    toSet(): Set<Element>;
    is(selector: wrapType): boolean;
    not(selector: wrapType): ElementCollection;
    has(selector: wrapType): ElementCollection;
    find(selector: wrapType | search): ElementCollection;
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
    val(set?: boolean | string | number | string[]): string | number | string[] | boolean | this;
    text(set?: string): any;
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
    once(identifier: any): ElementCollection;
    get(index: number): Element;
    index(selector?: wrapType): number;
    first(): ElementCollection;
    last(): ElementCollection;
    eq(index: number): ElementCollection;
    next(selector?: string): ElementCollection;
    nextUntil(selector?: string | Element, filter?: string): ElementCollection;
    nextAll(selector?: string): ElementCollection;
    prev(selector?: string): ElementCollection;
    prevUntil(selector?: string | Element, filter?: string): ElementCollection;
    prevAll(selector?: string): ElementCollection;
    siblings(selector?: string): ElementCollection;
    children(selector?: string): ElementCollection;
}
export declare const $document: ElementCollection;
export interface EqEvent {
    isEqEvent: boolean;
    stoppedImmediatePropagation: boolean;
    stoppedPropagation: boolean;
}
export declare type selector = Element | ElementCollection | NodeList | HTMLCollection | string | Set<Element>;
export declare type wrapType = selector | selector[];
export declare function wrap(selector: wrapType, context?: ElementCollection): ElementCollection;
export declare function getStore<T>(elem: Node, store: string, defaultValue?: T): T;
export declare function deleteStore(elem: Element, store: string): boolean;
export {};
