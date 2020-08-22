class Prop {
  constructor(context, prop, isConst = false, isGlobal = false, isVariable = false) {
    this.context = context;
    this.prop = prop;
    this.isConst = isConst;
    this.isGlobal = isGlobal;
    this.isVariable = isVariable;
  }

}

class Lisp {
  constructor(obj) {
    this.op = obj.op;
    this.a = obj.a;
    this.b = obj.b;
  }

}

class If {
  constructor(t, f) {
    this.t = t;
    this.f = f;
  }

}

class KeyVal {
  constructor(key, val) {
    this.key = key;
    this.val = val;
  }

}

class ObjectFunc {
  constructor(key, args, tree) {
    this.key = key;
    this.args = args;
    this.tree = tree;
  }

}

class SpreadObject {
  constructor(item) {
    this.item = item;
  }

}

class SpreadArray {
  constructor(item) {
    this.item = item;
  }

}

var VarType;

(function (VarType) {
  VarType["let"] = "let";
  VarType["const"] = "const";
  VarType["var"] = "var";
})(VarType || (VarType = {}));

class Scope {
  constructor(parent, vars = {}, functionThis = undefined) {
    this.const = new Set();
    this.let = new Set();
    this.parent = parent;
    this.allVars = vars;
    this.var = new Set(Object.keys(vars));
    this.globals = !parent ? new Set(Object.keys(vars)) : new Set();
    this.functionThis = functionThis || !parent;

    if (functionThis) {
      this.declare('this', VarType.var, functionThis);
    }
  }

  get(key, functionScope = false) {
    if (!this.parent || !functionScope || this.functionThis) {
      if (this.globals.has(key)) {
        return new Prop(this.functionThis, key, false, true, true);
      }

      if (key in this.allVars && (!(key in {}) || this.allVars.hasOwnProperty(key))) {
        return new Prop(this.allVars, key, this.const.has(key), this.globals.has(key), true);
      }

      if (!this.parent) {
        return new Prop(undefined, key);
      }
    }

    return this.parent.get(key, functionScope);
  }

  set(key, val) {
    if (key === 'this') throw new SyntaxError('"this" cannot be a variable');
    let prop = this.get(key);

    if (prop.context === undefined) {
      throw new ReferenceError(`Variable '${key}' was not declared.`);
    }

    if (prop.isConst) {
      throw new TypeError(`Cannot assign to const variable '${key}'`);
    }

    if (prop.isGlobal) {
      throw new SandboxError(`Cannot override global variable '${key}'`);
    }

    prop.context[prop] = val;
    return prop;
  }

  declare(key, type = null, value = undefined, isGlobal = false) {
    if (type === 'var' && !this.functionThis && this.parent) {
      return this.parent.declare(key, type, value, isGlobal);
    } else if (!this.var.has(key) || !this.let.has(key) || !this.const.has(key) || !this.globals.has(key)) {
      if (isGlobal) {
        this.globals.add(key);
      }

      this[type].add(key);
      this.allVars[key] = value;
    } else {
      throw Error(`Variable '${key}' already declared`);
    }

    return new Prop(this.allVars, key, this.const.has(key), isGlobal);
  }

}

class ParseError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }

}

class SandboxError extends Error {}

class SandboxGlobal {
  constructor(globals) {
    if (globals === globalThis) return globalThis;

    for (let i in globals) {
      this[i] = globals[i];
    }
  }

}

function sandboxFunction(context) {
  return SandboxFunction;

  function SandboxFunction(...params) {
    let code = params.pop();
    let parsed = Sandbox.parse(code);
    return function (...args) {
      const vars = {};

      for (let i of params) {
        vars[i] = args.shift();
      }

      const res = context.sandbox.executeTree(parsed);

      if (context.options.audit) {
        for (let key in res.auditReport.globalsAccess) {
          let add = res.auditReport.globalsAccess[key];
          context.auditReport.globalsAccess[key] = context.auditReport.globalsAccess[key] || new Set();
          add.forEach(val => {
            context.auditReport.globalsAccess[key].add(val);
          });
        }

        for (let Class in res.auditReport.prototypeAccess) {
          let add = res.auditReport.prototypeAccess[Class];
          context.auditReport.prototypeAccess[Class] = context.auditReport.prototypeAccess[Class] || new Set();
          add.forEach(val => {
            context.auditReport.prototypeAccess[Class].add(val);
          });
        }
      }

      return res.result;
    };
  }
}

function sandboxedEval(func) {
  return sandboxEval;

  function sandboxEval(code) {
    return func(code)();
  }
}

function sandboxedSetTimeout(func) {
  return function sandboxSetTimeout(handler, ...args) {
    if (typeof handler !== 'string') return setTimeout(handler, ...args);
    return setTimeout(func(handler), args[0]);
  };
}

function sandboxedSetInterval(func) {
  return function sandboxSetInterval(handler, ...args) {
    if (typeof handler !== 'string') return setInterval(handler, ...args);
    return setTimeout(func(handler), args[0]);
  };
}

let expectTypes = {
  op: {
    types: {
      op: /^(\/|\*\*(?!\=)|\*(?!\=)|\%(?!\=))/
    },
    next: ['value', 'prop', 'exp', 'modifier', 'incrementerBefore']
  },
  splitter: {
    types: {
      split: /^(&&|&|\|\||\||<=|>=|<|>|!==|!=|===|==| instanceof | in |\+(?!\+)|\-(?!\-))(?!\=)/
    },
    next: ['value', 'prop', 'exp', 'modifier', 'incrementerBefore']
  },
  if: {
    types: {
      if: /^\?/,
      else: /^:/
    },
    next: ['expEnd']
  },
  assignment: {
    types: {
      assignModify: /^(\-=|\+=|\/=|\*\*=|\*=|%=|\^=|\&=|\|=)/,
      assign: /^(=)/
    },
    next: ['value', 'function', 'prop', 'exp', 'modifier', 'incrementerBefore']
  },
  incrementerBefore: {
    types: {
      incrementerBefore: /^(\+\+|\-\-)/
    },
    next: ['prop']
  },
  incrementerAfter: {
    types: {
      incrementerAfter: /^(\+\+|\-\-)/
    },
    next: ['splitter', 'op', 'expEnd']
  },
  expEdge: {
    types: {
      call: /^[\(]/
    },
    next: ['splitter', 'op', 'expEdge', 'if', 'dot', 'expEnd']
  },
  modifier: {
    types: {
      not: /^!/,
      inverse: /^~/,
      negative: /^\-(?!\-)/,
      positive: /^\+(?!\+)/,
      typeof: /^ typeof /,
      delete: /^ delete /
    },
    next: ['exp', 'modifier', 'value', 'prop', 'incrementerBefore']
  },
  exp: {
    types: {
      createObject: /^\{/,
      createArray: /^\[/,
      group: /^\(/
    },
    next: ['splitter', 'op', 'expEdge', 'if', 'dot', 'expEnd']
  },
  dot: {
    types: {
      arrayProp: /^[\[]/,
      dot: /^\.(?!\.)/
    },
    next: ['splitter', 'incrementerAfter', 'assignment', 'op', 'expEdge', 'if', 'dot', 'expEnd']
  },
  prop: {
    types: {
      prop: /^[a-zA-Z\$_][a-zA-Z\d\$_]*/
    },
    next: ['splitter', 'incrementerAfter', 'assignment', 'op', 'expEdge', 'if', 'dot', 'expEnd']
  },
  value: {
    types: {
      number: /^\-?\d+(\.\d+)?/,
      string: /^"(\d+)"/,
      literal: /^`(\d+)`/,
      boolean: /^(true|false)(?![\w$_])/,
      null: /^null(?![\w$_])/,
      und: /^undefined(?![\w$_])/,
      NaN: /^NaN(?![\w$_])/,
      Infinity: /^Infinity(?![\w$_])/
    },
    next: ['splitter', 'op', 'if', 'dot', 'expEnd']
  },
  function: {
    types: {
      arrowFunc: /^\(?(((\.\.\.)?[a-zA-Z\$_][a-zA-Z\d\$_]*,?)*)(\))?=>({)?/
    },
    next: ['expEnd']
  },
  initialize: {
    types: {
      initialize: /^ (var|let|const) [a-zA-Z\$_][a-zA-Z\d\$_]*/
    },
    next: ['value', 'function', 'prop', 'exp', 'modifier', 'incrementerBefore', 'expEnd']
  },
  spreadObject: {
    types: {
      spreadObject: /^\.\.\./
    },
    next: ['value', 'exp', 'prop']
  },
  spreadArray: {
    types: {
      spreadArray: /^\.\.\./
    },
    next: ['value', 'exp', 'prop']
  },
  expEnd: {
    types: {},
    next: []
  },
  expStart: {
    types: {
      return: /^ return /
    },
    next: ['value', 'function', 'prop', 'exp', 'modifier', 'incrementerBefore', 'expEnd']
  }
};
let closings = {
  "(": ")",
  "[": "]",
  "{": "}",
  "'": "'",
  '"': '"',
  "`": "`"
};
let closingsRegex = {
  "(": /^\)/,
  "[": /^\]/,
  "{": /^\}/,
  "'": /^\'/,
  '"': /^\"/,
  "`": /^\`/
};
const okFirstChars = /^[\+\-~ !]/;

const restOfExp = (part, tests, quote) => {
  let isStart = true;
  tests = tests || [expectTypes.op.types.op, expectTypes.splitter.types.split, expectTypes.if.types.if, expectTypes.if.types.else];
  let escape = false;
  let done = false;
  let i;

  for (i = 0; i < part.length && !done; i++) {
    let char = part[i];

    if (quote === '"' || quote === "'" || quote === "`") {
      if (quote === "`" && char === "$" && part[i + 1] === "{" && !escape) {
        let skip = restOfExp(part.substring(i + 2), [closingsRegex['{']]);
        i += skip.length + 2;
      } else if (char === quote && !escape) {
        return part.substring(0, i);
      }

      escape = char === "\\";
    } else if (closings[char]) {
      let skip = restOfExp(part.substring(i + 1), [closingsRegex[quote]], char);
      i += skip.length + 1;
      isStart = false;
    } else if (!quote) {
      let sub = part.substring(i);

      for (let test of tests) {
        done = test.test(sub);
        if (done) break;
      }

      if (isStart) {
        if (okFirstChars.test(sub)) {
          done = false;
        } else {
          isStart = false;
        }
      }

      if (done) break;
    } else if (char === closings[quote]) {
      return part.substring(0, i);
    }
  }

  return part.substring(0, i);
};

restOfExp.next = ['splitter', 'op', 'expEnd', 'if'];

function assignCheck(obj, context, op = 'assign') {
  var _a, _b, _c, _d;

  if (obj.context === undefined) {
    throw new ReferenceError(`Cannot ${op} value to undefined.`);
  }

  if (typeof obj.context !== 'object' && typeof obj.context !== 'function') {
    throw new SyntaxError(`Cannot ${op} value to a primitive.`);
  }

  if (obj.isConst) {
    throw new TypeError(`Cannot set value to const variable '${obj.prop}'`);
  }

  if (obj.isGlobal) {
    throw new SandboxError(`Cannot ${op} property '${obj.prop}' of a global object`);
  }

  if (typeof obj.context[obj.prop] === 'function' && !obj.context.hasOwnProperty(obj.prop)) {
    throw new SandboxError(`Override prototype property '${obj.prop}' not allowed`);
  }

  if (op === "delete") {
    if (obj.context.hasOwnProperty(obj.prop)) {
      (_a = context.changeSubscriptions.get(obj.context)) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb({
        type: "delete",
        prop: obj.prop
      }));
    }
  } else if (obj.context.hasOwnProperty(obj.prop)) {
    (_c = (_b = context.setSubscriptions.get(obj.context)) === null || _b === void 0 ? void 0 : _b.get(obj.prop)) === null || _c === void 0 ? void 0 : _c.forEach(cb => cb({
      type: "replace"
    }));
  } else {
    (_d = context.changeSubscriptions.get(obj.context)) === null || _d === void 0 ? void 0 : _d.forEach(cb => cb({
      type: "create",
      prop: obj.prop
    }));
  }
}

