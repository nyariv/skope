import type { IElementScope, ISkope } from '../../Skope';

export default function iframetElement(skope: ISkope, element: HTMLIFrameElement, ready: (cb: (scopes: IElementScope[]) => void | IElementScope[]) => void) {
  ready(() => {
    const exec = () => {
      skope.wrapElem(element).html(element.getAttribute('skope-iframe-content'));
      element.removeAttribute('skope-iframe-content');
    };
    if (element.contentDocument.readyState !== 'complete') {
      element.addEventListener('load', exec);
    } else {
      exec();
    }
  });
}
