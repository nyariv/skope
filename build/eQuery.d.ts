declare type sortCallback = (a: Element, b: Element) => any;
declare type search = (value: Element, index?: number) => any;
interface EqEventListener {
    (evt: EqEvent): void;
}
export declare const $document: ElementCollection;
export declare class ElementCollection extends Array<Element> {
    constructor(...items: (Element | number)[]);
    sort(callback?: sortCallback): this;
    unique(): ElementCollection;
    toArray(): unknown[];
    toSet(): Set<Element>;
    add(selector: wrapType, context?: ElementCollection): ElementCollection;
    is(selector: wrapType): boolean;
    not(selector: wrapType): ElementCollection;
    has(selector: wrapType): ElementCollection;
    search(selector: wrapType | search): ElementCollection;
    on(events: {
        [ev: string]: EqEventListener;
    }, options?: AddEventListenerOptions): this;
    on(events: string, callback: EqEventListener, options?: AddEventListenerOptions): this;
    off(events?: string, callback?: EqEventListener): this;
    trigger(eventType: string, detail?: any, bubbles?: boolean, cancelable?: boolean): this;
    one(events: string | {
        [ev: string]: EqEventListener;
    }, callback?: EqEventListener | AddEventListenerOptions, options?: AddEventListenerOptions): this;
    click(callback?: EqEventListener, options?: AddEventListenerOptions): this;
    hover(handlerIn: EqEventListener, handlerOut?: EqEventListener): this;
    attr(key: string | {
        [attr: string]: string | number;
    }, set?: string | number): string | this;
    removeAttr(key: string): this;
    val(set?: string | number): string | number | this;
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
    next(selector?: string): Element[];
    nextUntil(selector?: string | Element, filter?: string): ElementCollection;
    nextAll(selector?: string): ElementCollection;
    prev(selector?: string): Element[];
    prevUntil(selector?: string | Element, filter?: string): Element[];
    prevAll(selector?: string): Element[];
    siblings(selector?: string): ElementCollection;
    children(selector?: string): ElementCollection;
}
export declare class EqEvent {
    constructor(originalEvent: Event);
}
export declare type selector = Element | ElementCollection | NodeList | string | Set<Element>;
export declare type wrapType = selector | selector[];
export declare function wrap(selector: wrapType, context?: ElementCollection): ElementCollection;
export declare function getStore<T>(elem: Element, store: string, defaultValue?: T): T;
export declare function deleteStore(elem: Element, store: string): any;
export {};