const arrayChange = new Set([[].push, [].pop, [].shift, [].unshift, [].splice, [].reverse, [].sort, [].copyWithin]);
let ops2 = {
  'prop': (a, b, obj, context, scope) => {
    if (a === null) {
      throw new TypeError(`Cannot get property ${b} of null`);
    }

    const type = typeof a;

    if (type === 'undefined') {
      let prop = scope.get(b);
      if (prop.context === undefined) throw new ReferenceError(`${b} is not defined`);

      if (prop.context === context.sandboxGlobal) {
        if (context.options.audit) {
          context.auditReport.globalsAccess.add(b);
        }

        const rep = context.evals.get(context.sandboxGlobal[b]);
        if (rep) return rep;
      }

      if (prop.context && prop.context[b] === globalThis) {
        return context.globalScope.get('this');
      }

      context.getSubscriptions.forEach(cb => cb(prop.context, prop.prop));
      return prop;
    }

    if (type !== 'object') {
      if (type === 'number') {
        a = new Number(a);
      } else if (type === 'string') {
        a = new String(a);
      } else if (type === 'boolean') {
        a = new Boolean(a);
      }
    } else if (typeof a.hasOwnProperty === 'undefined') {
      return new Prop(undefined, b);
    }

    const isFunction = type === 'function';
    let prototypeAccess = isFunction || !(a.hasOwnProperty(b) || typeof b === 'number');

    if (context.options.audit && prototypeAccess) {
      if (typeof b === 'string') {
        let prot = a.constructor.prototype;

        do {
          if (prot.hasOwnProperty(b)) {
            if (!context.auditReport.prototypeAccess[prot.constructor.name]) {
              context.auditReport.prototypeAccess[prot.constructor.name] = new Set();
            }

            context.auditReport.prototypeAccess[prot.constructor.name].add(b);
          }
        } while (prot = Object.getPrototypeOf(prot));
      }
    }

    if (prototypeAccess) {
      if (isFunction) {
        if (!['name', 'length', 'constructor'].includes(b) && a.hasOwnProperty(b)) {
          const whitelist = context.prototypeWhitelist.get(a);
          const replace = context.prototypeReplacements.get(a);

          if (replace) {
            return new Prop(replace(a, true), b);
          }

          if (whitelist && (!whitelist.size || whitelist.has(b))) ; else {
            throw new SandboxError(`Static method or property access not permitted: ${a.name}.${b}`);
          }
        }
      } else if (b !== 'constructor') {
        let prot = a.constructor.prototype;

        do {
          if (prot.hasOwnProperty(b)) {
            const whitelist = context.prototypeWhitelist.get(prot.constructor);
            const replace = context.prototypeReplacements.get(prot.constuctor);

            if (replace) {
              return new Prop(replace(a, false), b);
            }

            if (whitelist && (!whitelist.size || whitelist.has(b))) {
              break;
            }

            throw new SandboxError(`Method or property access not permitted: ${prot.constructor.name}.${b}`);
          }
        } while (prot = Object.getPrototypeOf(prot));
      }
    }

    const rep = context.evals.get(a[b]);
    if (rep) return rep;

    if (a[b] === globalThis) {
      return context.globalScope.get('this');
    }

    let g = obj.isGlobal || isFunction && a.name !== 'sandboxArrowFunction' || context.globalsWhitelist.has(a);

    if (!g) {
      context.getSubscriptions.forEach(cb => cb(a, b));
    }

    return new Prop(a, b, false, g);
  },
  'call': (a, b, obj, context, scope) => {
    var _a;

    if (context.options.forbidMethodCalls) throw new SandboxError("Method calls are not allowed");

    if (typeof a !== 'function') {
      throw new TypeError(`${obj.prop} is not a function`);
    }

    const args = b.map(item => {
      if (item instanceof SpreadArray) {
        return [...item.item];
      } else {
        return [item];
      }
    }).flat();

    if (typeof obj === 'function') {
      return obj(...args.map(item => exec(item, scope, context)));
    }

    const vals = args.map(item => exec(item, scope, context));

    if (obj.context[obj.prop] === JSON.stringify && context.getSubscriptions.size) {
      const cache = new Set();

      const recurse = x => {
        if (!x || !(typeof x === 'object') || cache.has(x)) return;
        cache.add(x);

        for (let y in x) {
          context.getSubscriptions.forEach(cb => cb(x, y));
          recurse(x[y]);
        }
      };

      recurse(vals[0]);
    }

    if (obj.context instanceof Array && arrayChange.has(obj.context[obj.prop]) && context.changeSubscriptions.get(obj.context)) {
      let change;
      let changed = false;

      if (obj.prop === "push") {
        change = {
          type: "push",
          added: vals
        };
        changed = !!vals.length;
      } else if (obj.prop === "pop") {
        change = {
          type: "pop",
          removed: obj.context.slice(-1)
        };
        changed = !!change.removed.length;
      } else if (obj.prop === "shift") {
        change = {
          type: "shift",
          removed: obj.context.slice(0, 1)
        };
        changed = !!change.removed.length;
      } else if (obj.prop === "unshift") {
        change = {
          type: "unshift",
          added: vals
        };
        changed = !!vals.length;
      } else if (obj.prop === "splice") {
        change = {
          type: "splice",
          startIndex: vals[0],
          deleteCount: vals[1] === undefined ? obj.context.length : vals[1],
          added: vals.slice(2),
          removed: obj.context.slice(vals[0], vals[1] === undefined ? undefined : vals[0] + vals[1])
        };
        changed = !!change.added.length || !!change.removed.length;
      } else if (obj.prop === "reverse" || obj.prop === "sort") {
        change = {
          type: obj.prop
        };
        changed = !!obj.context.length;
      } else if (obj.prop === "copyWithin") {
        let len = vals[2] === undefined ? obj.context.length - vals[1] : Math.min(obj.context.length, vals[2] - vals[1]);
        change = {
          type: "copyWithin",
          startIndex: vals[0],
          endIndex: vals[0] + len,
          added: obj.context.slice(vals[1], vals[1] + len),
          removed: obj.context.slice(vals[0], vals[0] + len)
        };
        changed = !!change.added.length || !!change.removed.length;
      }

      if (changed) {
        (_a = context.changeSubscriptions.get(obj.context)) === null || _a === void 0 ? void 0 : _a.forEach(cb => cb(change));
      }

      return obj.context[obj.prop](...vals);
    }

    return obj.context[obj.prop](...args.map(item => exec(item, scope, context)));
  },
  'createObject': (a, b, obj, context, scope) => {
    let res = {};

    for (let item of b) {
      if (item instanceof SpreadObject) {
        res = { ...res,
          ...item.item
        };
      } else if (item instanceof ObjectFunc) {
        let f = item;

        res[f.key] = function (...args) {
          const vars = {};
          f.args.forEach((arg, i) => {
            vars[arg] = args[i];
          });
          return context.sandbox.executeTree({
            tree: f.tree,
            strings: context.strings,
            literals: context.literals
          }, [new Scope(scope, vars, this)]).result;
        };
      } else {
        res[item.key] = item.val;
      }
    }

    return res;
  },
  'keyVal': (a, b) => new KeyVal(a, b),
  'createArray': (a, b, obj, context, scope) => {
    return b.map(item => {
      if (item instanceof SpreadArray) {
        return [...item.item];
      } else {
        return [item];
      }
    }).flat().map(item => exec(item, scope, context));
  },
  'group': (a, b) => b,
  'string': (a, b, obj, context) => context.strings[b],
  'literal': (a, b, obj, context, scope) => {
    let name = context.literals[b].a;
    return name.replace(/(\$\$)*(\$)?\${(\d+)}/g, (match, $$, $, num) => {
      if ($) return match;
      let res = exec(context.literals[b].b[parseInt(num, 10)], scope, context);
      res = res instanceof Prop ? res.context[res.prop] : res;
      return ($$ ? $$ : '') + `${res}`.replace(/\$/g, '$$');
    }).replace(/\$\$/g, '$');
  },
  'spreadArray': (a, b, obj, context, scope) => {
    return new SpreadArray(exec(b, scope, context));
  },
  'spreadObject': (a, b, obj, context, scope) => {
    return new SpreadObject(exec(b, scope, context));
  },
  '!': (a, b) => !b,
  '~': (a, b) => ~b,
  '++$': (a, b, obj, context) => {
    assignCheck(obj, context);
    return ++obj.context[obj.prop];
  },
  '$++': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop]++;
  },
  '--$': (a, b, obj, context) => {
    assignCheck(obj, context);
    return --obj.context[obj.prop];
  },
  '$--': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop]--;
  },
  '=': (a, b, obj, context) => {
    assignCheck(obj, context);
    obj.context[obj.prop] = b;
    return new Prop(obj.context, obj.prop, false, obj.isGlobal);
  },
  '+=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] += b;
  },
  '-=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] -= b;
  },
  '/=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] /= b;
  },
  '*=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] *= b;
  },
  '**=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] **= b;
  },
  '%=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] %= b;
  },
  '^=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] ^= b;
  },
  '&=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] &= b;
  },
  '|=': (a, b, obj, context) => {
    assignCheck(obj, context);
    return obj.context[obj.prop] |= b;
  },
  '?': (a, b) => {
    if (!(b instanceof If)) {
      throw new SyntaxError('Invalid inline if');
    }

    return a ? b.t : b.f;
  },
  '>': (a, b) => a > b,
  '<': (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
  '==': (a, b) => a == b,
  '===': (a, b) => a === b,
  '!=': (a, b) => a != b,
  '!==': (a, b) => a !== b,
  '&&': (a, b) => a && b,
  '||': (a, b) => a || b,
  '&': (a, b) => a & b,
  '|': (a, b) => a | b,
  ':': (a, b) => new If(a, b),
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '$+': (a, b) => +b,
  '$-': (a, b) => -b,
  '/': (a, b) => a / b,
  '*': (a, b) => a * b,
  '%': (a, b) => a % b,
  ' typeof ': (a, b) => typeof b,
  ' instanceof ': (a, b) => a instanceof b,
  ' in ': (a, b) => a in b,
  ' delete ': (a, b, obj, context, scope, bobj) => {
    if (bobj.context === undefined) {
      return true;
    }

    assignCheck(bobj, context, 'delete');
    if (bobj.isVariable) return false;
    return delete bobj.context[bobj.prop];
  },
  'return': (a, b) => b,
  'var': (a, b, obj, context, scope, bobj) => {
    return scope.declare(a, VarType.var, exec(b, scope, context));
  },
  'let': (a, b, obj, context, scope, bobj) => {
    return scope.declare(a, VarType.let, exec(b, scope, context), bobj && bobj.isGlobal);
  },
  'const': (a, b, obj, context, scope, bobj) => {
    return scope.declare(a, VarType.const, exec(b, scope, context));
  },
  'arrowFunc': (a, b, obj, context, scope) => {
    const sandboxArrowFunction = (...args) => {
      const vars = {};
      a.forEach((arg, i) => {
        if (arg.startsWith('...')) {
          vars[arg.substring(3)] = args.slice(i);
        } else {
          vars[arg] = args[i];
        }
      });
      return context.sandbox.executeTree({
        tree: b,
        strings: context.strings,
        literals: context.literals
      }, [new Scope(scope, vars)]).result;
    };

    return sandboxArrowFunction;
  }
};
let ops = new Map();

