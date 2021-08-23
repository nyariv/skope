import HTMLSanitizer from './HTMLSanitizer.js';

var sanitizer = new HTMLSanitizer();
var init = import('./Skope.js').then(mod => {
  var skope = new mod.default({
    sanitizer
  });
  return el => skope.init(el, undefined, true);
});
var subs = [];
var canceled = false;
var sub = sanitizer.observeAttribute(document.documentElement, 'skope', el => {
  init.then(skope => {
    if (!canceled) {
      sub = skope(el);
      subs.push(sub.cancel);
    }
  });
}, false);
subs.push(sub.cancel);
sub = sanitizer.observeAttribute(document.documentElement, 's-static', () => {}, true, true);
subs.push(sub.cancel);
function cancel() {
  canceled = true;

  for (var _sub of subs) {
    _sub();
  }

  subs.length = 0;
}

export { cancel };
//# sourceMappingURL=defaultInit.js.map
