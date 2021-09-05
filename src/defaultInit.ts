import HTMLSanitizer from './HTMLSanitizer';
const sanitizer = new HTMLSanitizer();
const imps = ['./Skope.js']
const init = import(imps.pop()).then((mod) => {
  const skope = new mod.default({sanitizer});
  return (el: Element) => skope.init(el, undefined, true);
});

const subs: (() => void)[] = [];
let canceled = false;

let sub = sanitizer.observeAttribute(document.documentElement, 'skope', (el) => {
  init.then((skope) => {
    if (!canceled) {
      sub = skope(el);
      subs.push(sub.cancel);
    }
  });
}, false);
subs.push(sub.cancel);

sub = sanitizer.observeAttribute(document.documentElement, 's-static', () => {}, true, true);
subs.push(sub.cancel);

(globalThis as any).cancelSkope = function cancel() {
  canceled = true;
  for (let sub of subs) {
    sub();
  }
  subs.length = 0;
}