for (let op in ops2) {
  ops.set(op, ops2[op]);
}

let lispTypes = new Map();

const setLispType = (types, fn) => {
  types.forEach(type => {
    lispTypes.set(type, fn);
  });
};

const closingsCreate = {
  'createArray': /^\]/,
  'createObject': /^\}/,
  'group': /^\)/,
  'arrayProp': /^\]/,
  'call': /^\)/
};
setLispType(['createArray', 'createObject', 'group', 'arrayProp', 'call'], (type, part, res, expect, ctx) => {
  let extract = "";
  let arg = [];
  let end = false;
  let i = 1;

  while (i < part.length && !end) {
    extract = restOfExp(part.substring(i), [closingsCreate[type], /^,/]);
    i += extract.length;

    if (extract) {
      arg.push(extract);
    }

    if (part[i] !== ',') {
      end = true;
    } else {
      i++;
    }
  }

  const next = ['value', 'function', 'prop', 'exp', 'modifier', 'incrementerBefore'];
  let l;
  let fFound;
  const reg2 = /^([a-zA-Z\$_][a-zA-Z\d\$_]*)\((([a-zA-Z\$_][a-zA-Z\d\$_]*,?)*)\)?{/;

  switch (type) {
    case 'group':
    case 'arrayProp':
      l = lispify(arg.pop());
      break;

    case 'call':
    case 'createArray':
      l = arg.map(e => lispify(e, [...next, 'spreadArray']));
      break;

    case 'createObject':
      l = arg.map(str => {
        let value;
        let key;
        fFound = reg2.exec(str);

        if (fFound) {
          let args = fFound[2] ? fFound[2].split(",") : [];
          const func = restOfExp(str.substring(fFound.index + fFound[0].length), [/^}/]);
          return new ObjectFunc(fFound[1], args, Sandbox.parse(func, null).tree);
        } else {
          let extract = restOfExp(str, [/^:/]);
          key = lispify(extract, [...next, 'spreadObject']);

          if (key instanceof Lisp && key.op === 'prop') {
            key = key.b;
          }

          if (extract.length === str.length) return key;
          value = lispify(str.substring(extract.length + 1));
        }

        return new Lisp({
          op: 'keyVal',
          a: key,
          b: value
        });
      });
      break;
  }

  type = type === 'arrayProp' ? 'prop' : type;
  ctx.lispTree = lispify(part.substring(i + 1), expectTypes[expect].next, new Lisp({
    op: type,
    a: ctx.lispTree,
    b: l
  }));
});
setLispType(['inverse', 'not', 'negative', 'positive', 'typeof', 'delete', 'op'], (type, part, res, expect, ctx) => {
  let extract = restOfExp(part.substring(res[0].length));
  ctx.lispTree = lispify(part.substring(extract.length + res[0].length), restOfExp.next, new Lisp({
    op: ['positive', 'negative'].includes(type) ? '$' + res[0] : res[0],
    a: ctx.lispTree,
    b: lispify(extract, expectTypes[expect].next)
  }));
});
setLispType(['incrementerBefore'], (type, part, res, expect, ctx) => {
  let extract = restOfExp(part.substring(2));
  ctx.lispTree = lispify(part.substring(extract.length + 2), restOfExp.next, new Lisp({
    op: res[0] + "$",
    a: lispify(extract, expectTypes[expect].next)
  }));
});
setLispType(['incrementerAfter'], (type, part, res, expect, ctx) => {
  ctx.lispTree = lispify(part.substring(res[0].length), expectTypes[expect].next, new Lisp({
    op: "$" + res[0],
    a: ctx.lispTree
  }));
});
setLispType(['assign', 'assignModify'], (type, part, res, expect, ctx) => {
  ctx.lispTree = new Lisp({
    op: res[0],
    a: ctx.lispTree,
    b: lispify(part.substring(res[0].length), expectTypes[expect].next)
  });
});
setLispType(['split'], (type, part, res, expect, ctx) => {
  let extract = restOfExp(part.substring(res[0].length), [expectTypes.splitter.types.split, expectTypes.if.types.if, expectTypes.if.types.else]);
  ctx.lispTree = lispify(part.substring(extract.length + res[0].length), restOfExp.next, new Lisp({
    op: res[0],
    a: ctx.lispTree,
    b: lispify(extract, expectTypes[expect].next)
  }));
});
setLispType(['if'], (type, part, res, expect, ctx) => {
  let found = false;
  let extract = "";
  let quoteCount = 1;

  while (!found && extract.length < part.length) {
    extract += restOfExp(part.substring(extract.length + 1), [expectTypes.if.types.if, expectTypes.if.types.else]);

    if (part[extract.length + 1] === '?') {
      quoteCount++;
    } else {
      quoteCount--;
    }

    if (!quoteCount) {
      found = true;
    } else {
      extract += part[extract.length + 1];
    }
  }

  ctx.lispTree = new Lisp({
    op: '?',
    a: ctx.lispTree,
    b: new Lisp({
      op: ':',
      a: lispify(extract),
      b: lispify(part.substring(res[0].length + extract.length + 1))
    })
  });
});
setLispType(['dot', 'prop'], (type, part, res, expect, ctx) => {
  let prop = res[0];
  let index = res[0].length;

  if (res[0] === '.') {
    let matches = part.substring(res[0].length).match(expectTypes.prop.types.prop);

    if (matches.length) {
      prop = matches[0];
      index = prop.length + res[0].length;
    } else {
      throw Error('Hanging  dot:' + part);
    }
  }

  ctx.lispTree = lispify(part.substring(index), expectTypes[expect].next, new Lisp({
    op: 'prop',
    a: ctx.lispTree,
    b: prop
  }));
});
setLispType(['spreadArray', 'spreadObject', 'return'], (type, part, res, expect, ctx) => {
  ctx.lispTree = new Lisp({
    op: type,
    b: lispify(part.substring(res[0].length), expectTypes[expect].next)
  });
});
setLispType(['number', 'boolean', 'null'], (type, part, res, expect, ctx) => {
  ctx.lispTree = lispify(part.substring(res[0].length), expectTypes[expect].next, JSON.parse(res[0]));
});
const constants = {
  NaN,
  Infinity
};
setLispType(['und', 'NaN', 'Infinity'], (type, part, res, expect, ctx) => {
  ctx.lispTree = lispify(part.substring(res[0].length), expectTypes[expect].next, constants[type]);
});
setLispType(['string', 'literal'], (type, part, res, expect, ctx) => {
  ctx.lispTree = lispify(part.substring(res[0].length), expectTypes[expect].next, new Lisp({
    op: type,
    b: parseInt(JSON.parse(res[1]), 10)
  }));
});
setLispType(['initialize'], (type, part, res, expect, ctx) => {
  const split = res[0].split(/ /g);

  if (part.length === res[0].length) {
    ctx.lispTree = lispify(part.substring(res[0].length), expectTypes[expect].next, new Lisp({
      op: split[1],
      a: split[2]
    }));
  } else {
    ctx.lispTree = new Lisp({
      op: split[1],
      a: split[2],
      b: lispify(part.substring(res[0].length + 1), expectTypes[expect].next)
    });
  }
});
setLispType(['arrowFunc'], (type, part, res, expect, ctx) => {
  let args = res[1] ? res[1].split(",") : [];

  if (res[4]) {
    if (res[0][0] !== '(') throw new SyntaxError('Unstarted inline function brackets: ' + res[0]);
  } else if (args.length) {
    args = [args.pop()];
  }

  let ended = false;
  args.forEach(arg => {
    if (ended) throw new SyntaxError('Rest parameter must be last formal parameter');
    if (arg.startsWith('...')) ended = true;
  });
  const func = (res[5] ? '' : ' return ') + restOfExp(part.substring(res[0].length), res[5] ? [/^}/] : [/^[,;\)\}\]]/]);
  ctx.lispTree = lispify(part.substring(res[0].length + func.length + 1), expectTypes[expect].next, new Lisp({
    op: 'arrowFunc',
    a: args,
    b: Sandbox.parse(func, null).tree
  }));
});
let lastType;

function lispify(part, expected, lispTree) {
  expected = expected || ['initialize', 'expStart', 'value', 'function', 'prop', 'exp', 'modifier', 'incrementerBefore', 'expEnd'];
  if (part === undefined) return lispTree;

  if (!part.length && !expected.includes('expEnd')) {
    throw new SyntaxError("Unexpected end of expression");
  }

  let ctx = {
    lispTree: lispTree
  };
  let res;

  for (let expect of expected) {
    if (expect === 'expEnd') {
      continue;
    }

    for (let type in expectTypes[expect].types) {
      if (type === 'expEnd') {
        continue;
      }

      if (res = expectTypes[expect].types[type].exec(part)) {
        lastType = type;
        lispTypes.get(type)(type, part, res, expect, ctx);
        break;
      }
    }

    if (res) break;
  }

  if (!res && part.length) {
    throw Error(`Unexpected token (${lastType}): ${part}`);
  }

  return ctx.lispTree;
}

function exec(tree, scope, context) {
  if (tree instanceof Prop) {
    return tree.context[tree.prop];
  }

  if (Array.isArray(tree)) {
    return tree.map(item => exec(item, scope, context));
  }

  if (!(tree instanceof Lisp)) {
    return tree;
  }

  if (tree.op === 'arrowFunc') {
    return ops.get(tree.op)(tree.a, tree.b, undefined, context, scope);
  }

  let obj = exec(tree.a, scope, context);
  let a = obj instanceof Prop ? obj.context ? obj.context[obj.prop] : undefined : obj;
  let bobj = exec(tree.b, scope, context);
  let b = bobj instanceof Prop ? bobj.context ? bobj.context[bobj.prop] : undefined : bobj;

  if (ops.has(tree.op)) {
    let res = ops.get(tree.op)(a, b, obj, context, scope, bobj);
    return res;
  }

  throw new SyntaxError('Unknown operator: ' + tree.op);
}

class Sandbox {
  constructor(globals = Sandbox.SAFE_GLOBALS, prototypeWhitelist = Sandbox.SAFE_PROTOTYPES, prototypeReplacements = new Map(), options = {
    audit: false
  }) {
    const sandboxGlobal = new SandboxGlobal(globals);
    this.context = {
      sandbox: this,
      globals,
      prototypeWhitelist,
      prototypeReplacements,
      globalsWhitelist: new Set(Object.values(globals)),
      options,
      globalScope: new Scope(null, globals, sandboxGlobal),
      sandboxGlobal,
      evals: new Map(),
      getSubscriptions: new Set(),
      setSubscriptions: new WeakMap(),
      changeSubscriptions: new WeakMap()
    };
    const func = sandboxFunction(this.context);
    this.context.evals.set(Function, func);
    this.context.evals.set(eval, sandboxedEval(func));
    this.context.evals.set(setTimeout, sandboxedSetTimeout(func));
    this.context.evals.set(setInterval, sandboxedSetInterval(func));
  }

