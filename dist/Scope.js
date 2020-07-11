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

      if (this.const.has(key)) {
        return new Prop(this.allVars, key, true, this.globals.has(key), true);
      }

      if (this.var.has(key)) {
        return new Prop(this.allVars, key, false, this.globals.has(key), true);
      }

      if (this.let.has(key)) {
        return new Prop(this.allVars, key, false, this.globals.has(key), true);
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
      arrayProp: /^[\[]/,
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

restOfExp.next = ['splitter', 'op', 'expEnd'];

function assignCheck(obj, context, op = 'assign') {
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

  setTimeout(() => {
    var _a, _b;

    (_b = (_a = context.setSubscriptions.get(obj.context)) === null || _a === void 0 ? void 0 : _a.get(obj.prop)) === null || _b === void 0 ? void 0 : _b.forEach(cb => cb());
  });
}

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
    if (context.options.forbidMethodCalls) throw new SandboxError("Method calls are not allowed");

    if (typeof a !== 'function') {
      throw new TypeError(`${obj.prop} is not a function`);
    }

    const args = b.map(item => {
      if (item instanceof SpreadArray) {
        return item.item;
      } else {
        return [item];
      }
    }).flat();

    if (typeof obj === 'function') {
      return obj(...args.map(item => exec(item, scope, context)));
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
        return item.item;
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
      setSubscriptions: new WeakMap()
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
      console,
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
    return {
      unsubscribe: () => callbacks.delete(callback)
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

var elementStorage = new WeakMap();
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
class ElementCollection extends Array {
  constructor() {
    super(...arguments);
  }

  sort(callback) {
    if (!callback) return super.sort((a, b) => {
      if (a === b) return 0;

      if (a.compareDocumentPosition(b) & 2) {
        return 1;
      }

      return -1;
    });
    return super.sort(callback);
  }

  unique() {
    return from(this.toSet(), ElementCollection);
  }

  toArray() {
    return from(this, Array);
  }

  toSet() {
    var res = new Set();
    this.forEach(elem => res.add(elem));
    return res;
  }

  add(selector, context) {
    if (selector instanceof Array) {
      selector = selector.filter(Boolean);
    }

    return wrap([this, wrap(selector, context)]);
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

        var found = from(elem.querySelectorAll(':scope ' + selector), ElementCollection);
        found = found.add(parents(found));
        found.forEach(e => cache.add(e));
        return found.length;
      });
    }

    var sel = selector instanceof ElementCollection ? selector : wrap(selector);
    return filter(this, (elem, i) => sel.some(test => elem !== test && elem.contains(test)));
  }

  search(selector) {
    if (typeof selector === 'function') {
      return new ElementCollection(this.find((a, b, c) => selector(a, b)));
    }

    return wrap(selector, new ElementCollection(...this));
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
    var events = new WeakMap();
    var all = [];
    var once = new Set();
    var started = new Map();
    var that = this[0];
    if (!that) return defaultDelegateObject;
    return {
      on(elem, event, callback) {
        var evs = events.get(elem) || new Map();
        events.set(elem, evs);
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

        return () => {
          var _events$get2, _events$get2$get, _events$get3;

          (_events$get2 = events.get(elem)) === null || _events$get2 === void 0 ? void 0 : (_events$get2$get = _events$get2.get(event)) === null || _events$get2$get === void 0 ? void 0 : _events$get2$get.delete(callback);

          if (((_events$get3 = events.get(elem)) === null || _events$get3 === void 0 ? void 0 : _events$get3.get(event).size) === 0) {
            var _events$get4;

            (_events$get4 = events.get(elem)) === null || _events$get4 === void 0 ? void 0 : _events$get4.delete(event);
          }
        };
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
      if (("" + v).match(/^\s*javascript:/)) throw new Error('"javascript:" attribute values are not allowed:' + v);
      if (k.match(/^(on|:|@|x-|srcdoc)/)) throw new Error("Attribute not allowed: " + k);
      this.forEach(elem => {
        elem.setAttribute(k, v + "");
      });
    })) return this;
    return this[0] && typeof key === 'string' ? this[0].getAttribute(key) : null;
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
          } else {
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
      return this;
    }

    var elem = this[0];
    if (!elem) return;

    if (elem instanceof HTMLInputElement) {
      if (elem.type === "checkbox" || elem.type === "radio") {
        return elem.checked;
      }

      return elem.value;
    } else if (elem instanceof HTMLSelectElement) {
      var res = [...elem.options].filter(opt => {
        return opt.selected;
      }).map(opt => opt.value);
      if (elem.multiple) return res;
      return res.pop();
    }

    return elem === null || elem === void 0 ? void 0 : elem.value;
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
    if (!this[0]) return null;
    var data = getStore(this[0], 'data') || {};
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
    return this[index < 0 ? this.length + index : index];
  }

  index(selector) {
    var ind = 0;

    if (typeof selector === 'undefined') {
      return this.first().prevAll().length;
    } else if (typeof selector === 'string') {
      this.forEach(elem => !(elem.matches(selector) || ind++ || false));
      return ind >= this.length ? -1 : ind;
    }

    var sel = (selector instanceof ElementCollection ? selector : wrap(selector)).toSet();
    this.forEach(elem => !(sel.has(elem) || ind++ && false));
    return ind >= this.length ? -1 : ind;
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
    if (elem) res[0] = elem;else res.pop();
    return res;
  }

  next(selector) {
    return new ElementCollection(...this.map((elem, i) => elem.nextElementSibling)).filter((elem, i) => {
      return elem && (!selector || elem.matches(selector));
    });
  }

  nextUntil(selector, filter) {
    return from(propElem(this, 'nextElementSibling', filter, true, false, selector), ElementCollection).sort();
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
    return from(propElem(this, 'previousElementSibling', filter, true, false, selector, true), ElementCollection).sort().reverse();
  }

  prevAll(selector) {
    return this.prevUntil(undefined, selector);
  }

  siblings(selector) {
    return wrap([propElem(this, 'nextElementSibling', selector, true), propElem(this, 'previousElementSibling', selector, true, false, false, true)]);
  }

  children(selector) {
    return from(propElem(this.map(elem => elem.firstElementChild), 'nextElementSibling', selector, true, true), ElementCollection);
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
            for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
              args[_key] = arguments[_key];
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
  if (!context && typeof selector === 'string') return from(document.querySelectorAll(selector), ElementCollection);
  if (!context && selector instanceof Element) return new ElementCollection(selector);
  if (!context && selector instanceof ElementCollection) return filter(selector).unique().sort();
  var selectors = selector instanceof Array ? selector : [selector];
  var $context = context ? context instanceof ElementCollection ? context : wrap(context) : $document;
  var elems = new Set();
  var doFilter = !!context;
  var doSort = selectors.length > 1;
  if (selectors.length === 1 && $context.length === 1 && selectors[0] === $context[0] || $context === selector) return $context;

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
          v: from(sel, ElementCollection)
        };
      }

      from(sel, ElementCollection).forEach(elem => {
        elems.add(elem);
      });
    } else if (typeof sel === 'string') {
      if (!context && selectors.length === 1) {
        return {
          v: from(document.querySelectorAll(sel), ElementCollection)
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
      from(sel, ElementCollection).forEach(elem => {
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

  var res = from(elems, ElementCollection);

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
  if (!selector) return new ElementCollection(...elems.filter(elem => elem instanceof Element));

  if (typeof selector === 'function') {
    return new ElementCollection(...elems.filter(selector));
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
  return elems[0] ? elems[0][key] : null;
}

function parents(elems, selector) {
  return from(propElem(elems, 'parentNode', selector, true), ElementCollection).sort().reverse();
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

  for (var i = reverse ? collection.length - 1 : 0; reverse ? i >= 0 : i < collection.length; reverse ? i-- : i++) {
    var elem = collection[i];
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

function from(object, Class) {
  if (typeof object !== 'object' || !object) return new Class();
  if (Class.isPrototypeOf(object)) return object;

  if (object instanceof Array || object instanceof NodeList || object instanceof HTMLCollection) {
    var i;
    var arr = new Class(object.length);

    for (i = 0; i < object.length; i++) {
      arr[i] = object[i];
    }

    return arr;
  }

  if (object.size) {
    var _i = 0;

    var _arr = new Class(object.size);

    object.forEach(item => {
      _arr[_i++] = item;
    });
    return _arr;
  }

  return Class.from(object);
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
var regForbiddenAttr = /^(on|:|@|x-)/;
var regHrefJS = /^\s*javascript:/;
function wrap$1(selector, context) {
  return Object.assign(Object.create(ElementCollection$1.prototype), wrap(selector, context));
}

function walkFindSubs(elem) {
  var up = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  if (!elem) return [];
  var subs = [];

  for (var el of up ? [elem.parentNode] : elem.childNodes) {
    var found = getStore(el, 'htmlSubs');

    if (found) {
      subs.push(found);
    } else {
      subs.push(...walkFindSubs(el));
    }
  }

  return subs;
}

class ElementCollection$1 extends ElementCollection {
  html(content) {
    if (content === undefined) {
      var _this$;

      return (_this$ = this[0]) === null || _this$ === void 0 ? void 0 : _this$.innerHTML;
    }

    var contentElem;
    var elem = this.get(0);
    if (!elem) return this;

    if (typeof content !== 'string') {
      contentElem = wrap$1(content).detach();
    }

    unsubNested(walkFindSubs(elem));
    var subs = [];
    var found = getStore(elem, 'htmlSubs', subs);

    if (found === subs) {
      var parentSubs = walkFindSubs(elem, true);
      parentSubs.push(subs);
    } else {
      subs = found;
    }

    var nestedSubs = [];
    subs.push(nestedSubs);
    var processed = processHtml(typeof content !== 'string' ? contentElem : content, nestedSubs, defaultDelegateObject, ...getScopes(elem, {}, subs));
    elem.appendChild(processed.elem);
    processed.run();
    return this;
  }

  text(set) {
    var _this$get;

    if (set !== undefined) {
      this.forEach(elem => {
        unsubNested(walkFindSubs(elem));
        elem.textContent = set;
      });
      return this;
    }

    return (_this$get = this.get(0)) === null || _this$get === void 0 ? void 0 : _this$get.textContent.trim();
  }

  detach() {
    var contentElem = document.createElement('template');
    this.forEach(elem => {
      unsubNested(getStore(elem, 'htmlSubs'));
      contentElem.appendChild(elem);
    });
    return contentElem.content;
  }

}
allowedPrototypes.set(ElementCollection, new Set());
allowedPrototypes.set(ElementCollection$1, new Set());

class ElementScope {
  constructor(element) {
    this.$el = wrap$1(element);
  }

  $dispatch(eventType, detail) {
    var bubbles = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
    var cancelable = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    this.$el.trigger(eventType, detail, bubbles, cancelable);
  }

}

var watchGets = [];
var watchListen = false;

class RootScope extends ElementScope {
  $wrap(element) {
    return wrap$1(element, this.$el);
  }

  $watch(variable, callback) {
    if (!watchListen) return {
      unsubscribe: () => undefined
    };
    watchListen = false;

    var _loop = function _loop(item) {
      watchGets.length = 0;

      if (item.obj[item.name] === variable) {
        var lastVal;
        return {
          v: sandbox.subscribeSet(item.obj, item.name, () => {
            var val = item.obj[item.name];

            if (val !== lastVal) {
              callback(val, lastVal);
              lastVal = val;
            }
          })
        };
      }
    };

    for (var item of watchGets) {
      var _ret = _loop(item);

      if (typeof _ret === "object") return _ret.v;
    }

    return {
      unsubscribe: () => undefined
    };
  }

}

class Component {
  $watch(expr, cb) {
    var subs = watch(expr, cb, [this]);
    return {
      unsubscribe: () => unsubNested(subs)
    };
  }

}
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
  (elems ? wrap$1(elems, $document) : $document.search('[x-app]').not('[x-app] [x-app]')).once('x-processed').forEach(elem => {
    var comp = component || elem.getAttribute('x-app');
    var subs = [];
    var scope = getStore(elem, 'scope', components[comp] || getScope(elem, subs, {}, true));
    var processed = processHtml(elem, subs, defaultDelegateObject, scope);
    elem.setAttribute('x-processed', '');
    runs.push(processed.run);
  });
  runs.forEach(run => run());
}

function getScope(element, subs) {
  var vars = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
  var root = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
  var scope = getStore(element, 'scope', root ? new RootScope(element) : new ElementScope(element));
  getStore(element, 'htmlSubs', subs);
  subs.push(() => {
    scope.$el = null;
    deleteStore(element, 'htmlSubs');
    deleteStore(element, 'scope');
  });
  Object.assign(scope, vars);
  return scope;
}

function getDataScope(element, data) {
  return getStore(element, 'dataScope', data);
}

function getScopes(element, newScope) {
  var subs = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  if (!element) return [];
  var datascope = getDataScope(element);
  var scope = newScope === undefined ? getStore(element, 'scope') : getScope(element, subs, newScope);
  var scopes = [];
  if (scope) scopes.push(scope);
  if (datascope) scopes.push(datascope);
  return [...(element.hasAttribute('x-detached') ? [] : getScopes(element.parentElement)), ...scopes];
}
function watch(code, cb, scopes, digestObj) {
  var gets = new Map();
  var unsub = sandbox.subscribeGet((obj, name) => {
    var names = gets.get(obj) || new Set();
    names.add(name);
    gets.set(obj, names);
  }).unsubscribe;
  var val;

  try {
    val = run('return ' + code, ...scopes);
  } catch (_unused) {}

  unsub();

  if (digestObj && digestObj.lastVal === val) {
    return;
  }

  var timer;

  var digest = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (new Date().getTime() - digestObj.countStart.getTime() > 500) {
        if (digestObj.count++ > 100) {
          throw new Error('Infinite digest detected');
        }

        digestObj.count = 0;
        digestObj.countStart = new Date();
      }

      if (!digestObj.subs.length) return;
      unsubNested(digestObj.subs);
      var s = watch(code, cb, scopes, digestObj);
      digestObj.subs.push(...s);
    });
  };

  if (!digestObj) {
    var subs = [];
    digestObj = {
      digest,
      count: 0,
      countStart: new Date(),
      lastVal: val,
      subs
    };
  } else {
    digestObj.digest = digest;
    digestObj.lastVal = val;
  }

  gets.forEach((g, obj) => {
    g.forEach(name => {
      digestObj.subs.push(sandbox.subscribeSet(obj, name, () => {
        digestObj.digest();
      }).unsubscribe, () => clearTimeout(timer));
    });
  });
  var res = cb(val, digestObj.lastVal);

  if (res instanceof Promise) {
    res.then(() => {
      digestObj.digest();
    }, err => {
      console.error(err);
    });
  }

  return digestObj.subs;
}
var sandboxCache = {};
function run(code) {
  sandboxCache[code] = sandboxCache[code] || sandbox.compile(code);
  var unsub = sandbox.subscribeGet((obj, name) => {
    if (obj[name] === RootScope.prototype.$watch) {
      watchListen = true;
      watchGets.push({
        obj,
        name
      });
    }
  });

  for (var _len = arguments.length, scopes = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    scopes[_key - 1] = arguments[_key];
  }

  var ret = sandboxCache[code](...scopes);
  unsub.unsubscribe();
  watchListen = false;
  watchGets.length = 0;
  return ret;
}
var directives = {};
defineDirective('show', function (exec) {
  for (var _len2 = arguments.length, scopes = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    scopes[_key2 - 1] = arguments[_key2];
  }

  return watch(exec.js, (val, lastVal) => {
    exec.element.classList.toggle('hide', !val);
  }, scopes);
});
defineDirective('text', function (exec) {
  for (var _len3 = arguments.length, scopes = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
    scopes[_key3 - 1] = arguments[_key3];
  }

  return watch(exec.js, (val, lastVal) => {
    wrap$1(exec.element).text(val);
  }, scopes);
});
defineDirective('ref', function (exec) {
  for (var _len4 = arguments.length, scopes = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
    scopes[_key4 - 1] = arguments[_key4];
  }

  if (!exec.js.match(regVarName)) {
    throw new Error('Invalid ref name: ' + exec.js);
  }

  var name = getScope(exec.element, [], {
    name: exec.js.trim()
  });
  run("$refs[name] = $el", ...scopes, name);
  return [() => {
    run("delete $refs[name]", ...scopes, name);
  }];
});
defineDirective('model', function (exec) {
  for (var _len5 = arguments.length, scopes = new Array(_len5 > 1 ? _len5 - 1 : 0), _key5 = 1; _key5 < _len5; _key5++) {
    scopes[_key5 - 1] = arguments[_key5];
  }

  var el = exec.element;
  var isContentEditable = el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '');
  var isInput = el instanceof HTMLInputElement && (!el.type || el.type === 'text' || el.type === 'tel') || el instanceof HTMLTextAreaElement || isContentEditable;
  var $el = wrap$1(el);
  var last;

  var change = () => {
    last = !isContentEditable ? $el.val() : $el.html();
    run(exec.js + ' = $$value', ...scopes, getScope(el, exec.subs, {
      $$value: last
    }));
  };

  el.addEventListener(isInput ? 'input' : 'change', change);
  var subs = watch(exec.js, (val, lastVal) => {
    if (isContentEditable) {
      $el.html(val);
    } else {
      $el.val(val);
    }
  }, scopes);
  return [() => exec.element.removeEventListener('input', change), subs];
});
defineDirective('html', function (exec) {
  for (var _len6 = arguments.length, scopes = new Array(_len6 > 1 ? _len6 - 1 : 0), _key6 = 1; _key6 < _len6; _key6++) {
    scopes[_key6 - 1] = arguments[_key6];
  }

  return watch(exec.js, (val, lastVal) => {
    exec.element.innerHTML = '';
    var nestedSubs = [];
    exec.subs.push(nestedSubs);
    unsubNested(walkFindSubs(exec.element));
    var processed = processHtml(val, nestedSubs, defaultDelegateObject, ...scopes);
    exec.element.appendChild(processed.elem);
    processed.run();
  }, scopes);
});
function defineDirective(name, callback) {
  directives[name] = callback;
}

function runDirective(exec) {
  if (directives[exec.directive]) {
    for (var _len7 = arguments.length, scopes = new Array(_len7 > 1 ? _len7 - 1 : 0), _key7 = 1; _key7 < _len7; _key7++) {
      scopes[_key7 - 1] = arguments[_key7];
    }

    return directives[exec.directive](exec, ...scopes);
  }

  return [];
}

function walkerInstance() {
  var execSteps = [];
  return {
    ready: cb => execSteps.push(cb),
    run: () => execSteps.forEach(cb => cb())
  };
}

function processHtml(elem, subs, delegate) {
  var template;
  var exec = walkerInstance();

  for (var _len8 = arguments.length, scopes = new Array(_len8 > 3 ? _len8 - 3 : 0), _key8 = 3; _key8 < _len8; _key8++) {
    scopes[_key8 - 3] = arguments[_key8];
  }

  if (typeof elem === 'string') {
    template = document.createElement('template');
    template.innerHTML = elem;
    walkTree(template.content, subs, exec.ready, delegate, ...scopes);
  } else {
    walkTree(elem, subs, exec.ready, delegate, ...scopes);
  }

  return {
    elem: typeof elem === 'string' ? template.content : elem,
    run: exec.run
  };
}

function unsubNested(subs) {
  if (!subs) return;

  if (typeof subs === 'function') {
    subs();
    return;
  }

  subs.forEach(unsub => {
    if (Array.isArray(unsub)) {
      unsubNested(unsub);
    } else {
      unsub();
    }
  });
  subs.length = 0;
}

function walkTree(element, parentSubs, ready, delegate) {
  for (var _len9 = arguments.length, scopes = new Array(_len9 > 4 ? _len9 - 4 : 0), _key9 = 4; _key9 < _len9; _key9++) {
    scopes[_key9 - 4] = arguments[_key9];
  }

  var pushed = false;
  var currentSubs = getStore(element, 'htmlSubs') || [];

  var pushSubs = () => {
    if (pushed) return;
    getStore(element, 'htmlSubs', currentSubs);
    pushed = true;
    parentSubs.push(currentSubs);
  };

  if (element instanceof Element) {
    var _ret2 = function () {
      if (["OBJECT", "EMBED"].includes(element.tagName)) {
        element.remove();
        return {
          v: void 0
        };
      }

      pushSubs();
      var $element = wrap$1(element);
      element.removeAttribute('x-cloak');

      if (element.hasAttribute('x-if')) {
        var html = element.outerHTML;
        var comment = document.createComment('x-if');
        var ifElem;
        element.before(comment);
        element.remove();
        deleteStore(element, 'htmlSubs');
        ready(() => {
          getStore(comment, 'htmlSubs', currentSubs);
          var nestedSubs = [];
          currentSubs.push(nestedSubs);
          currentSubs.push(watch(element.getAttribute('x-if'), (val, lastVal) => {
            if (val) {
              if (!ifElem) {
                var template = document.createElement('template');
                template.innerHTML = html;
                ifElem = template.content.firstElementChild;
                ifElem.removeAttribute('x-if');
                var processed = processHtml(ifElem, nestedSubs, delegate, ...scopes, getScope(ifElem, nestedSubs));
                comment.after(processed.elem);
                processed.run();
              }
            } else {
              if (ifElem) {
                ifElem.remove();
                ifElem = undefined;
                unsubNested(nestedSubs);
              }
            }
          }, scopes));
        });
        return {
          v: void 0
        };
      }

      if (element.hasAttribute('x-for')) {
        var _html = element.outerHTML;

        var _comment = document.createComment('x-for');

        element.after(_comment);
        element.remove();
        deleteStore(element, 'htmlSubs');
        var items = new Set();
        var exp;
        var at = element.getAttribute('x-for');
        var split = at.split(' in ');

        if (split.length < 2) {
          throw new Error('In valid x-for directive: ' + at);
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
          if (!doubleMatch) throw new Error('In valid x-for directive: ' + at);
          key = doubleMatch[1];
          value = doubleMatch[2];
        }

        ready(() => {
          var del = wrap$1(_comment.parentElement).delegate();
          currentSubs.push(del.off);
          getStore(_comment, 'htmlSubs', currentSubs);
          var nestedSubs = [];
          currentSubs.push(nestedSubs);
          currentSubs.push(watch(exp, (val, lastVal) => {
            unsubNested(nestedSubs);
            items.forEach(item => {
              item.remove();
            });
            items.clear();
            var runs = [];
            val.forEach((item, i) => {
              var forSubs = [];
              nestedSubs.push(forSubs);
              var scope = {
                $index: i
              };
              if (key) scope[key] = i;
              if (value) scope[value] = item;
              var template = document.createElement('template');
              template.innerHTML = _html;
              var elem = template.content.firstElementChild;
              elem.removeAttribute('x-for');
              var processed = processHtml(elem, forSubs, del, ...scopes, getScope(elem, forSubs, scope));

              _comment.before(processed.elem);

              items.add(elem);
              runs.push(processed.run);
            });
            runs.forEach(run => run());
          }, scopes));
        });
        return {
          v: void 0
        };
      }

      if (element.hasAttribute('x-detached')) {
        ready(() => {
          scopes = [getScope(element, currentSubs, {}, true)];
        });
      }

      if (element.hasAttribute('x-data')) {
        ready(() => {
          scopes = [...scopes, getScope(element, currentSubs)];
          scopes = [...scopes, getDataScope(element, run('return ' + (element.getAttribute('x-data') || '{}'), ...scopes))];
        });
      }

      if (element instanceof HTMLScriptElement) {
        if (!element.type || element.type === 'text/javacript') {
          if (element.src) {
            element.remove();
          } else {
            element.type = 'text/sandboxjs';
          }
        }

        if (element.type === 'text/sandboxjs') {
          ready(() => {
            run(element.innerHTML, ...scopes);
          });
        }

        return {
          v: void 0
        };
      } else {
        for (var att of element.attributes) {
          if (att.nodeName.startsWith('on')) {
            element.setAttribute('@' + att.nodeName.slice(2), att.nodeValue);
            element.removeAttribute(att.nodeName);
          } else if (['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from'].includes(att.nodeName) && att.nodeValue !== 'javascript:void(0)') {
            var isJs = att.nodeValue.match(regHrefJS);

            if (isJs) {
              if (att.nodeName === 'href' || att.nodeName === 'xlink:href') {
                if (!element.hasAttribute('@click')) {
                  element.setAttribute('@click', att.nodeValue.substring(isJs[0].length));
                }

                element.setAttribute(att.nodeName, 'javascript:void(0)');
              } else {
                element.removeAttribute(att.nodeName);
              }
            }
          } else if (att.nodeName === 'srcdoc' && element instanceof HTMLIFrameElement) {
            var _html2 = att.nodeValue;
            element.removeAttribute(att.nodeName);

            if (!element.hasAttribute(':srcdoc')) {
              element.setAttribute(':srcdoc', _html2);
            }
          }
        }

        var _loop2 = function _loop2(_att) {
          if (_att.nodeName.startsWith(':')) {
            var _at = _att.nodeName.slice(1);

            ready(() => {
              var nestedSubs = [];
              currentSubs.push(nestedSubs);
              currentSubs.push(watch(_att.nodeValue, (val, lastVal) => {
                if (typeof val === 'object' && ['style', 'class'].includes(_at)) {
                  if (_at === 'class') {
                    $element.toggleClass(val);
                  } else {
                    if (element instanceof HTMLElement || element instanceof SVGElement) {
                      for (var c in val) {
                        element.style[c] = val[c];
                      }
                    }
                  }
                } else if (_at === "srcdoc" && element instanceof HTMLIFrameElement) {
                  var _element$contentWindo;

                  (_element$contentWindo = element.contentWindow.document.querySelector(':root')) === null || _element$contentWindo === void 0 ? void 0 : _element$contentWindo.remove();
                  unsubNested(nestedSubs);
                  var processed = processHtml(val, nestedSubs, delegate, ...scopes, getScope(element, currentSubs));
                  element.contentWindow.document.appendChild(processed.elem);
                  processed.run();
                } else if (!_at.match(regForbiddenAttr)) {
                  $element.attr(_at, val);
                }
              }, scopes));
            });
          } else if (_att.nodeName.startsWith('@')) {
            var parts = _att.nodeName.slice(1).split('.');

            var ev = e => {
              run(_att.nodeValue, ...scopes, getScope(element, currentSubs, {
                $event: e
              }));
            };

            ready(() => {
              if (parts[1] === 'once') {
                currentSubs.push(delegate.one(element, parts[0], ev));
              } else {
                currentSubs.push(delegate.on(element, parts[0], ev));
              }
            });
          } else if (_att.nodeName.startsWith('x-')) {
            ready(() => {
              currentSubs.push(runDirective({
                element,
                directive: _att.nodeName.slice(2),
                js: _att.nodeValue,
                original: element.outerHTML,
                subs: currentSubs
              }, ...scopes, getScope(element, currentSubs)));
            });
          }
        };

        for (var _att of element.attributes) {
          _loop2(_att);
        }
      }
    }();

    if (typeof _ret2 === "object") return _ret2.v;
  }

  var _loop3 = function _loop3(el) {
    if (el instanceof Element) {
      walkTree(el, pushed ? currentSubs : parentSubs, ready, delegate, ...scopes);
    } else if (el.nodeType === 3) {
      var strings = walkText(el.textContent);
      var nodes = [];
      var found = false;
      strings.forEach(s => {
        if (s.startsWith("{{") && s.endsWith("}}")) {
          found = true;
          var placeholder = document.createTextNode("");
          getStore(placeholder, 'htmlSubs', currentSubs);
          pushSubs();
          ready(() => {
            currentSubs.push(watch(s.slice(2, -2), (val, lastVal) => {
              placeholder.textContent = val;
            }, scopes));
          });
          nodes.push(placeholder);
        } else {
          nodes.push(document.createTextNode(s));
        }
      });

      if (found) {
        nodes.forEach(n => {
          el.before(n);
        });
        el.remove();
      }
    }
  };

  for (var el of element.childNodes) {
    _loop3(el);
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
export { Component, ElementCollection$1 as ElementCollection, allowedGlobals, allowedPrototypes, defineComponent, defineDirective, getScopes, run, sandbox, unsubNested, watch, wrap$1 as wrap };
