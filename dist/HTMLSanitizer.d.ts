export declare const defaultHTMLWhiteList: (new () => Element)[];
export declare function santizeAttribute(element: Element, attName: string, attValue: string, preprocess?: boolean): boolean;
export declare function sanitizeHTML(element: Element | DocumentFragment): void;