  static get SAFE_GLOBALS() {
    return {
      Function,
      console: {
        debug: console.debug,
        error: console.error,
        info: console.info,
        log: console.log,
        table: console.table,
        warn: console.warn
      },
      isFinite,
      isNaN,
      parseFloat,
      parseInt,
      decodeURI,
      decodeURIComponent,
      encodeURI,
      encodeURIComponent,
      escape,
      unescape,
      Boolean,
      Number,
      String,
      Object,
      Array,
      Symbol,
      Error,
      EvalError,
      RangeError,
      ReferenceError,
      SyntaxError,
      TypeError,
      URIError,
      Int8Array,
      Uint8Array,
      Uint8ClampedArray,
      Int16Array,
      Uint16Array,
      Int32Array,
      Uint32Array,
      Float32Array,
      Float64Array,
      Map,
      Set,
      WeakMap,
      WeakSet,
      Promise,
      Intl,
      JSON,
      Math
    };
  }

  static get SAFE_PROTOTYPES() {
    let protos = [SandboxGlobal, Function, Boolean, Number, String, Date, RegExp, Error, Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Map, Set, WeakMap, WeakSet, Promise];
    let map = new Map();
    protos.forEach(proto => {
      map.set(proto, new Set());
    });
    map.set(Object, new Set(['entries', 'fromEntries', 'getOwnPropertyNames', 'is', 'keys', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf', 'values']));
    return map;
  }

  subscribeGet(callback) {
    this.context.getSubscriptions.add(callback);
    return {
      unsubscribe: () => this.context.getSubscriptions.delete(callback)
    };
  }

  subscribeSet(obj, name, callback) {
    const names = this.context.setSubscriptions.get(obj) || new Map();
    this.context.setSubscriptions.set(obj, names);
    const callbacks = names.get(name) || new Set();
    names.set(name, callbacks);
    callbacks.add(callback);
    let changeCbs;

    if (obj && obj[name] && typeof obj[name] === "object") {
      changeCbs = this.context.changeSubscriptions.get(obj[name]) || new Set();
      changeCbs.add(callback);
      this.context.changeSubscriptions.set(obj[name], changeCbs);
    }

    return {
      unsubscribe: () => {
        callbacks.delete(callback);
        if (changeCbs) changeCbs.delete(callback);
      }
    };
  }

  static audit(code, scopes = []) {
    return new Sandbox(globalThis, new Map(), new Map(), {
      audit: true
    }).executeTree(Sandbox.parse(code), scopes);
  }

  static parse(code, strings = [], literals = []) {
    if (typeof code !== 'string') throw new ParseError(`Cannot parse ${code}`, code); // console.log('parse', str);

    let str = code;
    let quote;
    let extract = "";
    let escape = false;
    let js = [];
    let currJs = [];

    if (strings) {
      let extractSkip = 0;

      for (let i = 0; i < str.length; i++) {
        let char = str[i];

        if (escape) {
          if (char === "$" && quote === '`') {
            extractSkip--;
            char = '$$';
          } else if (char === 'u') {
            let reg = /^[a-fA-F\d]{2,4}/.exec(str.substring(i + 1));
            let num;

            if (!reg) {
              num = Array.from(/^{[a-fA-F\d]+}/.exec(str.substring(i + 1)) || [""]);
            } else {
              num = Array.from(reg);
            }

            char = JSON.parse(`"\\u${num[0]}"`);
            str = str.substring(0, i - 1) + char + str.substring(i + (1 + num[0].length));
            i -= 1;
          } else if (char != '`') {
            char = JSON.parse(`"\\${char}"`);
          }
        } else if (char === '$' && quote === '`' && str[i + 1] !== '{') {
          extractSkip--;
          char = '$$';
        }

        if (quote === "`" && char === "$" && str[i + 1] === "{") {
          let skip = restOfExp(str.substring(i + 2), [/^}/]);
          currJs.push(skip);
          extractSkip += skip.length + 3;
          extract += `\${${currJs.length - 1}}`;
          i += skip.length + 2;
        } else if (!quote && (char === "'" || char === '"' || char === '`') && !escape) {
          currJs = [];
          extractSkip = 0;
          quote = char;
        } else if (quote === char && !escape) {
          let len;

          if (quote === '`') {
            literals.push({
              op: 'literal',
              a: extract,
              b: currJs
            });
            js.push(currJs);
            str = str.substring(0, i - extractSkip - 1) + `\`${literals.length - 1}\`` + str.substring(i + 1);
            len = (literals.length - 1).toString().length;
          } else {
            strings.push(extract);
            str = str.substring(0, i - extract.length - 1) + `"${strings.length - 1}"` + str.substring(i + 1);
            len = (strings.length - 1).toString().length;
          }

          quote = null;
          i -= extract.length - len;
          extract = "";
        } else if (quote && !(!escape && char === "\\")) {
          extractSkip += escape ? 1 + char.length : char.length;
          extract += char;
        }

        escape = quote && !escape && char === "\\";
      }

      str = str.replace(/([^\w_$]|^)((var|let|const|typeof|return|instanceof|in|delete)(?=[^\w_$]|$))/g, (match, start, keyword) => {
        if (keyword.length !== keyword.trim().length) throw new Error(keyword);
        return `${start}#${keyword}#`;
      }).replace(/\s/g, "").replace(/#/g, " ");
      js.forEach(j => {
        const a = j.map(skip => this.parse(skip, strings, literals).tree[0]);
        j.length = 0;
        j.push(...a);
      });
    }

    let parts = [];
    let part;
    let pos = 0;

    while (part = restOfExp(str.substring(pos), [/^;/])) {
      parts.push(part);
      pos += part.length + 1;
    }

    parts = parts.filter(Boolean);
    const tree = parts.filter(str => str.length).map(str => {
      let subExpressions = [];
      let sub;
      let pos = 0;

      while (sub = restOfExp(str.substring(pos), [/^,/])) {
        subExpressions.push(sub);
        pos += sub.length + 1;
      }

      try {
        const exprs = subExpressions.map(str => lispify(str));

        if (exprs.length > 1 && exprs[0] instanceof Lisp && exprs[0].op === 'return') {
          const last = exprs.pop();
          return [exprs.shift().b, ...exprs, new Lisp({
            op: 'return',
            b: last
          })];
        }

        return exprs;
      } catch (e) {
        // throw e;
        throw new ParseError(e.message + ": " + str, str);
      }
    });
    return {
      tree: tree.flat(),
      strings,
      literals
    };
  }

  executeTree(executionTree, scopes = []) {
    const execTree = executionTree.tree;
    const contextb = { ...this.context,
      strings: executionTree.strings,
      literals: executionTree.literals
    };
    let scope = this.context.globalScope;
    let s;

    while (s = scopes.shift()) {
      if (typeof s !== "object") continue;

      if (s instanceof Scope) {
        scope = s;
      } else {
        scope = new Scope(scope, s);
      }
    }

    let context = Object.assign({}, contextb);

    if (contextb.options.audit) {
      context.auditReport = {
        globalsAccess: new Set(),
        prototypeAccess: {}
      };
    }

    let returned = false;
    let res;
    if (!(execTree instanceof Array)) throw new SyntaxError('Bad execution tree');
    execTree.map(tree => {
      if (!returned) {
        let r;

        try {
          r = exec(tree, scope, context);
        } catch (e) {
          throw new e.constructor(e.message);
        }

        if (tree instanceof Lisp && tree.op === 'return') {
          returned = true;
          res = r;
        }
      }

      return null;
    });
    res = res instanceof Prop ? res.context[res.prop] : res;
    return {
      auditReport: context.auditReport,
      result: res
    };
  }

  compile(code) {
    const executionTree = Sandbox.parse(code);
    return (...scopes) => {
      return this.executeTree(executionTree, scopes).result;
    };
  }

}

var defaultHTMLWhiteList = [HTMLBRElement, HTMLBodyElement, HTMLDListElement, HTMLDataElement, HTMLDataListElement, HTMLDialogElement, HTMLDivElement, HTMLFieldSetElement, HTMLFormElement, HTMLHRElement, HTMLHeadingElement, HTMLLIElement, HTMLLegendElement, HTMLMapElement, HTMLMetaElement, HTMLMeterElement, HTMLModElement, HTMLOListElement, HTMLOutputElement, HTMLParagraphElement, HTMLPreElement, HTMLProgressElement, HTMLQuoteElement, HTMLSpanElement, HTMLTableCaptionElement, HTMLTableCellElement, HTMLTableColElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTimeElement, HTMLTitleElement, HTMLUListElement, HTMLUnknownElement, HTMLTemplateElement, HTMLCanvasElement, HTMLElement];
var globalAllowedAtttributes = new Set(['id', 'class', 'style', 'alt', 'role', 'aria-label', 'aria-labelledby', 'aria-hidden', 'tabindex', 'title', 'dir', 'lang', 'height', 'width']);
var types = new Map();

function sanitizeType(t, allowedAttributes, element) {
  var s = new Set(allowedAttributes);

  for (var type of t) {
    types.set(type, {
      attributes: s,
      element
    });
  }
}

sanitizeType(defaultHTMLWhiteList, [], () => {
  return true;
});
sanitizeType([HTMLAnchorElement, SVGAElement, HTMLAreaElement], ['href', 'xlink:href', 'rel', 'shape', 'coords'], el => {
  return true;
});
sanitizeType([], ['href'], el => {
  return true;
});
sanitizeType([HTMLButtonElement], ['type', 'value'], el => {
  if (el.type !== "reset" && el.type !== "button") {
    el.type = "button";
  }

  return true;
});
var allowedInputs = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'month', 'number', 'password', 'radio', 'range', 'reset', 'tel', 'text', 'time', 'url', 'week']);
sanitizeType([HTMLInputElement, HTMLSelectElement, HTMLOptGroupElement, HTMLOptionElement, HTMLLabelElement, HTMLTextAreaElement], ['value', 'type', 'checked', 'selected', 'name', 'for', 'max', 'min', 'placeholder', 'readonly', 'size', 'multiple', 'step', 'autocomplete', 'cols', 'rows', 'maxlength', 'disabled', 'required', 'accept', 'list'], el => {
  return true;
});
sanitizeType([HTMLScriptElement], ['type'], el => {
  if (!el.type || el.type === 'text/javascript') {
    el.type = 'scopejs';
  }

  return el.type === "scopejs";
});
sanitizeType([HTMLStyleElement], [], el => {
  return true;
});
sanitizeType([HTMLPictureElement, HTMLImageElement, HTMLAudioElement, HTMLTrackElement, HTMLVideoElement, HTMLSourceElement], ['src', 'srcset', 'sizes', 'poster', 'autoplay', 'contorls', 'muted', 'loop', 'volume', 'loading'], el => {
  return true;
});
var regHrefJS = /^\s*javascript:/i;
var regValidSrc = /^((https?:)?\/\/|\/|#)/;
var regSystemAtt = /^(:|@|\$|x\-)/;
var srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
function santizeAttribute(element, attName, attValue) {
  var preprocess = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var allowed = types.get(element.constructor);
  if (!allowed) return false;
  attName = attName.toLowerCase();

  if (attName.match(regSystemAtt)) {
    if (!preprocess) return false;
  } else if (attName.startsWith('on')) {
    if (preprocess) {
      element.setAttribute('@' + attName.slice(2), attValue);
    }

    return false;
  } else if (allowed.attributes.has(attName) && srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
    var isJs = attValue.match(regHrefJS);

    if (isJs) {
      if (preprocess && (attName === 'href' || attName === 'xlink:href')) {
        if (!element.hasAttribute('@click')) {
          element.setAttribute('@click', attValue.substring(isJs[0].length));
        }

        element.setAttribute(attName, 'javascript:void(0)');
      } else {
        return false;
      }
    } else if (!attValue.match(regValidSrc)) {
      return false;
    }
  } else if (!allowed.attributes.has(attName) && !globalAllowedAtttributes.has(attName)) {
    return false;
  } else if (element instanceof HTMLInputElement && attName == 'type') {
    return allowedInputs.has(attValue);
  } else if (element instanceof HTMLButtonElement && attName == 'type') {
    return attValue === 'reset' || attValue === 'button';
  }

  return true;
}
function sanitizeHTML(element) {
  var staticHtml = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  if (!(element instanceof DocumentFragment)) {
    var allowed = types.get(element.constructor);

    if (!allowed || !allowed.element(element) || staticHtml && (element instanceof HTMLStyleElement || element instanceof HTMLScriptElement)) {
      element.remove();
      return;
    } else {
      for (var att of [...element.attributes]) {
        var attValue = att.nodeValue;
        var attName = att.nodeName;

        if (!santizeAttribute(element, attName, attValue, !staticHtml) || staticHtml && ["id", "style"].includes(attName)) {
          element.removeAttribute(att.nodeName);
        }
      }
    }
  }

  if (element.children) {
    for (var el of [...element.children]) {
      sanitizeHTML(el, staticHtml);
    }
  }
}

var elementStorage = new WeakMap();
var arrs = new WeakMap();

function arr(coll) {
  return arrs.get(coll) || [];
}

var defaultDelegateObject = {
  on(elem, event, callback) {
    var $el = wrap(elem);
    $el.on(event, callback);
    return () => $el.off(event, callback);
  },

  one(elem, event, callback) {
    var $el = wrap(elem);
    $el.one(event, callback);
    return () => $el.off(event, callback);
  },

  off() {}

};
class ElementCollection {
  constructor(item) {
    for (var _len = arguments.length, items = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      items[_key - 1] = arguments[_key];
    }

    arrs.set(this, new Array(item, ...items));
  }

  get size() {
    return arr(this).length;
  }

  get $elements() {
    return [...arr(this)];
  }

  [Symbol.iterator]() {
    return arr(this)[Symbol.iterator]();
  }

  forEach(cb) {
    arr(this).forEach(cb);
  }

  map(cb) {
    return arr(this).map(cb);
  }

  filter(selector) {
    return filter(this, selector);
  }

  some(cb) {
    return arr(this).some(cb);
  }

  every(cb) {
    return arr(this).every(cb);
  }

  slice(start, end) {
    return new ElementCollection(...arr(this).slice(start, end));
  }

  sort(callback) {
    if (!callback) {
      arr(this).sort((a, b) => {
        if (a === b) return 0;

        if (a.compareDocumentPosition(b) & 2) {
          return 1;
        }

        return -1;
      });
    } else {
      arr(this).sort(callback);
    }

    return this;
  }

  reverse() {
    arr(this).reverse();
    return this;
  }

  unique() {
    return from(this.toSet());
  }

  toArray() {
    return this.$elements;
  }

  toSet() {
    var res = new Set();
    this.forEach(elem => res.add(elem));
    return res;
  }

  is(selector) {
    if (typeof selector === 'string') {
      return this.some(elem => elem.matches(selector));
    }

    var sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
    return this.some(elem => sel.has(elem));
  }

  not(selector) {
    if (typeof selector === 'string') {
      return filter(this, (elem, i) => !elem.matches(selector));
    }

    var sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
    return filter(this, (elem, i) => !sel.has(elem));
  }

  has(selector) {
    if (typeof selector === 'string') {
      var cache = new Set();
      return filter(this, elem => {
        if (cache.has(elem)) {
          return true;
        }

        var found = [...elem.querySelectorAll(':scope ' + selector)];
        found = found.concat(arr(parents(found)));
        found.forEach(e => cache.add(e));
        return found.length;
      });
    }

    var sel = selector instanceof ElementCollection ? selector : wrap(selector);
    return filter(this, (elem, i) => sel.some(test => elem !== test && elem.contains(test)));
  }

  find(selector) {
    if (typeof selector === 'function') {
      return new ElementCollection(arr(this).find((a, b, c) => selector(a, b)));
    }

    return wrap(selector, this);
  }

  on(events, callback, options) {
    var cb = typeof callback === 'function' ? callback : undefined;
    var opt = typeof callback === 'function' ? options : callback;
    objectOrProp(events, cb, (ev, handler) => {
      var h = e => handler(wrapEvent(e));

      this.forEach(elem => {
        var store = getStore(elem, 'events', new Map());
        var evStore = store.get(ev) || new Map();
        evStore.set(handler, h);
        store.set(ev, evStore);
        elem.addEventListener(ev, h, opt);
      });
    });
    return this;
  }

  off(events, callback) {
    if (!events) {
      this.forEach(elem => {
        var store = getStore(elem, 'events', new Map());
        store.forEach((evStore, ev) => {
          evStore.forEach(h => {
            elem.removeEventListener(ev, h);
          });
          evStore.clear();
        });
        store.clear();
      });
    } else {
      objectOrProp(events, callback || false, (ev, handler) => {
        this.forEach(elem => {
          var store = getStore(elem, 'events', new Map());
          var evStore = store.get(ev) || new Map();

          if (handler) {
            var h = evStore.get(handler);
            if (!h) return;
            elem.removeEventListener(ev, h);
            evStore.delete(handler);
          } else {
            evStore.forEach(h => {
              elem.removeEventListener(ev, h);
            });
            evStore.clear();
          }
        });
      });
    }

    return this;
  }

  trigger(eventType) {
    var detail = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;
    var bubbles = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var cancelable = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var event = new CustomEvent(eventType, {
      bubbles,
      cancelable,
      detail
    });
    this.forEach(elem => {
      elem.dispatchEvent(event);
    });
    return this;
  }

  one(events, callback, options) {
    var cb = typeof callback === 'function' ? callback : undefined;
    var opt = typeof callback === 'function' ? options : callback;
    objectOrProp(events, cb, (ev, handler) => {
      this.forEach(elem => {
        var $el = wrap(elem);

        var evcb = evt => {
          $el.off(ev, evcb);
          handler(evt);
        };

        $el.on(ev, evcb, opt);
      });
    });
    return this;
  }

  delegate() {
    var that = arr(this)[0];
    var del = getStore(that, 'delegate');
    if (del) return del;
    var events = new WeakMap();
    var all = [];
    var once = new Set();
    var started = new Map();
    if (!that) return defaultDelegateObject;
    del = {
      on(elem, ev, handler) {
        var evs = events.get(elem) || new Map();
        events.set(elem, evs);
        var subs = [];
        objectOrProp(ev, handler || false, (event, callback) => {
          var cbs = evs.get(event);

          if (!cbs) {
            cbs = new Set();
            all.push(cbs);
            evs.set(event, cbs);
          }

          cbs.add(callback);

          if (!started.has(event)) {
            var evcb = e => {
              var parent = e.target;
              var listeners = [];

              do {
                var _events$get;

                var lts = void 0;

                if (lts = (_events$get = events.get(parent)) === null || _events$get === void 0 ? void 0 : _events$get.get(event)) {
                  listeners.push(lts);
                }
              } while (parent != that && (parent = parent.parentElement));

              var eq = wrapEvent(e);
              listeners.forEach((handlers, i) => {
                if (eq.stoppedPropagation) return;
                handlers.forEach(handler => {
                  if (eq.stoppedImmediatePropagation) return;
                  handler(eq);
                });
              });
            };

            var remove = () => {
              started.delete(event);
              that.removeEventListener(event, evcb);
            };

            that.addEventListener(event, evcb, true);
            started.set(event, remove);
          }

          subs.push(() => {
            var _events$get2, _events$get2$get, _events$get3;

            (_events$get2 = events.get(elem)) === null || _events$get2 === void 0 ? void 0 : (_events$get2$get = _events$get2.get(event)) === null || _events$get2$get === void 0 ? void 0 : _events$get2$get.delete(callback);

            if (((_events$get3 = events.get(elem)) === null || _events$get3 === void 0 ? void 0 : _events$get3.get(event).size) === 0) {
              var _events$get4;

              (_events$get4 = events.get(elem)) === null || _events$get4 === void 0 ? void 0 : _events$get4.delete(event);
            }
          });
        });
        return () => subs.forEach(sub => sub());
      },

      one(elem, event, callback) {
        var cbev = e => {
          if (once.has(cbev)) {
            var _events$get5, _events$get5$get, _events$get6;

            once.delete(callback);
            (_events$get5 = events.get(elem)) === null || _events$get5 === void 0 ? void 0 : (_events$get5$get = _events$get5.get(event)) === null || _events$get5$get === void 0 ? void 0 : _events$get5$get.delete(callback);

            if (((_events$get6 = events.get(elem)) === null || _events$get6 === void 0 ? void 0 : _events$get6.get(event).size) === 0) {
              var _events$get7;

              (_events$get7 = events.get(elem)) === null || _events$get7 === void 0 ? void 0 : _events$get7.delete(event);
            }
          }

          callback(e);
        };

        once.add(cbev);
        return this.on(elem, events, cbev);
      },

      off() {
        started.forEach(off => off());
        started.clear();
        once.clear();
        all.forEach(cbs => cbs.clear());
        all.length = 0;
      }

    };
    getStore(that, 'delegate', del);
    return del;
  }

  click(callback, options) {
    if (typeof callback === 'undefined') {
      return this.trigger('click', 1);
    }

    this.on('click', callback, options).not('a[href], button, input, select, textarea').once('eqAllyClick').addClass('eq-ally-click').on('keydown', e => {
      if (e.keyCode === 13 && e.currentTarget instanceof HTMLElement && e.currentTarget.getAttribute('aria-disabled') !== 'true') {
        e.currentTarget.click();
      }
    }).attr({
      tabindex: 0,
      role: 'button'
    });
    return this;
  }

  hover(handlerIn, handlerOut) {
    return this.on('mouseenter', handlerIn).on('mouseleave', handlerOut);
  }

  attr(key, set) {
    if (objectOrProp(key, set, (k, v) => {
      this.forEach(elem => {
        if (santizeAttribute(elem, k, v + "")) {
          elem.setAttribute(k, v + "");
        } else {
          throw new Error("Illegal attribute [" + k + "] value for <" + elem.nodeName.toLowerCase() + ">: " + v);
        }
      });
    })) return this;
    return arr(this)[0] && typeof key === 'string' ? arr(this)[0].getAttribute(key) : null;
  }

  removeAttr(key) {
    this.forEach(elem => {
      elem.removeAttribute(key);
    });
    return this;
  }

  val(set) {
    if (typeof set !== 'undefined') {
      this.forEach(elem => {
        if (elem instanceof HTMLInputElement) {
          if (elem.type === "checkbox" || elem.type === "radio") {
            if (set === elem.value || set === true) {
              elem.setAttribute('checked', 'checked');
            } else {
              elem.removeAttribute('checked');
            }
          } else if (elem.type !== 'file' || !set) {
            elem.value = set + "";
          }
        } else if (elem instanceof HTMLSelectElement) {
          var values = set instanceof Array ? set : [set];
          [...elem.options].forEach(opt => {
            opt.selected = values.includes(opt.value);
          });
        } else {
          elem.value = set + "";
        }

        if (elem instanceof HTMLTextAreaElement || elem instanceof HTMLInputElement && (!elem.type || elem.type === 'text' || elem.type === 'tel')) {
          new ElementCollection(elem).trigger('input');
        } else {
          new ElementCollection(elem).trigger('change');
        }
      });
      return set;
    }

    var elem = arr(this)[0];
    if (!elem) return;

    if (elem instanceof HTMLInputElement) {
      if (elem.type === "checkbox") {
        return elem.checked;
      }

      if (elem.type === "radio") {
        if (elem.checked) {
          return elem.value;
        }

        return undefined;
      }

      if (elem.type === "number" || elem.type === "range") {
        return +elem.value;
      }

      if (elem.type === "file") {
        return elem.files;
      }

      return elem.value;
    } else if (elem instanceof HTMLSelectElement) {
      var res = [...elem.options].filter(opt => {
        return opt.selected;
      }).map(opt => opt.value);

      if (elem.multiple) {
        var ret = getStore(elem, 'multiSelect', []);
        ret.length = 0;
        ret.push(...res);
        return ret;
      }

      return res.pop();
    }

    return elem === null || elem === void 0 ? void 0 : elem.value;
  }

  vals(set) {
    var $elems = wrap([this.filter('input[name], select[name], textarea[name]'), this.find('input[name], select[name], textarea[name]')]);
    var res = {};

    if (set === undefined) {
      $elems.forEach(elem => {
        if (!elem.name) return;

        if (elem instanceof HTMLInputElement && elem.type === 'radio') {
          res[elem.name] = res[elem.name];

          if (elem.checked) {
            res[elem.name] = elem.value;
          }
        } else {
          res[elem.name] = wrap(elem).val();
        }
      });
    } else {
      $elems.forEach(elem => {
        if (set[elem.name] === undefined) return;
        res[elem.name] == set[elem.name];

        if (elem instanceof HTMLInputElement && elem.type === 'radio') {
          elem.checked = set[elem.name] === elem.value;
        } else {
          wrap(elem).val(set[elem.name]);
        }
      });
    }

    return res;
  }

  text(set) {
    return prop(this, 'textContent', set);
  }

  scrollTop(set) {
    return prop(this, 'scrollTop', set);
  }

  scrollLeft(set) {
    return prop(this, 'scrollLeft', set);
  }

  label(set) {
    if (typeof set === 'string') {
      return this.attr('aria-label', set);
    }

    if (!this.get(0)) return null;

    var get = test => test && test.length && test;

    return get(this.attr('aria-label')) || get(get(this.attr('aria-labelledby')) && wrap('#' + this.attr('aria-labelledby')).label()) || get(get(this.attr('id')) && wrap('label[for="' + this.attr('id') + '"]').label()) || get(this.attr('title')) || get(this.attr('placeholder')) || get(this.attr('alt')) || (get(this.text()) || "").trim();
  }

  data(key, set) {
    if (objectOrProp(key, set, (k, v) => {
      this.forEach(elem => {
        var data = getStore(elem, 'data', {});
        data[k] = v;
      });
    })) return this;
    if (!arr(this)[0]) return null;
    var data = getStore(arr(this)[0], 'data') || {};
    return typeof key === 'undefined' ? data : typeof key === 'string' ? data[key] : data;
  }

  removeData(key) {
    this.forEach(elem => {
      var data = getStore(elem, 'data', {});
      delete data[key];
    });
    return this;
  }

  addClass(name) {
    return this.toggleClass(name + "", true);
  }

  removeClass(name) {
    return this.toggleClass(name + "", false);
  }

  toggleClass(name, force) {
    var isObject = name instanceof Object;
    objectOrProp(name, force, (className, on) => {
      this.forEach(elem => {
        elem.classList.toggle(className, isObject ? !!on : on);
      });
    });
    return this;
  }

  hasClass(name) {
    var nameArr = name.split(' ');
    return this.some(elem => nameArr.every(className => elem.classList.contains(className)));
  }

  once(identifier) {
    identifier = typeof identifier === 'undefined' ? 'once' : identifier;
    var res = filter(this, (elem, i) => {
      var once = getStore(elem, 'once', new Set());

      if (!once.has(identifier)) {
        once.add(identifier);
        return true;
      }

      return false;
    });

    if (typeof identifier === 'function') {
      res.forEach(identifier);
    }

    return res;
  }

  get(index) {
    index = +index;
    return arr(this)[index < 0 ? this.size + index : index];
  }

  index(selector) {
    var ind = 0;

    if (typeof selector === 'undefined') {
      return this.first().prevAll().size;
    } else if (typeof selector === 'string') {
      this.forEach(elem => !(elem.matches(selector) || ind++ || false));
      return ind >= this.size ? -1 : ind;
    }

    var sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
    this.forEach(elem => !(sel.has(elem) || ind++ && false));
    return ind >= this.size ? -1 : ind;
  }

  first() {
    return this.eq(0);
  }

  last() {
    return this.eq(-1);
  }

  eq(index) {
    var res = new ElementCollection(1);
    var elem = this.get(index);
    if (elem) arr(res)[0] = elem;else arr(res).pop();
    return res;
  }

  next(selector) {
    return new ElementCollection(...this.map((elem, i) => elem.nextElementSibling)).filter((elem, i) => {
      return elem && (!selector || elem.matches(selector));
    });
  }

  nextUntil(selector, filter) {
    return from(propElem(this, 'nextElementSibling', filter, true, false, selector)).sort();
  }

  nextAll(selector) {
    return this.nextUntil(undefined, selector);
  }

  prev(selector) {
    return new ElementCollection(...this.map(elem => elem.previousElementSibling)).filter((elem, i) => {
      return elem && (!selector || elem.matches(selector));
    });
  }

  prevUntil(selector, filter) {
    return from(propElem(this, 'previousElementSibling', filter, true, false, selector, true)).sort().reverse();
  }

  prevAll(selector) {
    return this.prevUntil(undefined, selector);
  }

  siblings(selector) {
    return wrap([propElem(this, 'nextElementSibling', selector, true), propElem(this, 'previousElementSibling', selector, true, false, false, true)]);
  }

  children(selector) {
    return from(propElem(this.map(elem => elem.firstElementChild), 'nextElementSibling', selector, true, true));
  }

}
var $document = wrap(document.documentElement);

function wrapEvent(originalEvent) {
  if (originalEvent.isEqEvent) {
    return originalEvent;
  }

  var stoppedImmediatePropagation = false;
  var stoppedPropagation = false;
  var currentTarget = originalEvent.currentTarget;
  var sip = originalEvent.stopImmediatePropagation;
  var sp = originalEvent.stopPropagation;
  var props = {
    isEqEvent: {
      value: true
    },
    stoppedPropagation: {
      get: () => stoppedPropagation
    },
    stopppedImmediatePropagation: {
      get: () => stoppedImmediatePropagation
    },
    stopPropagation: {
      value: function value() {
        stoppedPropagation = true;
        return sp.call(originalEvent);
      }
    },
    stopImmediatePropagation: {
      value: function value() {
        stoppedPropagation = true;
        stoppedImmediatePropagation = true;
        return sip.call(originalEvent);
      }
    },
    currentTarget: {
      get: () => currentTarget,
      set: val => currentTarget = val
    }
  };

  for (var _prop in originalEvent) {
    if (props[_prop]) continue;

    if (typeof originalEvent[_prop] === 'function') {
      (function () {
        var fn = originalEvent[_prop];
        props[_prop] = {
          get: () => function () {
            for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
              args[_key2] = arguments[_key2];
            }

            return fn.call(originalEvent, ...args);
          }
        };
      })();
    } else if (_prop !== 'isTrusted') {
      props[_prop] = {
        value: originalEvent[_prop]
      };
    }
  }

  return Object.defineProperties(originalEvent, props);
}

function wrap(selector, context) {
  if (!selector) return new ElementCollection();

  if (!context && (selector instanceof NodeList || selector instanceof HTMLCollection)) {
    return from(selector);
  }

  if (!context && typeof selector === 'string') return from(document.querySelectorAll(selector));
  if (!context && selector instanceof Element) return new ElementCollection(selector);
  if (!context && selector instanceof ElementCollection) return filter(selector).unique().sort();
  var selectors = selector instanceof Array ? selector : [selector];
  var $context = context ? context instanceof ElementCollection ? context : wrap(context) : $document;
  var elems = new Set();
  var doFilter = !!context;
  var doSort = selectors.length > 1;
  if (selectors.length === 1 && $context.size === 1 && selectors[0] === arr($context)[0] || $context === selector) return $context;

  var _loop = function _loop(sel) {
    if (sel instanceof ElementCollection) {
      sel.forEach(elem => {
        if (elem instanceof Element) elems.add(elem);
      });
    } else if (sel instanceof Element) {
      if (!context && selectors.length === 1) {
        return {
          v: new ElementCollection(sel)
        };
      }

      elems.add(sel);
    } else if (sel instanceof NodeList) {
      for (var i = 0; i < sel.length; i++) {
        var elem = sel[i];

        if (elem instanceof Element) {
          elems.add(elem);
        }
      }
    } else if (sel instanceof HTMLCollection) {
      if (!context && selectors.length === 1) {
        return {
          v: from(sel)
        };
      }

      from(sel).forEach(elem => {
        elems.add(elem);
      });
    } else if (typeof sel === 'string') {
      if (!context && selectors.length === 1) {
        return {
          v: from(document.querySelectorAll(sel))
        };
      }

      $context.forEach(cElem => {
        cElem.querySelectorAll(':scope ' + sel).forEach(elem => elems.add(elem));
      });

      if (selectors.length === 1) {
        doFilter = false;
        doSort = false;
      }
    } else if (sel instanceof Set) {
      sel.forEach(elem => {
        if (elem instanceof Element) {
          elems.add(elem);
        }
      });
    } else {
      from(sel).forEach(elem => {
        if (elem instanceof Element) {
          elems.add(elem);
        }
      });
    }
  };

  for (var sel of selectors) {
    var _ret = _loop(sel);

    if (typeof _ret === "object") return _ret.v;
  }

  var res = from(elems);

  if (doFilter) {
    res = filter(res, (elem, i) => {
      return $context.some(cont => cont !== elem && cont.contains(elem));
    });
  }

  if (doSort) {
    res = res.sort();
  }

  return res;
}

function filter(elems, selector) {
  if (!selector) return new ElementCollection(...arr(elems).filter(elem => elem instanceof Element));

  if (typeof selector === 'function') {
    return new ElementCollection(...arr(elems).filter(selector));
  }

  if (typeof selector === 'string') {
    return filter(elems, elem => elem.matches(selector));
  }

  var sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
  return filter(elems, elem => sel.has(elem));
}

function prop(elems, key, set) {
  if (objectOrProp(key, set, (k, v) => {
    elems.forEach(elem => {
      elem[k] = v;
    });
  })) return elems;
  return arr(elems)[0] ? arr(elems)[0][key] : null;
}

function parents(elems, selector) {
  return from(propElem(elems, 'parentNode', selector, true)).sort().reverse();
}

function propElem(collection, prop, selector, multiple, includeFirst, stopAt, reverse) {
  var res = new Set();
  var cache = new Set();

  var is = (elem, sel) => {
    if (!(elem instanceof Element)) return false;
    if (!sel) return true;
    if (typeof sel === 'string') return elem.matches(sel);
    if (sel instanceof Array) return sel.includes(elem);
    return elem === sel;
  };

  var coll;

  if (collection instanceof ElementCollection) {
    coll = arr(collection);
  } else {
    coll = collection;
  }

  for (var i = reverse ? coll.length - 1 : 0; reverse ? i >= 0 : i < coll.length; reverse ? i-- : i++) {
    var elem = coll[i];
    if (!elem) continue;
    if (cache.has(elem)) continue;
    cache.add(elem);
    var next = elem[prop];

    if (includeFirst) {
      next = elem;
    }

    if (!next || stopAt && is(next, stopAt)) continue;

    do {
      if (is(next, selector)) {
        res.add(next);
      }

      cache.add(next);
    } while (multiple && next && (next = next[prop]) && !cache.has(next) && (!stopAt || !is(next, stopAt)));
  }

  return res;
}

function objectOrProp(name, set, each) {
  var res = {};
  var wasSet = false;

  if (typeof name === 'string' && typeof set !== 'undefined') {
    wasSet = true;
    name.split(' ').forEach(n => res[n] = set);
  } else if (name && typeof name === 'object') {
    wasSet = true;
    res = name;
  }

  for (var i in res) {
    each(i, res[i]);
  }

  return wasSet;
}

function from(object) {
  if (typeof object !== 'object' || !object) return new ElementCollection();
  if (object instanceof ElementCollection) return object;
  var size = 0;

  if (object instanceof Array) {
    size = object.length;
  } else if (object instanceof Set) {
    size = object.size;
  } else {
    return new ElementCollection(...[...object].filter(el => el instanceof Element));
  }

  var res = new ElementCollection(size);
  var objArr = arr(res);
  var i = 0;

  for (var item of object) {
    objArr[i++] = item;
  }

  return res;
}

function getStore(elem, store, defaultValue) {
  if (!elementStorage.has(elem)) {
    if (defaultValue === undefined) return;
    elementStorage.set(elem, new Map());
  }

  var types = elementStorage.get(elem);

  if (typeof defaultValue !== 'undefined' && !types.has(store)) {
    types.set(store, defaultValue);
  }

  return types.get(store);
}
function deleteStore(elem, store) {
  var _elementStorage$get;

  return (_elementStorage$get = elementStorage.get(elem)) === null || _elementStorage$get === void 0 ? void 0 : _elementStorage$get.delete(store);
}

var allowedGlobals = Sandbox.SAFE_GLOBALS;
var allowedPrototypes = Sandbox.SAFE_PROTOTYPES;
var sandbox = new Sandbox(allowedGlobals, allowedPrototypes);
var regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
var regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;

function isIterable(object) {
  return object !== null && typeof object === 'object' && typeof object[Symbol.iterator] === 'function';
}

function isObject(object) {
  return object !== null && typeof object === 'object';
}

ElementCollection.prototype.html = function (content) {
  if (content === undefined) {
    var _this$get;

    return (_this$get = this.get(0)) === null || _this$get === void 0 ? void 0 : _this$get.innerHTML;
  }

  var contentElem;

  if (content instanceof ElementCollection) {
    content = content.detach();
  }

  var elem = this.get(0);
  if (!elem) return this;
  contentElem = preprocessHTML(content);
  var currentSubs = getStore(elem, 'currentSubs', []);

  for (var el of [...elem.children]) {
    unsubNested(getStore(el, 'currentSubs'));
  }

  var processed = processHTML(contentElem, currentSubs, defaultDelegateObject);
  elem.innerHTML = '';
  elem.appendChild(processed.elem);
  processed.run(getScopes(elem, currentSubs, {}));
  return this;
};

ElementCollection.prototype.text = function (set) {
  var _this$get2;

  if (set !== undefined) {
    this.forEach(elem => {
      unsubNested(getStore(elem, 'childSubs'));
      elem.textContent = set;
    });
    return this;
  }

  return (_this$get2 = this.get(0)) === null || _this$get2 === void 0 ? void 0 : _this$get2.textContent.trim();
};

ElementCollection.prototype.detach = function () {
  var contentElem = document.createElement('template');

  for (var elem of this) {
    unsubNested(getStore(elem, 'currentSubs'));
    contentElem.appendChild(elem);
  }
  return contentElem.content;
};

allowedPrototypes.set(ElementCollection, new Set());
allowedPrototypes.set(FileList, new Set());
allowedPrototypes.set(File, new Set());

class ElementScope {
  constructor(element) {
    this.$el = wrap(element);
  }

