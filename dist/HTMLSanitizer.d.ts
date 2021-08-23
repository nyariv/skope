export declare function sanitizeType(obj: HTMLSanitizer, t: (new () => Element)[], allowedAttributes: string[], element: (el: Element) => boolean): void;
export default class HTMLSanitizer {
    types: Map<new () => Element, {
        attributes: Set<string>;
        element: (el: Element) => boolean | void;
    }>;
    srcAttributes: Set<string>;
    allowedInputs: Set<string>;
    constructor();
    santizeAttribute(element: Element, attName: string, attValue: string, preprocess?: boolean): boolean;
    sanitizeHTML(element: Element | DocumentFragment, staticHtml?: boolean): void;
    observeAttribute(parent: Element, att: string, cb: (elem: Element) => void, staticHtml: boolean, persistant?: boolean): {
        cancel: () => void;
    };
}
