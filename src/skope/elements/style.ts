import type { ISkope } from '../../Skope';

export default function styleElement(skope: ISkope, element: HTMLStyleElement) {
  const loaded = () => {
    const parent = element.parentElement;
    if (!parent) return;
    const id = parent.getAttribute('skope-style') || ++skope.styleIds;
    skope.sanitizer.setAttributeForced(parent, 'skope-style', `${id}`);
    let i = element.sheet.cssRules.length - 1;
    for (const rule of [...element.sheet.cssRules].reverse()) {
      if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
        element.sheet.deleteRule(i);
      }
      i--;
    }
    i = 0;
    for (const rule of [...element.sheet.cssRules]) {
      if (rule instanceof CSSStyleRule) {
        const { cssText } = rule.style;
        element.sheet.deleteRule(i);
        element.sheet.insertRule(`[skope-style="${id}"] :is(${rule.selectorText}) { ${cssText} }`, i);
      }
      i++;
    }
  };
  if (element.sheet && element.parentElement) {
    loaded();
  } else {
    element.addEventListener('load', loaded);
  }
}