  $dispatch(eventType, detail) {
    var bubbles = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var cancelable = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    this.$el.trigger(eventType, detail, bubbles, cancelable);
  }

  $watch(cb, callback) {
    var subUnsubs = watch(cb, callback);
    var sub = getStore(this.$el.get(0), 'currentSubs', []);
    sub.push(subUnsubs);
    return {
      unsubscribe: () => unsubNested(subUnsubs)
    };
  }

}

function getRootElement(scopes) {
  var _scopes$;

  return (_scopes$ = scopes[0]) === null || _scopes$ === void 0 ? void 0 : _scopes$.$el.get(0);
}

class RootScope extends ElementScope {
  constructor() {
    super(...arguments);
    this.$refs = {};
  }

  $wrap(element) {
    return wrap(element, this.$el);
  }

}

class Component {}
allowedPrototypes.set(RootScope, new Set());
allowedPrototypes.set(ElementScope, new Set());
var components = {};
function defineComponent(name, comp) {
  components[name] = comp;

  if (!allowedPrototypes.has(comp.constructor)) {
    allowedPrototypes.set(comp.constructor, new Set());
  }
}
function init(elems, component) {
  var runs = [];
  (elems ? wrap(elems, $document) : $document.find('[x-app]').not('[x-app] [x-app]')).once('x-processed').forEach(elem => {
    var comp = component || elem.getAttribute('x-app');
    var subs = [];
    var scope = getScope(elem, subs, components[comp] || {}, true);
    preprocessHTML(elem);
    var processed = processHTML(elem, subs, defaultDelegateObject);
    elem.setAttribute('x-processed', '');
    runs.push(() => processed.run([scope]));
  });
  runs.forEach(run => run());
}

function getScope(element, subs) {
  var vars = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var scope = getStore(element, 'scope');

  if (!scope) {
    getStore(element, 'currentSubs', subs);
    scope = getStore(element, 'scope', root ? new RootScope(element) : new ElementScope(element));
    subs.push(() => {
      scope.$el = null;
      deleteStore(element, 'currentSubs');
      deleteStore(element, 'scope');
    });
  }

  Object.assign(scope, vars);
  return scope;
}

function getScopes(element) {
  var subs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var newScope = arguments.length > 2 ? arguments[2] : undefined;
  if (!element) return [];
  var scope = newScope === undefined ? getStore(element, 'scope') : getScope(element, subs, newScope);
  var scopes = [];
  if (scope) scopes.push(scope);
  return [...(element.hasAttribute('x-detached') ? [] : getScopes(element.parentElement)), ...scopes];
}
var calls = [];
var timer;

function call(cb) {
  calls.push(cb);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    var toCall = [...calls];
    calls.length = 0;

    for (var c of toCall) {
      try {
        c();
      } catch (err) {
        console.error(err);
      }
    }
  });
}

