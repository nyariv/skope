import { preprocessHTML, processHTML } from "../parser/process";
import { getRootScope, pushScope } from "../parser/scope";
import Skope, { DirectiveExec, IElementScope } from "../Skope";
import { createError, subs } from "../utils";

const ddd = document.createElement('div');
ddd.innerHTML = '<span $$templates="$templates"><span>';
const $$templatesAttr = ddd.querySelector('span').attributes.item(0);

export default function componentDirective(skope: Skope) {
  return {
    name: 'component',
    callback: (exec: DirectiveExec, scopes: IElementScope[]) => {
      const template = getRootScope(skope, scopes)?.$templates[exec.att.nodeValue];
      if (!(template instanceof HTMLTemplateElement)) {
        createError('Template not found', exec.att)
        return [];
      }
  
      const elem = exec.element;
      const $elem = skope.wrapElem(elem);
      const subs: subs = [];
      const delegate = $elem.delegate();
  
      const isStatic = elem.hasAttribute('s-static');
      elem.removeAttribute('s-static');
      const templateContent = template.content.cloneNode(true) as DocumentFragment;
      const slot = templateContent.querySelector('[slot]');
  
      for (let attribute of template.attributes) {
        const name = attribute.nodeName.toLowerCase();
        if (name === 'id') continue;
        if (elem.hasAttribute(name)) continue;
        elem.setAttributeNode(attribute.cloneNode(true) as Attr);
      }
      elem.setAttributeNode($$templatesAttr.cloneNode(true) as Attr);
  
      if (slot) {
        slot.innerHTML = '';
        if (elem.hasAttribute('s-detached')) {
          slot.setAttribute('s-detached', elem.getAttribute('s-detached'));
        }
        if (elem.hasAttribute('s-html')) {
          slot.setAttribute('s-html', elem.getAttribute('s-html'));
        }
        if (elem.hasAttribute('s-text')) {
          slot.setAttribute('s-text', elem.getAttribute('s-text'));
        }
      }
      elem.removeAttribute('s-html');
      elem.removeAttribute('s-text');
      const slotContent = document.createElement('template');
  
      const isIframe = elem instanceof HTMLIFrameElement;
      if (isIframe) {
        if (slot) {
          slotContent.innerHTML = elem.getAttribute('skope-iframe-content');
        }
        elem.removeAttribute('skope-iframe-content');
      } else {
        slotContent.content.append(...elem.childNodes);
        elem.appendChild(templateContent);
      }
  
      elem.removeAttribute('s-component');
      elem.setAttribute('s-detached', '');
      processHTML(skope, elem, subs, delegate).run(pushScope(skope, scopes, elem, subs));
      if (isIframe) {
        $elem.html(templateContent);
      }
      elem.removeAttribute('s-detached');
      elem.setAttribute('s-component', exec.att.nodeValue);
      elem.setAttribute('component-processed', '');
  
      if (slot) {
        skope.getStore<IElementScope[]>(slot, 'scopes', scopes);
        if (isIframe) {
          if (isStatic) {
            slot.setAttribute('s-static', '');
          }
          preprocessHTML(skope, slot, slotContent.content);
          slot.appendChild(slotContent.content);
          processHTML(skope, slot, subs, exec.delegate).run(scopes);
        } else {
          slot.appendChild(slotContent.content);
          /** @todo handle mutation observer race condition */
          setTimeout(() => {
            if (isStatic) {
              slot.setAttribute('s-static', '');
            }
            processHTML(skope, slot, subs, exec.delegate).run(scopes);
          });
        }
      }
      return subs;
    }
  }
}