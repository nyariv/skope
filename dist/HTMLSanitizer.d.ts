export declare function sanitizeType(obj: HTMLSanitizer, t: (new () => Element)[], allowedAttributes: string[], element: (el: Element, preprocess: boolean) => boolean): void;
export interface IHTMLSanitizer {
    types: Map<new () => Element, {
        attributes: Set<string>;
        element: (el: Element, staticHtml: boolean) => boolean | void;
    }>;
    srcAttributes: Set<string>;
    allowedInputs: Set<string>;
    santizeAttribute(element: Element, attName: string, attValue: string, preprocess?: boolean, remove?: boolean): boolean;
    sanitizeHTML(element: Element | DocumentFragment, staticHtml?: boolean): void;
    isAttributeForced(elem: Element, att: string): boolean;
    setAttributeForced(elem: Element, att: string, value: string): void;
    observeAttribute(parent: Element, att: string, cb: (elem: Element) => void, staticHtml: boolean, persistant?: boolean): {
        cancel: () => void;
    };
}
export default class HTMLSanitizer implements IHTMLSanitizer {
    types: Map<new () => Element, {
        attributes: Set<string>;
        element: (el: Element, staticHtml: boolean) => boolean | void;
    }>;
    srcAttributes: Set<string>;
    allowedInputs: Set<string>;
    constructor();
    santizeAttribute(element: Element, attName: string, attValue: string, preprocess?: boolean, remove?: boolean): boolean;
    sanitizeHTML(element: Element | DocumentFragment, staticHtml?: boolean): void;
    isAttributeForced(elem: Element, att: string): boolean;
    setAttributeForced(elem: Element, att: string, value: string): void;
    observeAttribute(parent: Element, att: string, cb: (elem: Element) => void, staticHtml: boolean, persistant?: boolean): {
        cancel: () => void;
    };
}