function watchRun(scopes, code) {
  return () => run(getRootElement(scopes), 'return ' + code, scopes);
}

function watch(toWatch, handler) {
  var watchGets = new Map();
  var subUnsubs = [];
  var lastVal;
  var update = false;
  var start = Date.now();
  var count = 0;

  var digest = () => {
    if (Date.now() - start > 4000) {
      count = 0;
      start = Date.now();
    } else {
      if (count++ > 200) {
        throw new Error('Too many digests too quickly');
      }
    }

    unsubNested(subUnsubs);
    var g = sandbox.subscribeGet((obj, name) => {
      var list = watchGets.get(obj) || new Set();
      list.add(name);
      watchGets.set(obj, list);
    });
    var val;

    try {
      val = toWatch();
    } catch (err) {
      g.unsubscribe();
      throw err;
    }

    g.unsubscribe();

    for (var item of watchGets) {
      var obj = item[0];

      for (var name of item[1]) {
        subUnsubs.push(sandbox.subscribeSet(obj, name, () => {
          if (update) return;
          update = true;
          call(() => {
            update = false;
            digest();
          });
        }).unsubscribe);
      }
    }

    watchGets.clear();

    if (val !== lastVal) {
      var temp = lastVal;
      lastVal = val;
      handler(val, temp);
    }
  };

  digest();
  return subUnsubs;
}
var sandboxCache = new WeakMap();
function run(el, code, scopes) {
  el = el || document;
  var codes = sandboxCache.get(el) || {};
  sandboxCache.set(el, codes);
  codes[code] = codes[code] || sandbox.compile(code);
  return codes[code](...scopes);
}
var directives = {};
defineDirective('show', (exec, scopes) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    exec.element.classList.toggle('hide', !val);
  });
});
defineDirective('text', (exec, scopes) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    wrap(exec.element).text(val + "");
  });
});
defineDirective('ref', (exec, scopes) => {
  if (!exec.js.match(regVarName)) {
    throw new Error('Invalid ref name: ' + exec.js);
  }

  var name = getScope(exec.element, [], {
    name: exec.js.trim()
  });
  run(document, "$refs[name] = $wrap([...($refs[name] || []), $el])", [...scopes, name]);
  return [() => {
    run(document, "$refs[name] = $refs[name].not($el)", [...scopes, name]);
  }];
});
defineDirective('model', (exec, scopes) => {
  var el = exec.element;
  var isContentEditable = el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '');
  var isInput = el instanceof HTMLInputElement && (!el.type || el.type === 'text' || el.type === 'tel') || el instanceof HTMLTextAreaElement || isContentEditable;
  var $el = wrap(el);
  var last = !isContentEditable ? $el.val() : $el.html();

  if (!el.hasAttribute('name')) {
    el.setAttribute('name', exec.js.trim());
  }

  var reset = false;

  var change = () => {
    last = !isContentEditable ? $el.val() : $el.html();
    run(getRootElement(scopes), exec.js.trim() + ' = ($$value === undefined && !reset) ? ' + exec.js.trim() + ' : $$value', pushScope(scopes, el, exec.subs, {
      $$value: last,
      reset
    }));
    reset = false;
  };

  var sub = [];
  sub.push(exec.delegate.on(el, isInput ? 'input' : 'change', change));

  if (el.form) {
    var $form = wrap(el.form);
    sub.push($form.delegate().on($form.get(0), 'reset', () => reset = !!setTimeout(change)));
  }

  sub.push(watch(watchRun(scopes, exec.js.trim()), (val, lastVal) => {
    if (val === last) return;

    if (isContentEditable) {
      $el.html(val + "");
    } else {
      $el.val(val);
    }
  }));
  return sub;
});
defineDirective('html', (exec, scopes) => {
  return watch(watchRun(scopes, exec.js), (val, lastVal) => {
    if (val instanceof Node || typeof val === 'string' || val instanceof ElementCollection) {
      wrap(exec.element).html(val);
    }
  });
});
function defineDirective(name, callback) {
  directives[name] = callback;
}

function runDirective(exec, scopes) {
  if (directives[exec.directive]) {
    return directives[exec.directive](exec, scopes);
  }

  return [];
}

function walkerInstance() {
  var execSteps = [];
  return {
    ready: cb => execSteps.push(cb),
    run: function runNested(scopes) {
      execSteps.forEach(cb => cb(scopes));
    }
  };
}

function preprocessHTML(html) {
  var elem;

  if (typeof html === 'string') {
    var template = document.createElement('template');
    template.innerHTML = html;
    elem = template.content;
  } else if (html instanceof Element) {
    elem = html;
  } else {
    return html;
  }

  sanitizeHTML(elem);
  return elem;
}

function processHTML(elem, subs, delegate) {
  var exec = walkerInstance();
  walkTree(elem, subs, exec.ready, delegate);
  return {
    elem: elem,
    run: exec.run
  };
}

function unsubNested(subs) {
  if (!subs) return;

  if (typeof subs === 'function') {
    subs();
    return;
  }

  var s = subs.slice();
  subs.length = 0;
  s.forEach(unsub => {
    if (Array.isArray(unsub)) {
      unsubNested(unsub);
    } else {
      unsub();
    }
  });
}

function pushScope(scopes, elem, sub, vars) {
  var found = getStore(elem, 'scope');
  var scope = getScope(elem, sub, vars);
  scopes = scopes.slice();
  scopes.push(scope);
  return scopes;
}

function walkTree(element, parentSubs, ready, delegate) {
  var currentSubs = [];
  parentSubs.push(currentSubs);

  if (element instanceof Element) {
    var _ret = function () {
      getStore(element, 'currentSubs', parentSubs);
      var $element = wrap(element);
      element.removeAttribute('x-cloak');

      if (element.hasAttribute('x-if')) {
        var comment = document.createComment('x-if');
        var ifElem;
        var at = element.getAttribute('x-if');
        element.removeAttribute('x-if');
        element.before(comment);
        element.remove();
        deleteStore(element, 'currentSubs');
        ready(scopes => {
          getStore(comment, 'currentSubs', currentSubs);
          var nestedSubs = [];
          currentSubs.push(nestedSubs);
          currentSubs.push(watch(watchRun(scopes, at), (val, lastVal) => {
            if (val) {
              if (!ifElem) {
                ifElem = element.cloneNode(true);
                var processed = processHTML(ifElem, nestedSubs, delegate);
                comment.after(processed.elem);
                processed.run(pushScope(scopes, ifElem, nestedSubs));
              }
            } else {
              if (ifElem) {
                ifElem.remove();
                ifElem = undefined;
                unsubNested(nestedSubs);
              }
            }
          }));
        });
        return {
          v: void 0
        };
      }

      if (element.hasAttribute('x-for')) {
        var _comment = document.createComment('x-for');

        element.after(_comment);
        element.remove();
        deleteStore(element, 'currentSubs');
        var items = new Set();
        var exp;

        var _at = element.getAttribute('x-for');

        element.removeAttribute('x-for');

        var split = _at.split(' in ');

        if (split.length < 2) {
          throw new Error('In valid x-for directive: ' + _at);
        } else {
          exp = split.slice(1).join(' in ');
        }

        var varsExp = split[0];
        var varMatch = varsExp.match(regVarName);
        var key;
        var value;

        if (varMatch) {
          value = varMatch[1];
        } else {
          var doubleMatch = varsExp.match(regKeyValName);
          if (!doubleMatch) throw new Error('In valid x-for directive: ' + _at);
          key = doubleMatch[1];
          value = doubleMatch[2];
        }

        ready(scopes => {
          var del = wrap(_comment.parentElement).delegate();
          currentSubs.push(del.off);
          var nestedSubs = [];
          currentSubs.push(nestedSubs);
          currentSubs.push(watch(watchRun(scopes, exp), val => {
            unsubNested(nestedSubs);
            items.forEach(item => {
              item.remove();
            });
            items.clear();
            var runs = [];

            var repeat = (item, i) => {
              var forSubs = [];
              nestedSubs.push(forSubs);
              var scope = {
                $index: i
              };
              if (key) scope[key] = i;
              if (value) scope[value] = item;
              var elem = element.cloneNode(true);
              var processed = processHTML(elem, forSubs, del);

              _comment.before(processed.elem);

              items.add(elem);
              runs.push(() => processed.run(pushScope(scopes, elem, forSubs, scope)));
            };

            var i = -1;

            if (isIterable(val)) {
              for (var item of val) {
                i++;
                repeat(item, i);
              }
            } else if (isObject(val)) {
              for (var _i in val) {
                repeat(val[_i], _i);
              }
            }

            runs.forEach(run => run());
          }));
        });
        return {
          v: void 0
        };
      }

      if (element.hasAttribute('x-detached')) {
        var nestedScopes;
        ready(scopes => {
          nestedScopes = [getScope(element, currentSubs, {}, true)];
        });
        var prevReady = ready;

        ready = cb => prevReady(() => cb(nestedScopes));
      }

      var elementScopeAdded = false;

      var _loop = function _loop(att) {
        if (att.nodeName.startsWith("$")) {
          var name = att.nodeName.substring(1);

          if (!name.match(regVarName)) {
            console.error("Invalid variable name in attribute ".concat(att.nodeName));
            return "continue";
          }

          if (!elementScopeAdded) {
            elementScopeAdded = true;
            var _prevReady = ready;

            ready = cb => {
              _prevReady(s => {
                cb(pushScope(s, element, currentSubs));
              });
            };
          }

          ready(scopes => {
            run(getRootElement(scopes), "let ".concat(name, " = ").concat(att.nodeValue), scopes);
          });
        }
      };

      for (var att of element.attributes) {
        var _ret2 = _loop(att);

        if (_ret2 === "continue") continue;
      }

      if (element instanceof HTMLScriptElement) {
        if (element.type === 'scopejs') {
          ready(scopes => {
            run(getRootElement(scopes), element.innerHTML, scopes);
          });
        } else {
          element.remove();
        }

        return {
          v: void 0
        };
      } else {
        var _loop2 = function _loop2(_att) {
          if (_att.nodeName.startsWith(':')) {
            var _at2 = _att.nodeName.slice(1);

            ready(scopes => {
              currentSubs.push(watch(watchRun(scopes, _att.nodeValue), (val, lastVal) => {
                if (typeof val === 'object' && ['style', 'class'].includes(_at2)) {
                  if (_at2 === 'class') {
                    $element.toggleClass(val);
                  } else {
                    if (element instanceof HTMLElement || element instanceof SVGElement) {
                      for (var c in val) {
                        element.style[c] = val[c];
                      }
                    }
                  }
                } else {
                  $element.attr(_at2, val + "");
                }
              }));
            });
          } else if (_att.nodeName.startsWith('@')) {
            var parts = _att.nodeName.slice(1).split('.');

            ready(scopes => {
              var ev = e => {
                run(getRootElement(scopes), _att.nodeValue, pushScope(scopes, element, currentSubs, {
                  $event: e
                }));
              };

              if (parts[1] === 'once') {
                currentSubs.push(delegate.one(element, parts[0], ev));
              } else {
                currentSubs.push(delegate.on(element, parts[0], ev));
              }
            });
          } else if (_att.nodeName.startsWith('x-')) {
            ready(scopes => {
              currentSubs.push(runDirective({
                element,
                directive: _att.nodeName.slice(2),
                js: _att.nodeValue,
                original: element.outerHTML,
                subs: currentSubs,
                delegate
              }, pushScope(scopes, element, currentSubs)));
            });
          }
        };

        for (var _att of element.attributes) {
          _loop2(_att);
        }
      }
    }();

    if (typeof _ret === "object") return _ret.v;
  }

  if (element instanceof Element && element.hasAttribute('x-static')) {
    for (var el of [...element.children]) {
      sanitizeHTML(el, true);
    }
  } else {
    var execSteps = [];

    var r = cb => execSteps.push(cb);

    var _loop3 = function _loop3(_el) {

      if (_el instanceof Element) {
        walkTree(_el, currentSubs, r, delegate);
      } else if (_el.nodeType === 3) {
        var strings = walkText(_el.textContent);
        var nodes = [];
        var found = false;
        strings.forEach(s => {
          if (s.startsWith("{{") && s.endsWith("}}")) {
            found = true;
            var placeholder = document.createTextNode("");
            ready(scopes => {
              currentSubs.push(watch(watchRun(scopes, s.slice(2, -2)), (val, lastVal) => {
                placeholder.textContent = val + "";
              }));
              return scopes;
            });
            nodes.push(placeholder);
          } else {
            nodes.push(document.createTextNode(s));
          }
        });

        if (found) {
          nodes.forEach(n => {
            _el.before(n);
          });

          _el.remove();
        }
      }
    };

    for (var _el of [...element.childNodes]) {
      _loop3(_el);
    }

    ready(scopes => {
      for (var cb of execSteps) {
        cb(scopes);
      }
    });
  }
}

var closings$1 = {
  "(": ")",
  "{": "}",
  "[": "]"
};
var quotes = ["'", '"', "`"];

function walkText(s) {
  var endJs = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
  var strings = [];
  var quote = null;
  var closing = null;
  var escape = false;
  var inJs = !!endJs;
  var start = 0;
  var i = 0;

  for (; i < s.length; i++) {
    var char = s[i];
    var next = s[i + 1];

    if (inJs) {
      if (quote) {
        if (!escape && quote === char) {
          quote = null;
        } else if (char === '\\') {
          escape = !escape;
        } else if (!escape && quote === '`' && char === "$" && next === "{") {
          var strs = walkText(s.substring(i + 2), "}");
          i += strs[0].length + 2;
        }
      } else if (quotes.includes(char)) {
        quote = char;
      } else if (closing) {
        if (closings$1[closing] === char) {
          closing = null;
        }
      } else if (closings$1[char]) {
        closing = char;
      } else if (char === endJs) {
        strings.push(s.substring(start, i));
        return strings;
      } else if (char === "}" && next === "}") {
        strings.push(s.substring(start, i + 2));
        inJs = false;
        i += 1;
        start = i + 1;
      }
    } else {
      if (char === "{" && next === "{") {
        inJs = true;

        if (start !== i) {
          strings.push(s.substring(start, i));
        }

        start = i;
        i += 1;
      }
    }
  }

  if (start !== i && start < s.length) {
    strings.push(s.substring(start, i));
  }

  return strings.filter(Boolean);
}

export default init;
export { Component, allowedGlobals, allowedPrototypes, defineComponent, defineDirective, getScopes, run, sandbox, unsubNested, watch };
//# sourceMappingURL=Scope.js.map
