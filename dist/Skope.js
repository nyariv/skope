function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var Sandbox$1 = {};

(function (exports) {

  Object.defineProperty(exports, '__esModule', {
    value: true
  });
  /**
   * Parse a string as a base-16 number. This is more strict than `parseInt` as it
   * will not allow any other characters, including (for example) "+", "-", and
   * ".".
   * @param hex A string containing a hexadecimal number.
   * @returns The parsed integer, or `NaN` if the string is not a valid hex
   * number.
   */

  function parseHexToInt(hex) {
    const isOnlyHexChars = !hex.match(/[^a-f0-9]/i);
    return isOnlyHexChars ? parseInt(hex, 16) : NaN;
  }
  /**
   * Check the validity and length of a hexadecimal code and optionally enforces
   * a specific number of hex digits.
   * @param hex The string to validate and parse.
   * @param errorName The name of the error message to throw a `SyntaxError` with
   * if `hex` is invalid. This is used to index `errorMessages`.
   * @param enforcedLength If provided, will throw an error if `hex` is not
   * exactly this many characters.
   * @returns The parsed hex number as a normal number.
   * @throws {SyntaxError} If the code is not valid.
   */


  function validateAndParseHex(hex, errorName, enforcedLength) {
    const parsedHex = parseHexToInt(hex);

    if (Number.isNaN(parsedHex) || enforcedLength !== undefined && enforcedLength !== hex.length) {
      throw new SyntaxError(errorName + ': ' + hex);
    }

    return parsedHex;
  }
  /**
   * Parse a two-digit hexadecimal character escape code.
   * @param code The two-digit hexadecimal number that represents the character to
   * output.
   * @returns The single character represented by the code.
   * @throws {SyntaxError} If the code is not valid hex or is not the right
   * length.
   */


  function parseHexadecimalCode(code) {
    const parsedCode = validateAndParseHex(code, 'Malformed Hexadecimal', 2);
    return String.fromCharCode(parsedCode);
  }
  /**
   * Parse a four-digit Unicode character escape code.
   * @param code The four-digit unicode number that represents the character to
   * output.
   * @param surrogateCode Optional four-digit unicode surrogate that represents
   * the other half of the character to output.
   * @returns The single character represented by the code.
   * @throws {SyntaxError} If the codes are not valid hex or are not the right
   * length.
   */


  function parseUnicodeCode(code, surrogateCode) {
    const parsedCode = validateAndParseHex(code, 'Malformed Unicode', 4);

    if (surrogateCode !== undefined) {
      const parsedSurrogateCode = validateAndParseHex(surrogateCode, 'Malformed Unicode', 4);
      return String.fromCharCode(parsedCode, parsedSurrogateCode);
    }

    return String.fromCharCode(parsedCode);
  }
  /**
   * Test if the text is surrounded by curly braces (`{}`).
   * @param text Text to check.
   * @returns `true` if the text is in the form `{*}`.
   */


  function isCurlyBraced(text) {
    return text.charAt(0) === "{" && text.charAt(text.length - 1) === "}";
  }
  /**
   * Parse a Unicode code point character escape code.
   * @param codePoint A unicode escape code point, including the surrounding curly
   * braces.
   * @returns The single character represented by the code.
   * @throws {SyntaxError} If the code is not valid hex or does not have the
   * surrounding curly braces.
   */


  function parseUnicodeCodePointCode(codePoint) {
    if (!isCurlyBraced(codePoint)) {
      throw new SyntaxError('Malformed Unicode: +' + codePoint);
    }

    const withoutBraces = codePoint.slice(1, -1);
    const parsedCode = validateAndParseHex(withoutBraces, 'Malformed Unicode');

    try {
      return String.fromCodePoint(parsedCode);
    } catch (err) {
      throw err instanceof RangeError ? new SyntaxError('Code Point Limit:' + parsedCode) : err;
    }
  }
  /**
   * Map of unescaped letters to their corresponding special JS escape characters.
   * Intentionally does not include characters that map to themselves like "\'".
   */


  const singleCharacterEscapes = new Map([["b", "\b"], ["f", "\f"], ["n", "\n"], ["r", "\r"], ["t", "\t"], ["v", "\v"], ["0", "\0"]]);
  /**
   * Parse a single character escape sequence and return the matching character.
   * If none is matched, defaults to `code`.
   * @param code A single character code.
   */

  function parseSingleCharacterCode(code) {
    return singleCharacterEscapes.get(code) || code;
  }
  /**
   * Matches every escape sequence possible, including invalid ones.
   *
   * All capture groups (described below) are unique (only one will match), except
   * for 4, which can only potentially match if 3 does.
   *
   * **Capture Groups:**
   * 0. A single backslash
   * 1. Hexadecimal code
   * 2. Unicode code point code with surrounding curly braces
   * 3. Unicode escape code with surrogate
   * 4. Surrogate code
   * 5. Unicode escape code without surrogate
   * 6. Octal code _NOTE: includes "0"._
   * 7. A single character (will never be \, x, u, or 0-3)
   */


  const escapeMatch = /\\(?:(\\)|x([\s\S]{0,2})|u(\{[^}]*\}?)|u([\s\S]{4})\\u([^{][\s\S]{0,3})|u([\s\S]{0,4})|([0-3]?[0-7]{1,2})|([\s\S])|$)/g;
  /**
   * Replace raw escape character strings with their escape characters.
   * @param raw A string where escape characters are represented as raw string
   * values like `\'` rather than `'`.
   * @param allowOctals If `true`, will process the now-deprecated octal escape
   * sequences (ie, `\111`).
   * @returns The processed string, with escape characters replaced by their
   * respective actual Unicode characters.
   */

  function unraw(raw) {
    return raw.replace(escapeMatch, function (_, backslash, hex, codePoint, unicodeWithSurrogate, surrogate, unicode, octal, singleCharacter) {
      // Compare groups to undefined because empty strings mean different errors
      // Otherwise, `\u` would fail the same as `\` which is wrong.
      if (backslash !== undefined) {
        return "\\";
      }

      if (hex !== undefined) {
        return parseHexadecimalCode(hex);
      }

      if (codePoint !== undefined) {
        return parseUnicodeCodePointCode(codePoint);
      }

      if (unicodeWithSurrogate !== undefined) {
        return parseUnicodeCode(unicodeWithSurrogate, surrogate);
      }

      if (unicode !== undefined) {
        return parseUnicodeCode(unicode);
      }

      if (octal === "0") {
        return "\0";
      }

      if (octal !== undefined) {
        throw new SyntaxError('Octal Deprecation: ' + octal);
      }

      if (singleCharacter !== undefined) {
        return parseSingleCharacterCode(singleCharacter);
      }

      throw new SyntaxError('End of string');
    });
  }

  let lispTypes = new Map();

  class ParseError extends Error {
    constructor(message, code) {
      super(message + ": " + code.substring(0, 40));
      this.code = code;
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

  const lispArrayKey = {};

  function toLispArray(arr) {
    arr.lisp = lispArrayKey;
    return arr;
  }

  const inlineIfElse = /^:/;
  const elseIf = /^else(?![\w\$])/;
  const ifElse = /^if(?![\w\$])/;
  const space = /^\s/;
  let expectTypes = {
    splitter: {
      types: {
        opHigh: /^(\/|\*\*|\*(?!\*)|\%)(?!\=)/,
        op: /^(\+(?!(\+))|\-(?!(\-)))(?!\=)/,
        comparitor: /^(<=|>=|<(?!<)|>(?!>)|!==|!=(?!\=)|===|==)/,
        boolOp: /^(&&|\|\||instanceof(?![\w\$])|in(?![\w\$]))/,
        bitwise: /^(&(?!&)|\|(?!\|)|\^|<<|>>(?!>)|>>>)(?!\=)/
      },
      next: ['modifier', 'value', 'prop', 'incrementerBefore']
    },
    inlineIf: {
      types: {
        inlineIf: /^\?(?!\.(?!\d))/
      },
      next: ['expEnd']
    },
    assignment: {
      types: {
        assignModify: /^(\-=|\+=|\/=|\*\*=|\*=|%=|\^=|\&=|\|=|>>>=|>>=|<<=)/,
        assign: /^(=)(?!=)/
      },
      next: ['modifier', 'value', 'prop', 'incrementerBefore']
    },
    incrementerBefore: {
      types: {
        incrementerBefore: /^(\+\+|\-\-)/
      },
      next: ['prop']
    },
    expEdge: {
      types: {
        call: /^(\?\.)?[\(]/,
        incrementerAfter: /^(\+\+|\-\-)/
      },
      next: ['splitter', 'expEdge', 'dot', 'inlineIf', 'expEnd']
    },
    modifier: {
      types: {
        not: /^!/,
        inverse: /^~/,
        negative: /^\-(?!\-)/,
        positive: /^\+(?!\+)/,
        typeof: /^typeof(?![\w\$])/,
        delete: /^delete(?![\w\$])/
      },
      next: ['modifier', 'value', 'prop', 'incrementerBefore']
    },
    dot: {
      types: {
        arrayProp: /^(\?\.)?\[/,
        dot: /^(\?)?\.(?=\s*[a-zA-Z\$\_])/
      },
      next: ['splitter', 'assignment', 'expEdge', 'dot', 'inlineIf', 'expEnd']
    },
    prop: {
      types: {
        prop: /^[a-zA-Z\$\_][a-zA-Z\d\$\_]*/
      },
      next: ['splitter', 'assignment', 'expEdge', 'dot', 'inlineIf', 'expEnd']
    },
    value: {
      types: {
        createObject: /^\{/,
        createArray: /^\[/,
        number: /^(0x[\da-f]+(_[\da-f]+)*|(\d+(_\d+)*(\.\d+(_\d+)*)?|\.\d+(_\d+)*))(e[\+\-]?\d+(_\d+)*)?(n)?(?!\d)/i,
        string: /^"(\d+)"/,
        literal: /^`(\d+)`/,
        regex: /^\/(\d+)\/r(?![\w\$])/,
        boolean: /^(true|false)(?![\w\$])/,
        null: /^null(?![\w\$])/,
        und: /^undefined(?![\w\$])/,
        arrowFunctionSingle: /^(async\s+)?([a-zA-Z\$_][a-zA-Z\d\$_]*)\s*=>\s*({)?/,
        arrowFunction: /^(async\s*)?\(\s*((\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*)*)?\s*\)\s*=>\s*({)?/,
        inlineFunction: /^(async\s+)?function(\s*[a-zA-Z\$_][a-zA-Z\d\$_]*)?\s*\(\s*((\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*)*)?\s*\)\s*{/,
        group: /^\(/,
        NaN: /^NaN(?![\w\$])/,
        Infinity: /^Infinity(?![\w\$])/,
        void: /^void(?![\w\$])\s*/,
        await: /^await(?![\w\$])\s*/,
        new: /^new(?![\w\$])\s*/,
        throw: /^throw(?![\w\$])\s*/
      },
      next: ['splitter', 'expEdge', 'dot', 'inlineIf', 'expEnd']
    },
    initialize: {
      types: {
        initialize: /^(var|let|const)\s+([a-zA-Z\$_][a-zA-Z\d\$_]*)\s*(=)?/,
        return: /^return(?![\w\$])/
      },
      next: ['modifier', 'value', 'prop', 'incrementerBefore', 'expEnd']
    },
    spreadObject: {
      types: {
        spreadObject: /^\.\.\./
      },
      next: ['value', 'prop']
    },
    spreadArray: {
      types: {
        spreadArray: /^\.\.\./
      },
      next: ['value', 'prop']
    },
    expEnd: {
      types: {},
      next: []
    },
    expFunction: {
      types: {
        function: /^(async\s+)?function(\s*[a-zA-Z\$_][a-zA-Z\d\$_]*)\s*\(\s*((\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*(\s*,\s*(\.\.\.)?\s*[a-zA-Z\$_][a-zA-Z\d\$_]*)*)?\s*\)\s*{/
      },
      next: ['expEdge', 'expEnd']
    },
    expSingle: {
      types: {
        for: /^(([a-zA-Z\$\_][\w\$]*)\s*:)?\s*for\s*\(/,
        do: /^(([a-zA-Z\$\_][\w\$]*)\s*:)?\s*do(?![\w\$])\s*(\{)?/,
        while: /^(([a-zA-Z\$\_][\w\$]*)\s*:)?\s*while\s*\(/,
        loopAction: /^(break|continue)(?![\w\$])\s*([a-zA-Z\$\_][\w\$]*)?/,
        if: /^((([a-zA-Z\$\_][\w\$]*)\s*:)?\s*)if\s*\(/,
        try: /^try\s*{/,
        block: /^{/,
        switch: /^(([a-zA-Z\$\_][\w\$]*)\s*:)?\s*switch\s*\(/
      },
      next: ['expEnd']
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

  function testMultiple(str, tests) {
    let found;

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      found = test.exec(str);
      if (found) break;
    }

    return found;
  }

  class CodeString {
    constructor(str) {
      this.ref = {
        str: ""
      };

      if (str instanceof CodeString) {
        this.ref = str.ref;
        this.start = str.start;
        this.end = str.end;
      } else {
        this.ref.str = str;
        this.start = 0;
        this.end = str.length;
      }
    }

    substring(start, end) {
      if (!this.length) return this;
      start = this.start + start;

      if (start < 0) {
        start = 0;
      }

      if (start > this.end) {
        start = this.end;
      }

      end = end === undefined ? this.end : this.start + end;

      if (end < 0) {
        end = 0;
      }

      if (end > this.end) {
        end = this.end;
      }

      const code = new CodeString(this);
      code.start = start;
      code.end = end;
      return code;
    }

    get length() {
      const len = this.end - this.start;
      return len < 0 ? 0 : len;
    }

    char(i) {
      if (this.start === this.end) return undefined;
      return this.ref.str[this.start + i];
    }

    toString() {
      return this.ref.str.substring(this.start, this.end);
    }

    trimStart() {
      const found = /^\s+/.exec(this.toString());
      const code = new CodeString(this);

      if (found) {
        code.start += found[0].length;
      }

      return code;
    }

    slice(start, end) {
      if (start < 0) {
        start = this.end - this.start + start;
      }

      if (start < 0) {
        start = 0;
      }

      if (end === undefined) {
        end = this.end - this.start;
      }

      if (end < 0) {
        end = this.end - this.start + end;
      }

      if (end < 0) {
        end = 0;
      }

      return this.substring(start, end);
    }

    trim() {
      const code = this.trimStart();
      const found = /\s+$/.exec(code.toString());

      if (found) {
        code.end -= found[0].length;
      }

      return code;
    }

    valueOf() {
      return this.toString();
    }

  }

  const emptyString = new CodeString("");
  const okFirstChars = /^[\+\-~ !]/;
  const aNumber = expectTypes.value.types.number;
  const wordReg = /^((if|for|else|while|do|function)(?![\w\$])|[\w\$]+)/;
  const semiColon = /^;/;
  const insertedSemicolons = new WeakMap();
  const quoteCache = new WeakMap();

  function restOfExp(constants, part, tests, quote, firstOpening, closingsTests, details = {}) {
    if (!part.length) {
      return part;
    }

    details.words = details.words || [];
    let isStart = true;
    tests = tests || [];
    const hasSemiTest = tests.includes(semiColon);

    if (hasSemiTest) {
      tests = tests.filter(a => a !== semiColon);
    }

    const insertedSemis = insertedSemicolons.get(part.ref) || [];
    const cache = quoteCache.get(part.ref) || new Map();
    quoteCache.set(part.ref, cache);

    if (quote && cache.has(part.start - 1)) {
      return part.substring(0, cache.get(part.start - 1) - part.start);
    }

    let escape = false;
    let done = false;
    let lastChar = "";
    let isOneLiner = false;
    let i;
    let lastInertedSemi = false;

    for (i = 0; i < part.length && !done; i++) {
      let char = part.char(i);

      if (quote === '"' || quote === "'" || quote === "`") {
        if (quote === "`" && char === "$" && part.char(i + 1) === "{" && !escape) {
          let skip = restOfExp(constants, part.substring(i + 2), [], "{");
          i += skip.length + 2;
        } else if (char === quote && !escape) {
          return part.substring(0, i);
        }

        escape = !escape && char === "\\";
      } else if (closings[char]) {
        if (!lastInertedSemi && insertedSemis[i + part.start]) {
          lastInertedSemi = true;

          if (hasSemiTest) {
            break;
          }

          i--;
          lastChar = ';';
          continue;
        }

        if (isOneLiner && char === "{") {
          isOneLiner = false;
        }

        if (char === firstOpening) {
          done = true;
          break;
        } else {
          let skip = restOfExp(constants, part.substring(i + 1), [], char);
          cache.set(skip.start - 1, skip.end);
          i += skip.length + 1;
          isStart = false;

          if (closingsTests) {
            let sub = part.substring(i);
            let found;

            if (found = testMultiple(sub.toString(), closingsTests)) {
              details.regRes = found;
              done = true;
            }
          }
        }
      } else if (!quote) {
        let sub = part.substring(i).toString();
        let foundWord;
        let foundNumber;

        if (closingsTests) {
          let found;

          if (found = testMultiple(sub, closingsTests)) {
            details.regRes = found;
            i++;
            done = true;
            break;
          }
        }

        if (foundNumber = aNumber.exec(sub)) {
          i += foundNumber[0].length - 1;
          sub = part.substring(i).toString();
        } else if (lastChar != char) {
          let found;

          if (char === ';' || insertedSemis[i + part.start] && !isStart && !lastInertedSemi) {
            if (hasSemiTest) {
              found = [";"];
            } else if (insertedSemis[i + part.start]) {
              lastInertedSemi = true;
              i--;
              lastChar = ';';
              continue;
            }

            char = sub = ';';
          } else {
            lastInertedSemi = false;
          }

          if (!found) {
            found = testMultiple(sub, tests);
          }

          if (found) {
            done = true;
          }

          if (!done && (foundWord = wordReg.exec(sub))) {
            isOneLiner = true;

            if (foundWord[0].length > 1) {
              details.words.push(foundWord[1]);
              details.lastAnyWord = foundWord[1];

              if (foundWord[2]) {
                details.lastWord = foundWord[2];
              }
            }

            if (foundWord[0].length > 2) {
              i += foundWord[0].length - 2;
            }
          }
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

      lastChar = char;
    }

    if (quote) {
      throw new SyntaxError("Unclosed '" + quote + "'");
    }

    if (details) {
      details.oneliner = isOneLiner;
    }

    return part.substring(0, i);
  }

  restOfExp.next = ['splitter', 'expEnd', 'inlineIf'];
  const startingExecpted = ['initialize', 'expSingle', 'expFunction', 'value', 'modifier', 'prop', 'incrementerBefore', 'expEnd'];

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
  setLispType(['createArray', 'createObject', 'group', 'arrayProp', 'call'], (constants, type, part, res, expect, ctx) => {
    let extract = emptyString;
    let arg = [];
    let end = false;
    let i = res[0].length;
    const start = i;

    while (i < part.length && !end) {
      extract = restOfExp(constants, part.substring(i), [closingsCreate[type], /^,/]);
      i += extract.length;

      if (extract.length) {
        arg.push(extract);
      }

      if (part.char(i) !== ',') {
        end = true;
      } else {
        i++;
      }
    }

    const next = ['value', 'modifier', 'prop', 'incrementerBefore', 'expEnd'];
    let l;
    let funcFound;

    switch (type) {
      case 'group':
      case 'arrayProp':
        l = lispifyExpr(constants, part.substring(start, i));
        break;

      case 'call':
      case 'createArray':
        // @TODO: support 'empty' values
        l = toLispArray(arg.map(e => lispify(constants, e, [...next, 'spreadArray'])));
        break;

      case 'createObject':
        l = toLispArray(arg.map(str => {
          str = str.trimStart();
          let value;
          let key;
          funcFound = expectTypes.expFunction.types.function.exec('function ' + str);

          if (funcFound) {
            key = funcFound[2].trimStart();
            value = lispify(constants, new CodeString('function ' + str.toString().replace(key, "")));
          } else {
            let extract = restOfExp(constants, str, [/^:/]);
            key = lispify(constants, extract, [...next, 'spreadObject']);

            if (key instanceof Lisp && key.op === 'prop') {
              key = key.b;
            }

            if (extract.length === str.length) return key;
            value = lispify(constants, str.substring(extract.length + 1));
          }

          return new Lisp({
            op: 'keyVal',
            a: key,
            b: value
          });
        }));
        break;
    }

    type = type === 'arrayProp' ? res[1] ? '?prop' : 'prop' : type === 'call' ? res[1] ? '?call' : 'call' : type;
    ctx.lispTree = lispify(constants, part.substring(i + 1), expectTypes[expect].next, new Lisp({
      op: type,
      a: ctx.lispTree,
      b: l
    }));
  });
  setLispType(['inverse', 'not', 'negative', 'positive', 'typeof', 'delete'], (constants, type, part, res, expect, ctx) => {
    let extract = restOfExp(constants, part.substring(res[0].length), [/^([^\s\.\?\w\$]|\?[^\.])/]);
    ctx.lispTree = lispify(constants, part.substring(extract.length + res[0].length), restOfExp.next, new Lisp({
      op: ['positive', 'negative'].includes(type) ? '$' + res[0] : res[0],
      a: ctx.lispTree,
      b: lispify(constants, extract, expectTypes[expect].next)
    }));
  });
  setLispType(['incrementerBefore'], (constants, type, part, res, expect, ctx) => {
    let extract = restOfExp(constants, part.substring(2), [/^[^\s\.\w\$]/]);
    ctx.lispTree = lispify(constants, part.substring(extract.length + 2), restOfExp.next, new Lisp({
      op: res[0] + "$",
      a: lispify(constants, extract, expectTypes[expect].next)
    }));
  });
  setLispType(['incrementerAfter'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = lispify(constants, part.substring(res[0].length), expectTypes[expect].next, new Lisp({
      op: "$" + res[0],
      a: ctx.lispTree
    }));
  });
  setLispType(['assign', 'assignModify', 'boolOp'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = new Lisp({
      op: res[0],
      a: ctx.lispTree,
      b: lispify(constants, part.substring(res[0].length), expectTypes[expect].next)
    });
  });
  setLispType(['opHigh', 'op', 'comparitor', 'bitwise'], (constants, type, part, res, expect, ctx) => {
    const next = [expectTypes.inlineIf.types.inlineIf, inlineIfElse];

    switch (type) {
      case 'opHigh':
        next.push(expectTypes.splitter.types.opHigh);

      case 'op':
        next.push(expectTypes.splitter.types.op);

      case 'comparitor':
        next.push(expectTypes.splitter.types.comparitor);

      case 'bitwise':
        next.push(expectTypes.splitter.types.bitwise);
        next.push(expectTypes.splitter.types.boolOp);
    }

    let extract = restOfExp(constants, part.substring(res[0].length), next);
    ctx.lispTree = lispify(constants, part.substring(extract.length + res[0].length), restOfExp.next, new Lisp({
      op: res[0],
      a: ctx.lispTree,
      b: lispify(constants, extract, expectTypes[expect].next)
    }));
  });
  setLispType(['inlineIf'], (constants, type, part, res, expect, ctx) => {
    let found = false;
    let extract = part.substring(0, 0);
    let quoteCount = 1;

    while (!found && extract.length < part.length) {
      extract.end = restOfExp(constants, part.substring(extract.length + 1), [expectTypes.inlineIf.types.inlineIf, inlineIfElse]).end;

      if (part.char(extract.length) === '?') {
        quoteCount++;
      } else {
        quoteCount--;
      }

      if (!quoteCount) {
        found = true;
      }
    }

    extract.start = part.start + 1;
    ctx.lispTree = new Lisp({
      op: '?',
      a: ctx.lispTree,
      b: new If(lispifyExpr(constants, extract), lispifyExpr(constants, part.substring(res[0].length + extract.length + 1)))
    });
  });

  function extractIfElse(constants, part) {
    var _a;

    let count = 0;
    let found = part.substring(0, 0);
    let foundElse = emptyString;
    let foundTrue;
    let first = true;
    let elseReg;
    let details = {};

    while ((found = restOfExp(constants, part.substring(found.end - part.start), [elseIf, ifElse, semiColon], undefined, undefined, undefined, details)).length || first) {
      first = false;
      const f = part.substring(found.end - part.start).toString();

      if (f.startsWith("if")) {
        found.end++;
        count++;
      } else if (f.startsWith('else')) {
        foundTrue = part.substring(0, found.end - part.start);
        found.end++;
        count--;

        if (!count) {
          found.end--;
        }
      } else if (elseReg = /^;?\s*else(?![\w\$])/.exec(f)) {
        foundTrue = part.substring(0, found.end - part.start);
        found.end += elseReg[0].length - 1;
        count--;

        if (!count) {
          found.end -= elseReg[0].length - 1;
        }
      } else {
        foundTrue = foundElse.length ? foundTrue : part.substring(0, found.end - part.start);
        break;
      }

      if (!count) {
        let ie = extractIfElse(constants, part.substring(found.end - part.start + ((_a = /^;?\s*else(?![\w\$])/.exec(f)) === null || _a === void 0 ? void 0 : _a[0].length)));
        foundElse = ie.all;
        break;
      }

      details = {};
    }

    foundTrue = foundTrue || part.substring(0, found.end - part.start);
    return {
      all: part.substring(0, Math.max(foundTrue.end, foundElse.end) - part.start),
      true: foundTrue,
      false: foundElse
    };
  }

  setLispType(['if'], (constants, type, part, res, expect, ctx) => {
    let condition = restOfExp(constants, part.substring(res[0].length), [], "(");
    const ie = extractIfElse(constants, part.substring(res[1].length));
    /^\s*\{/.exec(part.substring(res[0].length + condition.length + 1).toString());
    const startTrue = res[0].length - res[1].length + condition.length + 1;
    let trueBlock = ie.true.substring(startTrue);
    let elseBlock = ie.false;
    condition = condition.trim();
    trueBlock = trueBlock.trim();
    elseBlock = elseBlock.trim();
    if (trueBlock.char(0) === "{") trueBlock = trueBlock.slice(1, -1);
    if (elseBlock.char(0) === "{") elseBlock = elseBlock.slice(1, -1);
    ctx.lispTree = new Lisp({
      op: 'if',
      a: lispifyExpr(constants, condition),
      b: new If(lispifyBlock(trueBlock, constants), elseBlock.length ? lispifyBlock(elseBlock, constants) : undefined)
    });
  });
  setLispType(['switch'], (constants, type, part, res, expect, ctx) => {
    const test = restOfExp(constants, part.substring(res[0].length), [], "(");
    let start = part.toString().indexOf("{", res[0].length + test.length + 1);
    if (start === -1) throw new SyntaxError("Invalid switch");
    let statement = insertSemicolons(constants, restOfExp(constants, part.substring(start + 1), [], "{"));
    let caseFound;
    const caseTest = /^\s*(case\s|default)\s*/;
    let cases = [];
    let defaultFound = false;

    while (caseFound = caseTest.exec(statement.toString())) {
      if (caseFound[1] === 'default') {
        if (defaultFound) throw new SyntaxError("Only one default switch case allowed");
        defaultFound = true;
      }

      let cond = restOfExp(constants, statement.substring(caseFound[0].length), [/^:/]);
      let found = emptyString;
      let i = start = caseFound[0].length + cond.length + 1;
      let bracketFound = /^\s*\{/.exec(statement.substring(i).toString());
      let exprs = [];

      if (bracketFound) {
        i += bracketFound[0].length;
        found = restOfExp(constants, statement.substring(i), [], "{");
        i += found.length + 1;
        exprs = lispifyBlock(found, constants);
      } else {
        let notEmpty = restOfExp(constants, statement.substring(i), [caseTest]);

        if (!notEmpty.trim().length) {
          exprs = [];
          i += notEmpty.length;
        } else {
          while ((found = restOfExp(constants, statement.substring(i), [semiColon])).length) {
            i += found.length + (statement.char(i + found.length) === ';' ? 1 : 0);

            if (caseTest.test(statement.substring(i).toString())) {
              break;
            }
          }

          exprs = lispifyBlock(statement.substring(start, found.end - statement.start), constants);
        }
      }

      statement = statement.substring(i);
      cases.push(new Lisp({
        op: "case",
        a: caseFound[1] === "default" ? undefined : lispifyExpr(constants, cond),
        b: toLispArray(exprs)
      }));
    }

    ctx.lispTree = new Lisp({
      op: 'switch',
      a: lispifyExpr(constants, test),
      b: toLispArray(cases)
    });
  });
  setLispType(['dot', 'prop'], (constants, type, part, res, expect, ctx) => {
    let prop = res[0];
    let index = res[0].length;
    let op = 'prop';

    if (type === 'dot') {
      if (res[1]) {
        op = '?prop';
      }

      let matches = part.substring(res[0].length).toString().match(expectTypes.prop.types.prop);

      if (matches && matches.length) {
        prop = matches[0];
        index = prop.length + res[0].length;
      } else {
        throw new SyntaxError('Hanging  dot');
      }
    }

    ctx.lispTree = lispify(constants, part.substring(index), expectTypes[expect].next, new Lisp({
      op: op,
      a: ctx.lispTree,
      b: prop
    }));
  });
  setLispType(['spreadArray', 'spreadObject'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = new Lisp({
      op: type,
      b: lispify(constants, part.substring(res[0].length), expectTypes[expect].next)
    });
  });
  setLispType(['return', 'throw'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = new Lisp({
      op: type,
      b: lispifyExpr(constants, part.substring(res[0].length))
    });
  });
  const primitives = {
    "true": true,
    "false": false,
    "null": null,
    Infinity,
    NaN,
    "und": undefined
  };
  setLispType(['number', 'boolean', 'null', 'und', 'NaN', 'Infinity'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = lispify(constants, part.substring(res[0].length), expectTypes[expect].next, type === "number" ? res[10] ? BigInt(res[1]) : Number(res[0]) : primitives[type === "boolean" ? res[0] : type]);
  });
  setLispType(['string', 'literal', 'regex'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = lispify(constants, part.substring(res[0].length), expectTypes[expect].next, new Lisp({
      op: type,
      b: parseInt(JSON.parse(res[1]), 10)
    }));
  });
  setLispType(['initialize'], (constants, type, part, res, expect, ctx) => {
    if (!res[3]) {
      ctx.lispTree = lispify(constants, part.substring(res[0].length), expectTypes[expect].next, new Lisp({
        op: res[1],
        a: res[2]
      }));
    } else {
      ctx.lispTree = new Lisp({
        op: res[1],
        a: res[2],
        b: lispify(constants, part.substring(res[0].length), expectTypes[expect].next)
      });
    }
  });
  setLispType(['function', 'inlineFunction', 'arrowFunction', 'arrowFunctionSingle'], (constants, type, part, res, expect, ctx) => {
    const isArrow = type !== 'function' && type !== 'inlineFunction';
    const isReturn = isArrow && !res[res.length - 1];
    const argPos = isArrow ? 2 : 3;
    const isAsync = !!res[1];
    const args = res[argPos] ? res[argPos].replace(/\s+/g, "").split(/,/g) : [];

    if (!isArrow) {
      args.unshift((res[2] || "").trimStart());
    }

    let ended = false;
    args.forEach(arg => {
      if (ended) throw new SyntaxError('Rest parameter must be last formal parameter');
      if (arg.startsWith('...')) ended = true;
    });
    args.unshift(isAsync);
    const f = restOfExp(constants, part.substring(res[0].length), !isReturn ? [/^}/] : [/^[,\)\}\]]/, semiColon]);
    const func = isReturn ? 'return ' + f : f;
    ctx.lispTree = lispify(constants, part.substring(res[0].length + func.length + 1), expectTypes[expect].next, new Lisp({
      op: isArrow ? 'arrowFunc' : type,
      a: toLispArray(args),
      b: constants.eager ? lispifyFunction(new CodeString(func), constants) : func
    }));
  });
  const iteratorRegex = /^((let|var|const)\s+)?\s*([a-zA-Z\$_][a-zA-Z\d\$_]*)\s+(in|of)(?![\w\$])/;
  setLispType(['for', 'do', 'while'], (constants, type, part, res, expect, ctx) => {
    let i = 0;
    let startStep = true;
    let startInternal = toLispArray([]);
    let getIterator;
    let beforeStep = false;
    let checkFirst = true;
    let condition;
    let step = true;
    let body;

    switch (type) {
      case 'while':
        i = part.toString().indexOf("(") + 1;
        let extract = restOfExp(constants, part.substring(i), [], "(");
        condition = lispifyReturnExpr(constants, extract);
        body = restOfExp(constants, part.substring(i + extract.length + 1)).trim();
        if (body[0] === "{") body = body.slice(1, -1);
        break;

      case 'for':
        i = part.toString().indexOf("(") + 1;
        let args = [];
        let extract2 = emptyString;

        for (let k = 0; k < 3; k++) {
          extract2 = restOfExp(constants, part.substring(i), [/^[;\)]/]);
          args.push(extract2.trim());
          i += extract2.length + 1;
          if (part.char(i - 1) === ")") break;
        }

        let iterator;

        if (args.length === 1 && (iterator = iteratorRegex.exec(args[0].toString()))) {
          if (iterator[4] === 'of') {
            getIterator = lispifyReturnExpr(constants, args[0].substring(iterator[0].length)), startInternal = toLispArray([ofStart2, ofStart3]);
            condition = ofCondition;
            step = ofStep;
            beforeStep = lispify(constants, new CodeString((iterator[1] || 'let ') + iterator[3] + ' = $$next.value'), ['initialize']);
          } else {
            getIterator = lispifyReturnExpr(constants, args[0].substring(iterator[0].length)), startInternal = toLispArray([inStart2, inStart3]);
            step = inStep;
            condition = inCondition;
            beforeStep = lispify(constants, new CodeString((iterator[1] || 'let ') + iterator[3] + ' = $$keys[$$keyIndex]'), ['initialize']);
          }
        } else if (args.length === 3) {
          startStep = lispifyExpr(constants, args.shift(), startingExecpted);
          condition = lispifyReturnExpr(constants, args.shift());
          step = lispifyExpr(constants, args.shift());
        } else {
          throw new SyntaxError("Invalid for loop definition");
        }

        body = restOfExp(constants, part.substring(i)).trim();
        if (body[0] === "{") body = body.slice(1, -1);
        break;

      case 'do':
        checkFirst = false;
        const isBlock = !!res[3];
        body = restOfExp(constants, part.substring(res[0].length), isBlock ? [/^\}/] : [semiColon]);
        condition = lispifyReturnExpr(constants, restOfExp(constants, part.substring(part.toString().indexOf("(", res[0].length + body.length) + 1), [], "("));
        break;
    }

    const a = toLispArray([checkFirst, startInternal, getIterator, startStep, step, condition, beforeStep]);
    ctx.lispTree = new Lisp({
      op: 'loop',
      a,
      b: lispifyBlock(body, constants)
    });
  });
  setLispType(['block'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = lispifyBlock(restOfExp(constants, part.substring(1), [], "{"), constants);
  });
  setLispType(['loopAction'], (constants, type, part, res, expect, ctx) => {
    ctx.lispTree = new Lisp({
      op: 'loopAction',
      a: res[1]
    });
  });
  const catchReg = /^\s*(catch\s*(\(\s*([a-zA-Z\$_][a-zA-Z\d\$_]*)\s*\))?|finally)\s*\{/;
  setLispType(['try'], (constants, type, part, res, expect, ctx) => {
    const body = restOfExp(constants, part.substring(res[0].length), [], "{");
    let catchRes = catchReg.exec(part.substring(res[0].length + body.length + 1).toString());
    let finallyBody;
    let exception;
    let catchBody;
    let offset = 0;

    if (catchRes[1].startsWith('catch')) {
      catchRes = catchReg.exec(part.substring(res[0].length + body.length + 1).toString());
      exception = catchRes[2];
      catchBody = restOfExp(constants, part.substring(res[0].length + body.length + 1 + catchRes[0].length), [], "{");
      offset = res[0].length + body.length + 1 + catchRes[0].length + catchBody.length + 1;

      if ((catchRes = catchReg.exec(part.substring(offset).toString())) && catchRes[1].startsWith('finally')) {
        finallyBody = restOfExp(constants, part.substring(offset + catchRes[0].length), [], "{");
      }
    } else {
      finallyBody = restOfExp(constants, part.substring(res[0].length + body.length + 1 + catchRes[0].length), [], "{");
    }

    const b = toLispArray([exception, lispifyBlock(insertSemicolons(constants, catchBody || emptyString), constants), lispifyBlock(insertSemicolons(constants, finallyBody || emptyString), constants)]);
    ctx.lispTree = new Lisp({
      op: 'try',
      a: lispifyBlock(insertSemicolons(constants, body), constants),
      b
    });
  });
  setLispType(['void', 'await'], (constants, type, part, res, expect, ctx) => {
    const extract = restOfExp(constants, part.substring(res[0].length), [/^([^\s\.\?\w\$]|\?[^\.])/]);
    ctx.lispTree = lispify(constants, part.substring(res[0].length + extract.length), expectTypes[expect].next, new Lisp({
      op: type,
      a: lispify(constants, extract)
    }));
  });
  setLispType(['new'], (constants, type, part, res, expect, ctx) => {
    let i = res[0].length;
    const obj = restOfExp(constants, part.substring(i), [], undefined, "(");
    i += obj.length + 1;
    const args = [];

    if (part.char(i - 1) === "(") {
      const argsString = restOfExp(constants, part.substring(i), [], "(");
      i += argsString.length + 1;
      let found;
      let j = 0;

      while ((found = restOfExp(constants, argsString.substring(j), [/^,/])).length) {
        j += found.length + 1;
        args.push(found.trim());
      }
    }

    ctx.lispTree = lispify(constants, part.substring(i), expectTypes.expEdge.next, new Lisp({
      op: type,
      a: lispify(constants, obj, expectTypes.initialize.next),
      b: toLispArray(args.map(arg => lispify(constants, arg, expectTypes.initialize.next)))
    }));
  });
  const ofStart2 = lispify(undefined, new CodeString('let $$iterator = $$obj[Symbol.iterator]()'), ['initialize']);
  const ofStart3 = lispify(undefined, new CodeString('let $$next = $$iterator.next()'), ['initialize']);
  const ofCondition = lispify(undefined, new CodeString('return !$$next.done'), ['initialize']);
  const ofStep = lispify(undefined, new CodeString('$$next = $$iterator.next()'));
  const inStart2 = lispify(undefined, new CodeString('let $$keys = Object.keys($$obj)'), ['initialize']);
  const inStart3 = lispify(undefined, new CodeString('let $$keyIndex = 0'), ['initialize']);
  const inStep = lispify(undefined, new CodeString('$$keyIndex++'));
  const inCondition = lispify(undefined, new CodeString('return $$keyIndex < $$keys.length'), ['initialize']);
  var lastType;

  function lispify(constants, part, expected, lispTree, topLevel = false) {
    expected = expected || expectTypes.initialize.next;
    if (part === undefined) return lispTree;
    part = part.trimStart();
    const str = part.toString();

    if (!part.length && !expected.includes('expEnd')) {
      throw new SyntaxError("Unexpected end of expression");
    }

    if (!part.length) return lispTree;
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

        if (res = expectTypes[expect].types[type].exec(str)) {
          lastType = type;

          try {
            lispTypes.get(type)(constants, type, part, res, expect, ctx);
          } catch (e) {
            if (topLevel && e instanceof SyntaxError) {
              throw new ParseError(e.message, str);
            }

            throw e;
          }

          break;
        }
      }

      if (res) break;
    }

    if (!res && part.length) {
      `Unexpected token after ${lastType}: ${part.char(0)}`;

      if (topLevel) {
        throw new ParseError(`Unexpected token after ${lastType}: ${part.char(0)}`, str);
      }

      throw new SyntaxError(`Unexpected token after ${lastType}: ${part.char(0)}`);
    }

    return ctx.lispTree;
  }

  const startingExpectedWithoutSingle = startingExecpted.filter(r => r !== 'expSingle');

  function lispifyExpr(constants, str, expected) {
    if (!str.trimStart().length) return undefined;
    let subExpressions = [];
    let sub;
    let pos = 0;
    expected = expected || expectTypes.initialize.next;

    if (expected.includes('expSingle')) {
      if (testMultiple(str.toString(), Object.values(expectTypes.expSingle.types))) {
        return lispify(constants, str, ['expSingle'], undefined, true);
      }
    }

    if (expected === startingExecpted) expected = startingExpectedWithoutSingle;

    while ((sub = restOfExp(constants, str.substring(pos), [/^,/])).length) {
      subExpressions.push(sub.trimStart());
      pos += sub.length + 1;
    }

    if (subExpressions.length === 1) {
      return lispify(constants, str, expected, undefined, true);
    }

    if (expected.includes('initialize')) {
      let defined = expectTypes.initialize.types.initialize.exec(subExpressions[0].toString());

      if (defined) {
        return toLispArray(subExpressions.map((str, i) => lispify(constants, i ? new CodeString(defined[1] + ' ' + str) : str, ['initialize'], undefined, true)));
      } else if (expectTypes.initialize.types.return.exec(subExpressions[0].toString())) {
        return lispify(constants, str, expected, undefined, true);
      }
    }

    const exprs = toLispArray(subExpressions.map((str, i) => lispify(constants, str, expected, undefined, true)));
    return new Lisp({
      op: "multi",
      a: exprs
    });
  }

  function lispifyReturnExpr(constants, str) {
    return new Lisp({
      op: 'return',
      b: lispifyExpr(constants, str)
    });
  }

  function lispifyBlock(str, constants, expression = false) {
    str = insertSemicolons(constants, str);
    if (!str.trim().length) return toLispArray([]);
    let parts = [];
    let part;
    let pos = 0;
    let start = 0;
    let details = {};
    let skipped = false;
    let isInserted = false;

    while ((part = restOfExp(constants, str.substring(pos), [semiColon], undefined, undefined, undefined, details)).length) {
      isInserted = str.char(pos + part.length) && str.char(pos + part.length) !== ';';
      pos += part.length + (isInserted ? 0 : 1);

      if (/^\s*else(?![\w\$])/.test(str.substring(pos).toString())) {
        skipped = true;
      } else if (details.words.includes('do') && /^\s*while(?![\w\$])/.test(str.substring(pos).toString())) {
        skipped = true;
      } else {
        skipped = false;
        parts.push(str.substring(start, pos - (isInserted ? 0 : 1)));
        start = pos;
      }

      details = {};
      if (expression) break;
    }

    if (skipped) {
      parts.push(str.substring(start, pos - (isInserted ? 0 : 1)));
    }

    return toLispArray(parts.map(str => str.trimStart()).filter(str => str.length).map((str, j) => {
      return lispifyExpr(constants, str.trimStart(), startingExecpted);
    }).flat());
  }

  function lispifyFunction(str, constants, expression = false) {
    if (!str.trim().length) return toLispArray([]);
    const tree = lispifyBlock(str, constants, expression);
    let hoisted = toLispArray([]);
    hoist(tree, hoisted);
    return toLispArray(hoisted.concat(tree));
  }

  function hoist(item, res) {
    if (Array.isArray(item)) {
      const rep = [];

      for (let it of item) {
        if (!hoist(it, res)) {
          rep.push(it);
        }
      }

      if (rep.length !== item.length) {
        item.length = 0;
        item.push(...rep);
      }
    } else if (item instanceof Lisp) {
      if (item.op === "try" || item.op === "if" || item.op === "loop" || item.op === "switch") {
        hoist(item.a, res);
        hoist(item.b, res);
      } else if (item.op === "var") {
        res.push(new Lisp({
          op: 'var',
          a: item.a
        }));
      } else if (item.op === "function" && item.a[1]) {
        res.push(item);
        return true;
      }
    }

    return false;
  }

  const closingsNoInsertion = /^(\})\s*(catch|finally|else|while|instanceof)(?![\w\$])/; //  \w|)|] \n \w = 2                                  // \} \w|\{ = 5 

  const colonsRegex = /^((([\w\$\]\)\"\'\`]|\+\+|\-\-)\s*\r?\n\s*([\w\$\+\-\!~]))|(\}\s*[\w\$\!~\+\-\{\(\"\'\`]))/; // if () \w \n; \w              == \w \n \w    | last === if             a
  // if () { }; \w                == \} ^else    | last === if             b
  // if () \w \n; else \n \w \n;  == \w \n \w    | last === else           a
  // if () {} else {}; \w         == \} \w       | last === else           b
  // while () \n \w \n; \w        == \w \n \w    | last === while          a
  // while () { }; \w             == \} \w       | last === while          b
  // do \w \n; while (); \w       == \w \n while | last === do             a
  // do { } while (); \w          == \) \w       | last === while          c
  // try {} catch () {}; \w       == \} \w       | last === catch|finally  b
  // \w \n; \w                    == \w \n \w    | last === none           a
  // cb() \n \w                   == \) \n \w    | last === none           a
  // obj[a] \n \w                 == \] \n \w    | last === none           a
  // {} {}                        == \} \{       | last === none           b

  function insertSemicolons(constants, str) {
    let rest = str;
    let sub = emptyString;
    let details = {};
    const inserted = insertedSemicolons.get(str.ref) || new Array(str.ref.str.length);

    while ((sub = restOfExp(constants, rest, [], undefined, undefined, [colonsRegex], details)).length) {
      let valid = false;
      let part = sub;
      let edge = sub.length;

      if (details.regRes) {
        valid = true;
        const [,, a,,, b] = details.regRes;
        edge = details.regRes[3] === "++" || details.regRes[3] === "--" ? sub.length + 1 : sub.length;
        part = rest.substring(0, edge);

        if (b) {
          let res = closingsNoInsertion.exec(rest.substring(sub.length - 1).toString());

          if (res) {
            if (res[2] === 'while') {
              valid = details.lastWord !== 'do';
            } else {
              valid = false;
            }
          } else if (details.lastWord === 'function' && details.regRes[5][0] === "}" && details.regRes[5].slice(-1) === '(') {
            valid = false;
          }
        } else if (a) {
          if (details.lastWord === 'if' || details.lastWord === 'while' || details.lastWord === 'for' || details.lastWord === 'else') {
            valid = false;
          }
        }
      }

      if (valid) {
        inserted[part.end] = true;
      }

      rest = rest.substring(edge);
      details = {};
    }

    insertedSemicolons.set(str.ref, inserted);
    return str;
  }

  function checkRegex(str) {
    let i = 1;
    let escape = false;
    let done = false;
    let cancel = false;

    while (i < str.length && !done && !cancel) {
      done = str[i] === '/' && !escape;
      escape = str[i] === '\\' && !escape;
      cancel = str[i] === '\n';
      i++;
    }

    let after = str.substring(i);
    cancel = cancel || !done || /^\s*\d/.test(after);
    if (cancel) return null;
    let flags = /^[a-z]*/.exec(after);

    if (/^\s+[\w\$]/.test(str.substring(i + flags[0].length))) {
      return null;
    }

    return {
      regex: str.substring(1, i - 1),
      flags: flags && flags[0] || "",
      length: i + (flags && flags[0].length || 0)
    };
  }

  const notDivide = /(typeof|delete|instanceof|return|in|of|throw|new|void|do|if)$/;
  const possibleDivide = /^([\w\$\]\)]|\+\+|\-\-)[\s\/]/;

  function extractConstants(constants, str, currentEnclosure = "") {
    let quote;
    let extract = [];
    let escape = false;
    let regexFound;
    let comment = "";
    let commentStart = -1;
    let currJs = toLispArray([]);
    let char = "";
    const strRes = [];
    const enclosures = [];
    let isPossibleDivide;

    for (var i = 0; i < str.length; i++) {
      char = str[i];

      if (comment) {
        if (char === comment) {
          if (comment === "*" && str[i + 1] === "/") {
            comment = "";
            i++;
          } else if (comment === "\n") {
            comment = "";
          }
        }
      } else {
        if (escape) {
          escape = false;
          extract.push(char);
          continue;
        }

        if (quote) {
          if (quote === "`" && char === "$" && str[i + 1] === "{") {
            let skip = extractConstants(constants, str.substring(i + 2), "{");
            currJs.push(skip.str);
            extract.push('${', currJs.length - 1, `}`);
            i += skip.length + 2;
          } else if (quote === char) {
            if (quote === '`') {
              constants.literals.push({
                op: 'literal',
                a: unraw(extract.join("")),
                b: currJs
              });
              strRes.push(`\``, constants.literals.length - 1, `\``);
            } else {
              constants.strings.push(unraw(extract.join("")));
              strRes.push(`"`, constants.strings.length - 1, `"`);
            }

            quote = null;
            extract = [];
          } else {
            extract.push(char);
          }
        } else {
          if (char === "'" || char === '"' || char === '`') {
            currJs = toLispArray([]);
            quote = char;
          } else if (closings[currentEnclosure] === char && !enclosures.length) {
            return {
              str: strRes.join(""),
              length: i
            };
          } else if (closings[char]) {
            enclosures.push(char);
            strRes.push(char);
          } else if (closings[enclosures[enclosures.length - 1]] === char) {
            enclosures.pop();
            strRes.push(char);
          } else if (char === "/" && (str[i + 1] === "*" || str[i + 1] === "/")) {
            comment = str[i + 1] === "*" ? "*" : "\n";
            commentStart = i;
          } else if (char === '/' && !isPossibleDivide && (regexFound = checkRegex(str.substring(i)))) {
            constants.regexes.push(regexFound);
            strRes.push(`/`, constants.regexes.length - 1, `/r`);
            i += regexFound.length - 1;
          } else {
            strRes.push(char);
          }

          if (!isPossibleDivide || !space.test(char)) {
            if (isPossibleDivide = possibleDivide.exec(str.substring(i))) {
              if (notDivide.test(str.substring(0, i + isPossibleDivide[1].length))) {
                isPossibleDivide = null;
              }
            }
          }
        }

        escape = quote && char === "\\";
      }
    }

    if (comment) {
      if (comment === "*") {
        throw new SyntaxError(`Unclosed comment '/*': ${str.substring(commentStart)}`);
      }
    }

    return {
      str: strRes.join(""),
      length: i
    };
  }

  function parse(code, eager = false, expression = false) {
    if (typeof code !== 'string') throw new ParseError(`Cannot parse ${code}`, code);
    let str = ' ' + code;
    const constants = {
      strings: [],
      literals: [],
      regexes: [],
      eager
    };
    str = extractConstants(constants, str).str;

    for (let l of constants.literals) {
      l.b = toLispArray(l.b.map(js => lispifyExpr(constants, new CodeString(js))));
    }

    return {
      tree: lispifyFunction(new CodeString(str), constants, expression),
      constants
    };
  }

  class ExecReturn {
    constructor(auditReport, result, returned, breakLoop = false, continueLoop = false) {
      this.auditReport = auditReport;
      this.result = result;
      this.returned = returned;
      this.breakLoop = breakLoop;
      this.continueLoop = continueLoop;
    }

  }

  class Prop {
    constructor(context, prop, isConst = false, isGlobal = false, isVariable = false) {
      this.context = context;
      this.prop = prop;
      this.isConst = isConst;
      this.isGlobal = isGlobal;
      this.isVariable = isVariable;
    }

    get(context) {
      if (this.context === undefined) throw new ReferenceError(`${this.prop} is not defined`);
      context.getSubscriptions.forEach(cb => cb(this.context, this.prop));
      return this.context[this.prop];
    }

  }

  const optional = {};
  const reservedWords = new Set(['instanceof', 'typeof', 'return', 'try', 'catch', 'if', 'finally', 'else', 'in', 'of', 'var', 'let', 'const', 'for', 'delete', 'false', 'true', 'while', 'do', 'break', 'continue', 'new', 'function', 'async', 'await', 'switch', 'case']);
  var VarType;

  (function (VarType) {
    VarType["let"] = "let";
    VarType["const"] = "const";
    VarType["var"] = "var";
  })(VarType || (VarType = {}));

  function keysOnly(obj) {
    const ret = Object.assign({}, obj);

    for (let key in ret) {
      ret[key] = true;
    }

    return ret;
  }

  class Scope {
    constructor(parent, vars = {}, functionThis) {
      this.const = {};
      this.let = {};
      this.var = {};
      const isFuncScope = functionThis !== undefined || parent === null;
      this.parent = parent;
      this.allVars = vars;
      this.let = isFuncScope ? this.let : keysOnly(vars);
      this.var = isFuncScope ? keysOnly(vars) : this.var;
      this.globals = parent === null ? keysOnly(vars) : {};
      this.functionThis = functionThis;
    }

    get(key, functionScope = false) {
      if (key === 'this' && this.functionThis !== undefined) {
        return new Prop({
          this: this.functionThis
        }, key, true, false, true);
      }

      if (reservedWords.has(key)) throw new SyntaxError("Unexepected token '" + key + "'");

      if (this.parent === null || !functionScope || this.functionThis !== undefined) {
        if (this.globals.hasOwnProperty(key)) {
          return new Prop(this.functionThis, key, false, true, true);
        }

        if (key in this.allVars && (!(key in {}) || this.allVars.hasOwnProperty(key))) {
          return new Prop(this.allVars, key, this.const.hasOwnProperty(key), this.globals.hasOwnProperty(key), true);
        }

        if (this.parent === null) {
          return new Prop(undefined, key);
        }
      }

      return this.parent.get(key, functionScope);
    }

    set(key, val) {
      if (key === 'this') throw new SyntaxError('"this" cannot be assigned');
      if (reservedWords.has(key)) throw new SyntaxError("Unexepected token '" + key + "'");
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

      prop.context[prop.prop] = val;
      return prop;
    }

    declare(key, type = null, value = undefined, isGlobal = false) {
      if (key === 'this') throw new SyntaxError('"this" cannot be declared');
      if (reservedWords.has(key)) throw new SyntaxError("Unexepected token '" + key + "'");

      if (type === 'var' && this.functionThis === undefined && this.parent !== null) {
        return this.parent.declare(key, type, value, isGlobal);
      } else if (this[type].hasOwnProperty(key) && type !== 'const' && !this.globals.hasOwnProperty(key) || !(key in this.allVars)) {
        if (isGlobal) {
          this.globals[key] = true;
        }

        this[type][key] = true;
        this.allVars[key] = value;
      } else {
        throw new SandboxError(`Identifier '${key}' has already been declared`);
      }

      return new Prop(this.allVars, key, this.const.hasOwnProperty(key), isGlobal);
    }

  }

  class FunctionScope {}

  class LocalScope {}

  class SandboxError extends Error {}

  let currentTicks;

  function sandboxFunction(context, ticks) {
    return SandboxFunction;

    function SandboxFunction(...params) {
      let code = params.pop() || "";
      let parsed = parse(code);
      return createFunction(params, parsed.tree, ticks || currentTicks, { ...context,
        constants: parsed.constants,
        tree: parsed.tree
      }, undefined, 'anonymous');
    }
  }

  function generateArgs(argNames, args) {
    const vars = {};
    argNames.forEach((arg, i) => {
      if (arg.startsWith('...')) {
        vars[arg.substring(3)] = args.slice(i);
      } else {
        vars[arg] = args[i];
      }
    });
    return vars;
  }

  const sandboxedFunctions = new WeakSet();

  function createFunction(argNames, parsed, ticks, context, scope, name) {
    if (context.ctx.options.forbidFunctionCreation) {
      throw new SandboxError("Function creation is forbidden");
    }

    let func;

    if (name === undefined) {
      func = (...args) => {
        const vars = generateArgs(argNames, args);
        const res = executeTree(ticks, context, parsed, scope === undefined ? [] : [new Scope(scope, vars)]);
        return res.result;
      };
    } else {
      func = function sandboxedObject(...args) {
        const vars = generateArgs(argNames, args);
        const res = executeTree(ticks, context, parsed, scope === undefined ? [] : [new Scope(scope, vars, this)]);
        return res.result;
      };
    }

    context.registerSandboxFunction(func);
    sandboxedFunctions.add(func);
    return func;
  }

  function createFunctionAsync(argNames, parsed, ticks, context, scope, name) {
    var _a;

    if (context.ctx.options.forbidFunctionCreation) {
      throw new SandboxError("Function creation is forbidden");
    }

    if (!((_a = context.ctx.prototypeWhitelist) === null || _a === void 0 ? void 0 : _a.has(Promise.prototype))) {
      throw new SandboxError("Async/await not permitted");
    }

    let func;

    if (name === undefined) {
      func = async (...args) => {
        const vars = generateArgs(argNames, args);
        const res = await executeTreeAsync(ticks, context, parsed, scope === undefined ? [] : [new Scope(scope, vars)]);
        return res.result;
      };
    } else {
      func = async function sandboxedObject(...args) {
        const vars = generateArgs(argNames, args);
        const res = await executeTreeAsync(ticks, context, parsed, scope === undefined ? [] : [new Scope(scope, vars, this)]);
        return res.result;
      };
    }

    context.registerSandboxFunction(func);
    sandboxedFunctions.add(func);
    return func;
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
      return setTimeout(func(handler), ...args);
    };
  }

  function sandboxedSetInterval(func) {
    return function sandboxSetInterval(handler, ...args) {
      if (typeof handler !== 'string') return setInterval(handler, ...args);
      return setInterval(func(handler), ...args);
    };
  }

  function assignCheck(obj, context, op = 'assign') {
    var _a, _b, _c, _d, _e, _f, _g, _h;

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
        (_b = context.changeSubscriptionsGlobal.get(obj.context)) === null || _b === void 0 ? void 0 : _b.forEach(cb => cb({
          type: "delete",
          prop: obj.prop
        }));
      }
    } else if (obj.context.hasOwnProperty(obj.prop)) {
      (_d = (_c = context.setSubscriptions.get(obj.context)) === null || _c === void 0 ? void 0 : _c.get(obj.prop)) === null || _d === void 0 ? void 0 : _d.forEach(cb => cb({
        type: "replace"
      }));
      (_f = (_e = context.setSubscriptionsGlobal.get(obj.context)) === null || _e === void 0 ? void 0 : _e.get(obj.prop)) === null || _f === void 0 ? void 0 : _f.forEach(cb => cb({
        type: "replace"
      }));
    } else {
      (_g = context.changeSubscriptions.get(obj.context)) === null || _g === void 0 ? void 0 : _g.forEach(cb => cb({
        type: "create",
        prop: obj.prop
      }));
      (_h = context.changeSubscriptionsGlobal.get(obj.context)) === null || _h === void 0 ? void 0 : _h.forEach(cb => cb({
        type: "create",
        prop: obj.prop
      }));
    }
  }

  const arrayChange = new Set([[].push, [].pop, [].shift, [].unshift, [].splice, [].reverse, [].sort, [].copyWithin]);
  const literalRegex = /(\$\$)*(\$)?\${(\d+)}/g;
  let ops2 = {
    'prop': (exec, done, ticks, a, b, obj, context, scope) => {
      if (a === null) {
        throw new TypeError(`Cannot get property ${b} of null`);
      }

      const type = typeof a;

      if (type === 'undefined' && obj === undefined) {
        let prop = scope.get(b);

        if (prop.context === context.ctx.sandboxGlobal) {
          if (context.ctx.options.audit) {
            context.ctx.auditReport.globalsAccess.add(b);
          }

          const rep = context.ctx.globalsWhitelist.has(context.ctx.sandboxGlobal[b]) ? context.evals.get(context.ctx.sandboxGlobal[b]) : undefined;

          if (rep) {
            done(undefined, rep);
            return;
          }
        }

        if (prop.context && prop.context[b] === globalThis) {
          done(undefined, context.ctx.globalScope.get('this'));
          return;
        }

        done(undefined, prop);
        return;
      } else if (a === undefined) {
        throw new SandboxError("Cannot get property '" + b + "' of undefined");
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
        done(undefined, new Prop(undefined, b));
        return;
      }

      const isFunction = type === 'function';
      let prototypeAccess = isFunction || !(a.hasOwnProperty(b) || typeof b === 'number');

      if (context.ctx.options.audit && prototypeAccess) {
        if (typeof b === 'string') {
          let prot = Object.getPrototypeOf(a);

          do {
            if (prot.hasOwnProperty(b)) {
              if (!context.ctx.auditReport.prototypeAccess[prot.constructor.name]) {
                context.ctx.auditReport.prototypeAccess[prot.constructor.name] = new Set();
              }

              context.ctx.auditReport.prototypeAccess[prot.constructor.name].add(b);
            }
          } while (prot = Object.getPrototypeOf(prot));
        }
      }

      if (prototypeAccess) {
        if (isFunction) {
          if (!['name', 'length', 'constructor'].includes(b) && a.hasOwnProperty(b)) {
            const whitelist = context.ctx.prototypeWhitelist.get(a.prototype);
            const replace = context.ctx.options.prototypeReplacements.get(a);

            if (replace) {
              done(undefined, new Prop(replace(a, true), b));
              return;
            }

            if (whitelist && (!whitelist.size || whitelist.has(b))) ;else {
              throw new SandboxError(`Static method or property access not permitted: ${a.name}.${b}`);
            }
          }
        } else if (b !== 'constructor') {
          let prot = a;

          while (prot = Object.getPrototypeOf(prot)) {
            if (prot.hasOwnProperty(b)) {
              const whitelist = context.ctx.prototypeWhitelist.get(prot);
              const replace = context.ctx.options.prototypeReplacements.get(prot.constuctor);

              if (replace) {
                done(undefined, new Prop(replace(a, false), b));
                return;
              }

              if (whitelist && (!whitelist.size || whitelist.has(b))) {
                break;
              }

              throw new SandboxError(`Method or property access not permitted: ${prot.constructor.name}.${b}`);
            }
          }
        }
      }

      if (context.evals.has(a[b])) {
        done(undefined, context.evals.get(a[b]));
        return;
      }

      if (a[b] === globalThis) {
        done(undefined, context.ctx.globalScope.get('this'));
        return;
      }

      let g = obj.isGlobal || isFunction && !sandboxedFunctions.has(a) || context.ctx.globalsWhitelist.has(a);
      done(undefined, new Prop(a, b, false, g));
    },
    'call': (exec, done, ticks, a, b, obj, context, scope) => {
      if (context.ctx.options.forbidFunctionCalls) throw new SandboxError("Function invocations are not allowed");

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
      execMany(ticks, exec, toLispArray(args), (err, vals) => {
        var _a, _b;

        if (err) {
          done(err);
          return;
        }

        if (typeof obj === 'function') {
          done(undefined, obj(...vals));
          return;
        }

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

        if (obj.context instanceof Array && arrayChange.has(obj.context[obj.prop]) && (context.changeSubscriptions.get(obj.context) || context.changeSubscriptionsGlobal.get(obj.context))) {
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
            (_b = context.changeSubscriptionsGlobal.get(obj.context)) === null || _b === void 0 ? void 0 : _b.forEach(cb => cb(change));
          }
        }

        obj.get(context);
        done(undefined, obj.context[obj.prop](...vals));
      }, scope, context);
    },
    'createObject': (exec, done, ticks, a, b, obj, context, scope) => {
      let res = {};

      for (let item of b) {
        if (item instanceof SpreadObject) {
          res = { ...res,
            ...item.item
          };
        } else {
          res[item.key] = item.val;
        }
      }

      done(undefined, res);
    },
    'keyVal': (exec, done, ticks, a, b) => done(undefined, new KeyVal(a, b)),
    'createArray': (exec, done, ticks, a, b, obj, context, scope) => {
      const items = b.map(item => {
        if (item instanceof SpreadArray) {
          return [...item.item];
        } else {
          return [item];
        }
      }).flat();
      execMany(ticks, exec, toLispArray(items), done, scope, context);
    },
    'group': (exec, done, ticks, a, b) => done(undefined, b),
    'string': (exec, done, ticks, a, b, obj, context) => done(undefined, context.constants.strings[b]),
    'regex': (exec, done, ticks, a, b, obj, context) => {
      const reg = context.constants.regexes[b];

      if (!context.ctx.globalsWhitelist.has(RegExp)) {
        throw new SandboxError("Regex not permitted");
      } else {
        done(undefined, new RegExp(reg.regex, reg.flags));
      }
    },
    'literal': (exec, done, ticks, a, b, obj, context, scope) => {
      let name = context.constants.literals[b].a;
      let found = toLispArray([]);
      let f;
      let resnums = [];

      while (f = literalRegex.exec(name)) {
        if (!f[2]) {
          found.push(context.constants.literals[b].b[parseInt(f[3], 10)]);
          resnums.push(f[3]);
        }
      }

      execMany(ticks, exec, found, (err, processed) => {
        const reses = {};

        if (err) {
          done(err);
          return;
        }

        for (let i in resnums) {
          const num = resnums[i];
          reses[num] = processed[i];
        }

        done(undefined, name.replace(/(\\\\)*(\\)?\${(\d+)}/g, (match, $$, $, num) => {
          if ($) return match;
          let res = reses[num];
          return ($$ ? $$ : '') + `${valueOrProp(res, context)}`;
        }));
      }, scope, context);
    },
    'spreadArray': (exec, done, ticks, a, b, obj, context, scope) => {
      exec(ticks, b, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        done(undefined, new SpreadArray(res));
      });
    },
    'spreadObject': (exec, done, ticks, a, b, obj, context, scope) => {
      exec(ticks, b, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        done(undefined, new SpreadObject(res));
      });
    },
    '!': (exec, done, ticks, a, b) => done(undefined, !b),
    '~': (exec, done, ticks, a, b) => done(undefined, ~b),
    '++$': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, ++obj.context[obj.prop]);
    },
    '$++': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop]++);
    },
    '--$': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, --obj.context[obj.prop]);
    },
    '$--': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop]--);
    },
    '=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] = b);
    },
    '+=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] += b);
    },
    '-=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] -= b);
    },
    '/=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] /= b);
    },
    '*=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] *= b);
    },
    '**=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] **= b);
    },
    '%=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] %= b);
    },
    '^=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] ^= b);
    },
    '&=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] &= b);
    },
    '|=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] |= b);
    },
    '<<=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] <<= b);
    },
    '>>=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] >>= b);
    },
    '>>>=': (exec, done, ticks, a, b, obj, context) => {
      assignCheck(obj, context);
      done(undefined, obj.context[obj.prop] >>= b);
    },
    '?': (exec, done, ticks, a, b, obj, context, scope) => {
      if (!(b instanceof If)) {
        throw new SyntaxError('Invalid inline if');
      }

      exec(ticks, a, scope, context, (err, res) => {
        if (err) {
          done(err);
        } else {
          exec(ticks, valueOrProp(res, context) ? b.t : b.f, scope, context, done);
        }
      });
    },
    '>': (exec, done, ticks, a, b) => done(undefined, a > b),
    '<': (exec, done, ticks, a, b) => done(undefined, a < b),
    '>=': (exec, done, ticks, a, b) => done(undefined, a >= b),
    '<=': (exec, done, ticks, a, b) => done(undefined, a <= b),
    '==': (exec, done, ticks, a, b) => done(undefined, a == b),
    '===': (exec, done, ticks, a, b) => done(undefined, a === b),
    '!=': (exec, done, ticks, a, b) => done(undefined, a != b),
    '!==': (exec, done, ticks, a, b) => done(undefined, a !== b),
    '&&': (exec, done, ticks, a, b) => done(undefined, a && b),
    '||': (exec, done, ticks, a, b) => done(undefined, a || b),
    '&': (exec, done, ticks, a, b) => done(undefined, a & b),
    '|': (exec, done, ticks, a, b) => done(undefined, a | b),
    ':': (exec, done, ticks, a, b) => done(undefined, new If(a, b)),
    '+': (exec, done, ticks, a, b) => done(undefined, a + b),
    '-': (exec, done, ticks, a, b) => done(undefined, a - b),
    '$+': (exec, done, ticks, a, b) => done(undefined, +b),
    '$-': (exec, done, ticks, a, b) => done(undefined, -b),
    '/': (exec, done, ticks, a, b) => done(undefined, a / b),
    '^': (exec, done, ticks, a, b) => done(undefined, a ^ b),
    '*': (exec, done, ticks, a, b) => done(undefined, a * b),
    '%': (exec, done, ticks, a, b) => done(undefined, a % b),
    '<<': (exec, done, ticks, a, b) => done(undefined, a << b),
    '>>': (exec, done, ticks, a, b) => done(undefined, a >> b),
    '>>>': (exec, done, ticks, a, b) => done(undefined, a >>> b),
    'typeof': (exec, done, ticks, a, b, obj, context, scope) => {
      exec(ticks, b, scope, context, (e, prop) => {
        done(undefined, typeof valueOrProp(prop, context));
      });
    },
    'instanceof': (exec, done, ticks, a, b) => done(undefined, a instanceof b),
    'in': (exec, done, ticks, a, b) => done(undefined, a in b),
    'delete': (exec, done, ticks, a, b, obj, context, scope, bobj) => {
      if (bobj.context === undefined) {
        done(undefined, true);
        return;
      }

      assignCheck(bobj, context, 'delete');

      if (bobj.isVariable) {
        done(undefined, false);
        return;
      }

      done(undefined, delete bobj.context[bobj.prop]);
    },
    'return': (exec, done, ticks, a, b, obj, context) => done(undefined, b),
    'var': (exec, done, ticks, a, b, obj, context, scope, bobj) => {
      exec(ticks, b, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        done(undefined, scope.declare(a, VarType.var, res));
      });
    },
    'let': (exec, done, ticks, a, b, obj, context, scope, bobj) => {
      exec(ticks, b, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        done(undefined, scope.declare(a, VarType.let, res, bobj && bobj.isGlobal));
      });
    },
    'const': (exec, done, ticks, a, b, obj, context, scope, bobj) => {
      exec(ticks, b, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        done(undefined, scope.declare(a, VarType.const, res));
      });
    },
    'arrowFunc': (exec, done, ticks, a, b, obj, context, scope) => {
      a = [...a];

      if (typeof obj.b === "string" || obj.b instanceof CodeString) {
        obj.b = b = lispifyFunction(new CodeString(obj.b), context.constants);
      }

      if (a.shift()) {
        done(undefined, createFunctionAsync(a, b, ticks, context, scope));
      } else {
        done(undefined, createFunction(a, b, ticks, context, scope));
      }
    },
    'function': (exec, done, ticks, a, b, obj, context, scope) => {
      if (typeof obj.b === "string" || obj.b instanceof CodeString) {
        obj.b = b = lispifyFunction(new CodeString(obj.b), context.constants);
      }

      let isAsync = a.shift();
      let name = a.shift();
      let func;

      if (isAsync) {
        func = createFunctionAsync(a, b, ticks, context, scope, name);
      } else {
        func = createFunction(a, b, ticks, context, scope, name);
      }

      if (name) {
        scope.declare(name, VarType.var, func);
      }

      done(undefined, func);
    },
    'inlineFunction': (exec, done, ticks, a, b, obj, context, scope) => {
      if (typeof obj.b === "string" || obj.b instanceof CodeString) {
        obj.b = b = lispifyFunction(new CodeString(obj.b), context.constants);
      }

      let isAsync = a.shift();
      let name = a.shift();

      if (name) {
        scope = new Scope(scope, {});
      }

      let func;

      if (isAsync) {
        func = createFunctionAsync(a, b, ticks, context, scope, name);
      } else {
        func = createFunction(a, b, ticks, context, scope, name);
      }

      if (name) {
        scope.declare(name, VarType.let, func);
      }

      done(undefined, func);
    },
    'loop': (exec, done, ticks, a, b, obj, context, scope) => {
      const [checkFirst, startInternal, getIterator, startStep, step, condition, beforeStep] = a;
      let loop = true;
      const loopScope = new Scope(scope, {});
      let internalVars = {
        '$$obj': undefined
      };
      const interalScope = new Scope(loopScope, internalVars);

      if (exec === execAsync) {
        (async () => {
          let ad;
          ad = asyncDone(d => exec(ticks, startStep, loopScope, context, d));
          internalVars['$$obj'] = (ad = asyncDone(d => exec(ticks, getIterator, loopScope, context, d))).isInstant === true ? ad.instant : (await ad.p).result;
          ad = asyncDone(d => exec(ticks, startInternal, interalScope, context, d));
          if (checkFirst) loop = (ad = asyncDone(d => exec(ticks, condition, interalScope, context, d))).isInstant === true ? ad.instant : (await ad.p).result;

          while (loop) {
            let innerLoopVars = {};
            ad = asyncDone(d => exec(ticks, beforeStep, new Scope(interalScope, innerLoopVars), context, d));
            ad.isInstant === true ? ad.instant : (await ad.p).result;
            let res = await executeTreeAsync(ticks, context, b, [new Scope(loopScope, innerLoopVars)], "loop");

            if (res instanceof ExecReturn && res.returned) {
              done(undefined, res);
              return;
            }

            if (res instanceof ExecReturn && res.breakLoop) {
              break;
            }

            ad = asyncDone(d => exec(ticks, step, interalScope, context, d));
            loop = (ad = asyncDone(d => exec(ticks, condition, interalScope, context, d))).isInstant === true ? ad.instant : (await ad.p).result;
          }

          done();
        })().catch(done);
      } else {
        syncDone(d => exec(ticks, startStep, loopScope, context, d));
        internalVars['$$obj'] = syncDone(d => exec(ticks, getIterator, loopScope, context, d)).result;
        syncDone(d => exec(ticks, startInternal, interalScope, context, d));
        if (checkFirst) loop = syncDone(d => exec(ticks, condition, interalScope, context, d)).result;

        while (loop) {
          let innerLoopVars = {};
          syncDone(d => exec(ticks, beforeStep, new Scope(interalScope, innerLoopVars), context, d));
          let res = executeTree(ticks, context, b, [new Scope(loopScope, innerLoopVars)], "loop");

          if (res instanceof ExecReturn && res.returned) {
            done(undefined, res);
            return;
          }

          if (res instanceof ExecReturn && res.breakLoop) {
            break;
          }

          syncDone(d => exec(ticks, step, interalScope, context, d));
          loop = syncDone(d => exec(ticks, condition, interalScope, context, d)).result;
        }

        done();
      }
    },
    'loopAction': (exec, done, ticks, a, b, obj, context, scope, bobj, inLoopOrSwitch) => {
      if (inLoopOrSwitch === "switch" && a === "continue" || !inLoopOrSwitch) {
        throw new SandboxError("Illegal " + a + " statement");
      }

      done(undefined, new ExecReturn(context.ctx.auditReport, undefined, false, a === "break", a === "continue"));
    },
    'if': (exec, done, ticks, a, b, obj, context, scope, bobj, inLoopOrSwitch) => {
      if (!(b instanceof If)) {
        throw new SyntaxError('Invalid if');
      }

      exec(ticks, a, scope, context, (err, res) => {
        if (err) {
          done(err);
          return;
        }

        executeTreeWithDone(exec, done, ticks, context, valueOrProp(res, context) ? b.t : b.f, [new Scope(scope)], inLoopOrSwitch);
      });
    },
    'switch': (exec, done, ticks, a, b, obj, context, scope) => {
      exec(ticks, a, scope, context, (err, toTest) => {
        if (err) {
          done(err);
          return;
        }

        toTest = valueOrProp(toTest, context);

        if (exec === execSync) {
          let res;
          let isTrue = false;

          for (let caseItem of b) {
            if (isTrue || (isTrue = !caseItem.a || toTest === valueOrProp(syncDone(d => exec(ticks, caseItem.a, scope, context, d)).result, context))) {
              if (!caseItem.b) continue;
              res = executeTree(ticks, context, caseItem.b, [scope], "switch");
              if (res.breakLoop) break;

              if (res.returned) {
                done(undefined, res);
                return;
              }

              if (!caseItem.a) {
                // default case
                break;
              }
            }
          }

          done();
        } else {
          (async () => {
            let res;
            let isTrue = false;

            for (let caseItem of b) {
              let ad;

              if (isTrue || (isTrue = !caseItem.a || toTest === valueOrProp((ad = asyncDone(d => exec(ticks, caseItem.a, scope, context, d))).isInstant === true ? ad.instant : (await ad.p).result, context))) {
                if (!caseItem.b) continue;
                res = await executeTreeAsync(ticks, context, caseItem.b, [scope], "switch");
                if (res.breakLoop) break;

                if (res.returned) {
                  done(undefined, res);
                  return;
                }

                if (!caseItem.a) {
                  // default case
                  break;
                }
              }
            }

            done();
          })().catch(done);
        }
      });
    },
    'try': (exec, done, ticks, a, b, obj, context, scope, bobj, inLoopOrSwitch) => {
      const [exception, catchBody, finallyBody] = b;
      executeTreeWithDone(exec, (err, res) => {
        executeTreeWithDone(exec, e => {
          if (e) done(e);else if (err) {
            let sc = {};
            if (exception) sc[exception] = err;
            executeTreeWithDone(exec, done, ticks, context, catchBody, [new Scope(scope)], inLoopOrSwitch);
          } else {
            done(undefined, res);
          }
        }, ticks, context, finallyBody, [new Scope(scope, {})]);
      }, ticks, context, a, [new Scope(scope)], inLoopOrSwitch);
    },
    'void': (exec, done, ticks, a) => {
      done();
    },
    'new': (exec, done, ticks, a, b, obj, context) => {
      if (!context.ctx.globalsWhitelist.has(a) && !sandboxedFunctions.has(a)) {
        throw new SandboxError(`Object construction not allowed: ${a.constructor.name}`);
      }

      done(undefined, new a(...b));
    },
    'throw': (exec, done, ticks, a, b) => {
      done(b);
    },
    'multi': (exec, done, ticks, a) => done(undefined, a.pop())
  };
  let ops = new Map();

  for (let op in ops2) {
    ops.set(op, ops2[op]);
  }

  function valueOrProp(a, context) {
    if (a instanceof Prop) return a.get(context);
    if (a === optional) return undefined;
    return a;
  }

  function execMany(ticks, exec, tree, done, scope, context, inLoopOrSwitch) {
    if (exec === execSync) {
      _execManySync(ticks, tree, done, scope, context, inLoopOrSwitch);
    } else {
      _execManyAsync(ticks, tree, done, scope, context, inLoopOrSwitch).catch(done);
    }
  }

  function _execManySync(ticks, tree, done, scope, context, inLoopOrSwitch) {
    let ret = [];

    for (let i = 0; i < tree.length; i++) {
      let res;

      try {
        res = syncDone(d => execSync(ticks, tree[i], scope, context, d, inLoopOrSwitch)).result;
      } catch (e) {
        done(e);
        return;
      }

      if (res instanceof ExecReturn && (res.returned || res.breakLoop || res.continueLoop)) {
        done(undefined, res);
        return;
      }

      ret.push(res);
    }

    done(undefined, ret);
  }

  async function _execManyAsync(ticks, tree, done, scope, context, inLoopOrSwitch) {
    let ret = [];

    for (let i = 0; i < tree.length; i++) {
      let res;

      try {
        let ad;
        res = (ad = asyncDone(d => execAsync(ticks, tree[i], scope, context, d, inLoopOrSwitch))).isInstant === true ? ad.instant : (await ad.p).result;
      } catch (e) {
        done(e);
        return;
      }

      if (res instanceof ExecReturn && (res.returned || res.breakLoop || res.continueLoop)) {
        done(undefined, res);
        return;
      }

      ret.push(res);
    }

    done(undefined, ret);
  }

  function asyncDone(callback) {
    let isInstant = false;
    let instant;
    const p = new Promise((resolve, reject) => {
      callback((err, result) => {
        if (err) reject(err);else {
          isInstant = true;
          instant = result;
          resolve({
            result
          });
        }
      });
    });
    return {
      isInstant,
      instant,
      p
    };
  }

  function syncDone(callback) {
    let result;
    let err;
    callback((e, r) => {
      err = e;
      result = r;
    });
    if (err) throw err;
    return {
      result
    };
  }

  async function execAsync(ticks, tree, scope, context, doneOriginal, inLoopOrSwitch) {
    let done = doneOriginal;
    const p = new Promise(resolve => {
      done = (e, r) => {
        doneOriginal(e, r);
        resolve();
      };
    });
    if (_execNoneRecurse(ticks, tree, scope, context, done, true, inLoopOrSwitch)) ;else if (tree instanceof Lisp) {
      let obj;

      try {
        let ad;
        obj = (ad = asyncDone(d => execAsync(ticks, tree.a, scope, context, d, inLoopOrSwitch))).isInstant === true ? ad.instant : (await ad.p).result;
      } catch (e) {
        done(e);
        return;
      }

      let a = obj;

      try {
        a = obj instanceof Prop ? obj.get(context) : obj;
      } catch (e) {
        done(e);
        return;
      }

      let op = tree.op;

      if (op === '?prop' || op === '?call') {
        if (a === undefined || a === null) {
          done(undefined, optional);
          return;
        }

        op = op.slice(1);
      }

      if (a === optional) {
        if (op === 'prop' || op === 'call') {
          done(undefined, a);
          return;
        } else {
          a = undefined;
        }
      }

      let bobj;

      try {
        let ad;
        bobj = (ad = asyncDone(d => execAsync(ticks, tree.b, scope, context, d, inLoopOrSwitch))).isInstant === true ? ad.instant : (await ad.p).result;
      } catch (e) {
        done(e);
        return;
      }

      let b = bobj;

      try {
        b = bobj instanceof Prop ? bobj.get(context) : bobj;
      } catch (e) {
        done(e);
        return;
      }

      if (b === optional) {
        b = undefined;
      }

      if (ops.has(op)) {
        try {
          ops.get(op)(execAsync, done, ticks, a, b, obj, context, scope, bobj, inLoopOrSwitch);
        } catch (err) {
          done(err);
        }
      } else {
        done(new SyntaxError('Unknown operator: ' + op));
      }
    }
    await p;
  }

  function execSync(ticks, tree, scope, context, done, inLoopOrSwitch) {
    if (_execNoneRecurse(ticks, tree, scope, context, done, false, inLoopOrSwitch)) ;else if (tree instanceof Lisp) {
      let obj;

      try {
        obj = syncDone(d => execSync(ticks, tree.a, scope, context, d, inLoopOrSwitch)).result;
      } catch (e) {
        done(e);
        return;
      }

      let a = obj;

      try {
        a = obj instanceof Prop ? obj.get(context) : obj;
      } catch (e) {
        done(e);
        return;
      }

      let op = tree.op;

      if (op === '?prop' || op === '?call') {
        if (a === undefined || a === null) {
          done(undefined, optional);
          return;
        }

        op = op.slice(1);
      }

      if (a === optional) {
        if (op === 'prop' || op === 'call') {
          done(undefined, a);
          return;
        } else {
          a = undefined;
        }
      }

      let bobj;

      try {
        bobj = syncDone(d => execSync(ticks, tree.b, scope, context, d, inLoopOrSwitch)).result;
      } catch (e) {
        done(e);
        return;
      }

      let b = bobj;

      try {
        b = bobj instanceof Prop ? bobj.get(context) : bobj;
      } catch (e) {
        done(e);
        return;
      }

      if (b === optional) {
        b = undefined;
      }

      if (ops.has(op)) {
        try {
          ops.get(op)(execSync, done, ticks, a, b, obj, context, scope, bobj, inLoopOrSwitch);
        } catch (err) {
          done(err);
        }
      } else {
        done(new SyntaxError('Unknown operator: ' + op));
      }
    }
  }

  const unexecTypes = new Set(['arrowFunc', 'function', 'inlineFunction', 'loop', 'try', 'switch', 'if', '?', 'typeof']);

  function _execNoneRecurse(ticks, tree, scope, context, done, isAsync, inLoopOrSwitch) {
    var _a;

    const exec = isAsync ? execAsync : execSync;

    if (context.ctx.options.executionQuota <= ticks.ticks) {
      if (typeof context.ctx.options.onExecutionQuotaReached === 'function' && context.ctx.options.onExecutionQuotaReached(ticks, scope, context, tree)) ;else {
        done(new SandboxError("Execution quota exceeded"));
        return;
      }
    }

    ticks.ticks++;
    currentTicks = ticks;

    if (tree instanceof Prop) {
      try {
        done(undefined, tree.get(context));
      } catch (err) {
        done(err);
      }
    } else if (tree === optional) {
      done();
    } else if (Array.isArray(tree) && tree.lisp === lispArrayKey) {
      execMany(ticks, exec, tree, done, scope, context, inLoopOrSwitch);
    } else if (!(tree instanceof Lisp)) {
      done(undefined, tree);
    } else if (tree.op === 'await') {
      if (!isAsync) {
        done(new SandboxError("Illegal use of 'await', must be inside async function"));
      } else if ((_a = context.ctx.prototypeWhitelist) === null || _a === void 0 ? void 0 : _a.has(Promise.prototype)) {
        execAsync(ticks, tree.a, scope, context, async (e, r) => {
          if (e) done(e);else try {
            done(undefined, await valueOrProp(r, context));
          } catch (err) {
            done(err);
          }
        }, inLoopOrSwitch).catch(done);
      } else {
        done(new SandboxError('Async/await is not permitted'));
      }
    } else if (unexecTypes.has(tree.op)) {
      try {
        ops.get(tree.op)(exec, done, ticks, tree.a, tree.b, tree, context, scope, undefined, inLoopOrSwitch);
      } catch (err) {
        done(err);
      }
    } else {
      return false;
    }

    return true;
  }

  function executeTree(ticks, context, executionTree, scopes = [], inLoopOrSwitch) {
    return syncDone(done => executeTreeWithDone(execSync, done, ticks, context, executionTree, scopes, inLoopOrSwitch)).result;
  }

  async function executeTreeAsync(ticks, context, executionTree, scopes = [], inLoopOrSwitch) {
    let ad;
    return (ad = asyncDone(done => executeTreeWithDone(execAsync, done, ticks, context, executionTree, scopes, inLoopOrSwitch))).isInstant === true ? ad.instant : (await ad.p).result;
  }

  function executeTreeWithDone(exec, done, ticks, context, executionTree, scopes = [], inLoopOrSwitch) {
    if (!executionTree) {
      done();
      return;
    }

    if (!(executionTree instanceof Array)) {
      throw new SyntaxError('Bad execution tree');
    }

    let scope = context.ctx.globalScope;
    let s;

    while (s = scopes.shift()) {
      if (typeof s !== "object") continue;

      if (s instanceof Scope) {
        scope = s;
      } else {
        scope = new Scope(scope, s, s instanceof LocalScope ? undefined : null);
      }
    }

    if (context.ctx.options.audit && !context.ctx.auditReport) {
      context.ctx.auditReport = {
        globalsAccess: new Set(),
        prototypeAccess: {}
      };
    }

    if (exec === execSync) {
      _executeWithDoneSync(done, ticks, context, executionTree, scope, inLoopOrSwitch);
    } else {
      _executeWithDoneAsync(done, ticks, context, executionTree, scope, inLoopOrSwitch).catch(done);
    }
  }

  function _executeWithDoneSync(done, ticks, context, executionTree, scope, inLoopOrSwitch) {
    if (!(executionTree instanceof Array)) throw new SyntaxError('Bad execution tree');
    let i = 0;

    for (i = 0; i < executionTree.length; i++) {
      let res;
      let err;
      const current = executionTree[i];

      try {
        execSync(ticks, current, scope, context, (e, r) => {
          err = e;
          res = r;
        }, inLoopOrSwitch);
      } catch (e) {
        err = e;
      }

      if (err) {
        done(err);
        return;
      }

      if (res instanceof ExecReturn) {
        done(undefined, res);
        return;
      }

      if (current instanceof Lisp && current.op === 'return') {
        done(undefined, new ExecReturn(context.ctx.auditReport, res, true));
        return;
      }
    }

    done(undefined, new ExecReturn(context.ctx.auditReport, undefined, false));
  }

  async function _executeWithDoneAsync(done, ticks, context, executionTree, scope, inLoopOrSwitch) {
    if (!(executionTree instanceof Array)) throw new SyntaxError('Bad execution tree');
    let i = 0;

    for (i = 0; i < executionTree.length; i++) {
      let res;
      let err;
      const current = executionTree[i];

      try {
        await execAsync(ticks, current, scope, context, (e, r) => {
          err = e;
          res = r;
        }, inLoopOrSwitch);
      } catch (e) {
        err = e;
      }

      if (err) {
        done(err);
        return;
      }

      if (res instanceof ExecReturn) {
        done(undefined, res);
        return;
      }

      if (current instanceof Lisp && current.op === 'return') {
        done(undefined, new ExecReturn(context.ctx.auditReport, res, true));
        return;
      }
    }

    done(undefined, new ExecReturn(context.ctx.auditReport, undefined, false));
  }

  class SandboxGlobal {
    constructor(globals) {
      if (globals === globalThis) return globalThis;

      for (let i in globals) {
        this[i] = globals[i];
      }
    }

  }

  class ExecContext {
    constructor(ctx, constants, tree, getSubscriptions, setSubscriptions, changeSubscriptions, setSubscriptionsGlobal, changeSubscriptionsGlobal, evals, registerSandboxFunction) {
      this.ctx = ctx;
      this.constants = constants;
      this.tree = tree;
      this.getSubscriptions = getSubscriptions;
      this.setSubscriptions = setSubscriptions;
      this.changeSubscriptions = changeSubscriptions;
      this.setSubscriptionsGlobal = setSubscriptionsGlobal;
      this.changeSubscriptionsGlobal = changeSubscriptionsGlobal;
      this.evals = evals;
      this.registerSandboxFunction = registerSandboxFunction;
    }

  }

  function subscribeSet(obj, name, callback, context) {
    const names = context.setSubscriptions.get(obj) || new Map();
    context.setSubscriptions.set(obj, names);
    const callbacks = names.get(name) || new Set();
    names.set(name, callbacks);
    callbacks.add(callback);
    let changeCbs;

    if (obj && obj[name] && typeof obj[name] === "object") {
      changeCbs = context.changeSubscriptions.get(obj[name]) || new Set();
      changeCbs.add(callback);
      context.changeSubscriptions.set(obj[name], changeCbs);
    }

    return {
      unsubscribe: () => {
        callbacks.delete(callback);
        changeCbs === null || changeCbs === void 0 ? void 0 : changeCbs.delete(callback);
      }
    };
  }

  class Sandbox {
    constructor(options) {
      this.setSubscriptions = new WeakMap();
      this.changeSubscriptions = new WeakMap();
      this.sandboxFunctions = new WeakMap();
      options = Object.assign({
        audit: false,
        forbidFunctionCalls: false,
        forbidFunctionCreation: false,
        globals: Sandbox.SAFE_GLOBALS,
        prototypeWhitelist: Sandbox.SAFE_PROTOTYPES,
        prototypeReplacements: new Map()
      }, options || {});
      const sandboxGlobal = new SandboxGlobal(options.globals);
      this.context = {
        sandbox: this,
        globalsWhitelist: new Set(Object.values(options.globals)),
        prototypeWhitelist: new Map([...options.prototypeWhitelist].map(a => [a[0].prototype, a[1]])),
        options,
        globalScope: new Scope(null, options.globals, sandboxGlobal),
        sandboxGlobal
      };
      this.context.prototypeWhitelist.set(Object.getPrototypeOf([][Symbol.iterator]()), new Set());
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
        BigInt,
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
        Math,
        Date,
        RegExp
      };
    }

    static get SAFE_PROTOTYPES() {
      let protos = [SandboxGlobal, Function, Boolean, Number, BigInt, String, Date, Error, Array, Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, Map, Set, WeakMap, WeakSet, Promise, Symbol, Date, RegExp];
      let map = new Map();
      protos.forEach(proto => {
        map.set(proto, new Set());
      });
      map.set(Object, new Set(['entries', 'fromEntries', 'getOwnPropertyNames', 'is', 'keys', 'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString', 'toString', 'valueOf', 'values']));
      return map;
    }

    subscribeGet(callback, context) {
      context.getSubscriptions.add(callback);
      return {
        unsubscribe: () => context.getSubscriptions.delete(callback)
      };
    }

    subscribeSet(obj, name, callback, context) {
      return subscribeSet(obj, name, callback, context);
    }

    subscribeSetGlobal(obj, name, callback) {
      return subscribeSet(obj, name, callback, this);
    }

    static audit(code, scopes = []) {
      const globals = {};

      for (let i of Object.getOwnPropertyNames(globalThis)) {
        globals[i] = globalThis[i];
      }

      const sandbox = new Sandbox({
        globals,
        audit: true
      });
      return sandbox.executeTree(sandbox.createContext(sandbox.context, parse(code)), scopes);
    }

    static parse(code) {
      return parse(code);
    }

    createContext(context, executionTree) {
      const evals = new Map();
      const execContext = new ExecContext(context, executionTree.constants, executionTree.tree, new Set(), new WeakMap(), new WeakMap(), this.setSubscriptions, this.changeSubscriptions, evals, fn => this.sandboxFunctions.set(fn, execContext));
      const func = sandboxFunction(execContext);
      evals.set(Function, func);
      evals.set(eval, sandboxedEval(func));
      evals.set(setTimeout, sandboxedSetTimeout(func));
      evals.set(setInterval, sandboxedSetInterval(func));
      return execContext;
    }

    getContext(fn) {
      return this.sandboxFunctions.get(fn);
    }

    executeTree(context, scopes = []) {
      return executeTree({
        ticks: BigInt(0)
      }, context, context.tree, scopes);
    }

    executeTreeAsync(context, scopes = []) {
      return executeTreeAsync({
        ticks: BigInt(0)
      }, context, context.tree, scopes);
    }

    compile(code, optimize = false) {
      const parsed = parse(code, optimize);

      const exec = (...scopes) => {
        const context = this.createContext(this.context, parsed);
        return {
          context,
          run: () => this.executeTree(context, [...scopes]).result
        };
      };

      return exec;
    }

    compileAsync(code, optimize = false) {
      const parsed = parse(code, optimize);

      const exec = (...scopes) => {
        const context = this.createContext(this.context, parsed);
        return {
          context,
          run: async () => (await this.executeTreeAsync(context, [...scopes])).result
        };
      };

      return exec;
    }

    compileExpression(code, optimize = false) {
      const parsed = parse(code, optimize, true);

      const exec = (...scopes) => {
        const context = this.createContext(this.context, parsed);
        return {
          context,
          run: () => this.executeTree(context, [...scopes]).result
        };
      };

      return exec;
    }

    compileExpressionAsync(code, optimize = false) {
      const parsed = parse(code, optimize, true);

      const exec = (...scopes) => {
        const context = this.createContext(this.context, parsed);
        return {
          context,
          run: async () => (await this.executeTreeAsync(context, [...scopes])).result
        };
      };

      return exec;
    }

  }

  exports.ExecContext = ExecContext;
  exports.FunctionScope = FunctionScope;
  exports.LocalScope = LocalScope;
  exports.SandboxGlobal = SandboxGlobal;
  exports.assignCheck = assignCheck;
  exports.asyncDone = asyncDone;
  exports['default'] = Sandbox;
  exports.execAsync = execAsync;
  exports.execMany = execMany;
  exports.execSync = execSync;
  exports.executeTree = executeTree;
  exports.executeTreeAsync = executeTreeAsync;
  exports.executionOps = ops;
  exports.expectTypes = expectTypes;
  exports.setLispType = setLispType;
  exports.syncDone = syncDone;
})(Sandbox$1);

var Sandbox = /*@__PURE__*/getDefaultExportFromCjs(Sandbox$1);

var regHrefJS = /^\s*javascript\s*:/i;
var regValidSrc = /^((https?:)?\/\/|\.?\/|#)/;
var regSystemAtt = /^(:|@|\$|s-)/;
var regRservedSystemAtt = /^skope-/;
var defaultHTMLWhiteList = [HTMLBRElement, HTMLBodyElement, HTMLDListElement, HTMLDataElement, HTMLDataListElement, HTMLDivElement, HTMLFieldSetElement, HTMLFormElement, HTMLHRElement, HTMLHeadingElement, HTMLLIElement, HTMLLegendElement, HTMLMapElement, HTMLMetaElement, HTMLMeterElement, HTMLModElement, HTMLOListElement, HTMLOutputElement, HTMLParagraphElement, HTMLPreElement, HTMLProgressElement, HTMLQuoteElement, HTMLSpanElement, HTMLTableCaptionElement, HTMLTableCellElement, HTMLTableColElement, HTMLTableElement, HTMLTableSectionElement, HTMLTableRowElement, HTMLTimeElement, HTMLTitleElement, HTMLUListElement, HTMLUnknownElement, HTMLTemplateElement, HTMLCanvasElement, HTMLElement];
var globalAllowedAtttributes = new Set(['id', 'class', 'style', 'alt', 'role', 'aria-label', 'aria-labelledby', 'aria-hidden', 'tabindex', 'title', 'dir', 'lang', 'height', 'width', 'slot']);
function sanitizeType(obj, t, allowedAttributes, element) {
  var s = new Set(allowedAttributes);

  for (var type of t) {
    obj.types.set(type, {
      attributes: s,
      element
    });
  }
}
var reservedAtrributes = new WeakMap();
class HTMLSanitizer {
  constructor() {
    this.types = new Map();
    this.srcAttributes = new Set(['action', 'href', 'xlink:href', 'formaction', 'manifest', 'poster', 'src', 'from']);
    this.allowedInputs = new Set(['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'month', 'number', 'password', 'radio', 'range', 'reset', 'tel', 'text', 'time', 'url', 'week']);
    sanitizeType(this, defaultHTMLWhiteList, [], () => true);
    sanitizeType(this, [HTMLAnchorElement, HTMLAreaElement], ['href', 'xlink:href', 'rel', 'shape', 'coords'], el => true);
    sanitizeType(this, [HTMLButtonElement], ['type', 'value'], el => {
      if (el.type !== 'reset' && el.type !== 'button') {
        el.type = 'button';
      }

      return true;
    });
    sanitizeType(this, [HTMLInputElement, HTMLSelectElement, HTMLOptGroupElement, HTMLOptionElement, HTMLLabelElement, HTMLTextAreaElement], ['value', 'type', 'checked', 'selected', 'name', 'for', 'max', 'min', 'placeholder', 'readonly', 'size', 'multiple', 'step', 'autocomplete', 'cols', 'rows', 'maxlength', 'disabled', 'required', 'accept', 'list'], el => true);
    sanitizeType(this, [HTMLScriptElement], ['type'], (el, staticHtml) => {
      if (!el.type || el.type === 'text/javascript') {
        el.type = 'skopejs';
        var html = el.innerHTML;
        el.innerHTML = '';
        setTimeout(() => {
          el.innerHTML = html;
        });
      }

      return !staticHtml && el.type === 'skopejs';
    });
    sanitizeType(this, [HTMLIFrameElement], [], el => {
      if (!el.getAttribute('skope-iframe-content')) {
        this.setAttributeForced(el, 'skope-iframe-content', el.innerHTML);
      }

      el.innerHTML = '';
      return !el.src && !el.srcdoc;
    });
    sanitizeType(this, [HTMLStyleElement], [], (el, staticHtml) => {
      if (staticHtml) return false;
      return true;
    });
    sanitizeType(this, [HTMLPictureElement, HTMLImageElement, HTMLAudioElement, HTMLTrackElement, HTMLVideoElement, HTMLSourceElement], ['src', 'srcset', 'sizes', 'poster', 'autoplay', 'contorls', 'muted', 'loop', 'volume', 'loading'], el => true);
  }

  santizeAttribute(element, attName, attValue) {
    var preprocess = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var remove = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    var allowed = this.types.get(element.constructor);
    if (!allowed) return false;
    attName = attName.toLowerCase();

    if (this.isAttributeForced(element, attName)) {
      if (remove) {
        return false;
      }
    } else if (attName.match(regSystemAtt) || attName === 'skope') {
      if (!preprocess) return false;
    } else if (/^on[a-z]+$/.test(attName)) {
      if (preprocess) {
        element.setAttribute("@".concat(attName.slice(2)), attValue);
      }

      return false;
    } else if (allowed.attributes.has(attName) && this.srcAttributes.has(attName) && attValue !== 'javascript:void(0)') {
      var isJs = attValue.match(regHrefJS);

      if (isJs) {
        if (preprocess && (attName === 'href' || attName === 'xlink:href')) {
          if (!element.hasAttribute('@click')) {
            element.setAttribute('@click', attValue.substring(isJs[0].length));
          }
        } else {
          return false;
        }
      } else if (!attValue.match(regValidSrc)) {
        return false;
      }
    } else if (!preprocess && element instanceof HTMLScriptElement) {
      return false;
    } else if (!allowed.attributes.has(attName) && !globalAllowedAtttributes.has(attName)) {
      return false;
    } else if (element instanceof HTMLInputElement && attName === 'type') {
      return this.allowedInputs.has(attValue);
    } else if (element instanceof HTMLButtonElement && attName === 'type') {
      return attValue === 'reset' || attValue === 'button';
    }

    return true;
  }

  sanitizeHTML(element) {
    var staticHtml = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (!(element instanceof DocumentFragment)) {
      var allowed = this.types.get(element.constructor);

      if (!allowed || !allowed.element(element, staticHtml)) {
        element.remove();
        return;
      }

      for (var att of [...element.attributes]) {
        var attValue = att.nodeValue;
        var attName = att.nodeName;

        if (!this.santizeAttribute(element, attName, attValue, !staticHtml) || staticHtml && ['id', 'style'].includes(attName)) {
          element.removeAttribute(att.nodeName);
        }
      }
    }

    if (element.children) {
      var children = element instanceof HTMLTemplateElement ? element.content.children : element.children;

      for (var el of [...children]) {
        this.sanitizeHTML(el, staticHtml);
      }
    }
  }

  isAttributeForced(elem, att) {
    var _reservedAtrributes$g;

    return ((_reservedAtrributes$g = reservedAtrributes.get(elem)) === null || _reservedAtrributes$g === void 0 ? void 0 : _reservedAtrributes$g.has(att)) || regRservedSystemAtt.test(att) && elem.hasAttribute(att);
  }

  setAttributeForced(elem, att, value) {
    var reserved = reservedAtrributes.get(elem);

    if (!reserved) {
      reserved = new Set();
      reservedAtrributes.set(elem, reserved);
    }

    reserved.add(att);
    elem.setAttribute(att, value);
  }

  observeAttribute(parent, att, cb, staticHtml) {
    var persistant = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    var subs = new Set();
    var selector = "[".concat(att, "]:not([").concat(att, "] [").concat(att, "])");

    var sanitize = elem => {
      if (staticHtml) {
        for (var el of elem.children) {
          this.sanitizeHTML(el, staticHtml);
        }
      } else {
        this.sanitizeHTML(elem, staticHtml);
      }
    };

    var observeLoad = (elem, sHtml) => new Promise(resolve => {
      sanitize(elem);
      var observer = new MutationObserver(muts => {
        for (var mut of muts) {
          for (var target of mut.addedNodes) {
            if (target instanceof Element) {
              this.sanitizeHTML(target, sHtml);
            }
          }
        }
      });
      document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'loading') {
          setTimeout(() => {
            sub();
            resolve(elem);
          });
        }
      });
      observer.observe(elem, {
        childList: true,
        subtree: true
      });

      var sub = () => {
        observer.disconnect();
        subs.delete(sub);
      };

      subs.add(sub);
    });

    var matches = elem => elem.matches(selector);

    var loading = false;

    if (document.readyState === 'loading' || persistant) {
      loading = true;
      var found = new WeakSet();

      var isFound = elem => {
        if (!elem || elem === parent) return false;
        if (found.has(elem)) return true;
        return isFound(elem.parentElement);
      };

      var observer = new MutationObserver(muts => {
        for (var mut of muts) {
          for (var elem of mut.addedNodes) {
            if (elem instanceof Element) {
              if (loading) {
                if (!isFound(elem) && matches(elem)) {
                  found.add(elem);
                  observeLoad(elem, staticHtml).then(el => {
                    cb(el);
                  });
                } else {
                  for (var el of elem.querySelectorAll(selector)) {
                    if (!isFound(el)) {
                      found.add(el);
                      observeLoad(el, staticHtml).then(ell => {
                        cb(ell);
                      });
                    }
                  }
                }
              } else if (matches(elem)) {
                sanitize(elem);
                cb(elem);
              } else {
                for (var _el of elem.querySelectorAll(selector)) {
                  sanitize(elem);
                  cb(_el);
                }
              }
            }
          }
        }
      });

      if (!persistant) {
        document.addEventListener('readystatechange', () => {
          if (document.readyState !== 'loading') {
            setTimeout(() => {
              loading = false;
              sub();
            });
          }
        });
      }

      observer.observe(parent, {
        childList: true,
        subtree: true
      });

      var sub = () => {
        observer.disconnect();
        subs.delete(sub);
      };

      subs.add(sub);
    }

    if (matches(parent)) {
      sanitize(parent);
      cb(parent);
    } else {
      for (var el of parent.querySelectorAll(selector)) {
        sanitize(el);
        cb(el);
      }
    }

    return {
      cancel() {
        for (var _sub of subs) {
          _sub();
        }
      }

    };
  }

}

var regVarName = /^\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*$/;
var regKeyValName = /^\s*\(([a-zA-Z$_][a-zA-Z$_\d]*)\s*,\s*([a-zA-Z$_][a-zA-Z$_\d]*)\s*\)$/;
function isObject(object) {
  return object !== null && typeof object === 'object';
}
function isIterable(x) {
  return x && typeof x === 'object' && Symbol.iterator in x;
}
var varSubsStore = new WeakMap();
function createVarSubs(skope, context) {
  var varSubs = {};

  varSubs.subscribeGet = callback => skope.sandbox.subscribeGet(callback, context);

  varSubs.subscribeSet = (obj, name, callback) => skope.sandbox.subscribeSet(obj, name, callback, context);

  return varSubs;
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
function createErrorCb(el) {
  return err => createError(err === null || err === void 0 ? void 0 : err.message, el);
}
function createError(msg, el) {
  var err = new Error(msg);
  err.element = el;
  console.error(err, el);
  return err;
}

function getRootScope(skope, scopes) {
  for (var i = scopes.length - 1; i >= 0; i--) {
    if (scopes[i] instanceof skope.RootScope) {
      return scopes[i];
    }
  }

  return undefined;
}
function getRootElement(skope, scopes) {
  var _getRootScope;

  return (_getRootScope = getRootScope(skope, scopes)) === null || _getRootScope === void 0 ? void 0 : _getRootScope.$el.get(0);
}
function getScope(skope, element, subs) {
  var vars = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};
  var root = arguments.length > 4 ? arguments[4] : undefined;
  var scope = skope.getStore(element, 'scope');

  if (root) {
    scope = skope.getStore(element, 'rootScope');
  }

  if (!scope) {
    skope.getStore(element, 'currentSubs', subs);

    if (root) {
      scope = skope.getStore(element, 'rootScope', new skope.RootScope(element));
      skope.getStore(element, 'scope', scope);
    } else {
      scope = skope.getStore(element, 'scope', new skope.ElementScope(element));
    }

    subs.push(() => {
      scope.$el = null;
      skope.deleteStore(element, 'currentSubs');
      skope.deleteStore(element, 'scope');
      skope.deleteStore(element, 'rootScope');
    });
  }

  Object.assign(scope, vars);
  return scope;
}
function getScopes(skope, element) {
  var subs = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var newScope = arguments.length > 3 ? arguments[3] : undefined;
  if (!element) return [];
  var scope = newScope === undefined ? skope.getStore(element, 'scope') : getScope(skope, element, subs, newScope);
  var scopes = skope.getStore(element, 'scopes') || [];

  if (scopes.length) {
    return [...scopes, scope];
  }

  if (scope) scopes.push(scope);
  return [...(element.hasAttribute('s-detached') ? [] : getScopes(skope, element.parentElement)), ...scopes];
}
function pushScope(skope, scopes, elem, sub, vars) {
  var scope = getScope(skope, elem, sub, vars);
  if (scope === scopes[scopes.length - 1]) return [...scopes];
  return [...scopes, scope];
}

function watchRun(skope, el, scopes, code) {
  try {
    var exec = skope.exec(getRootElement(skope, scopes), "return ".concat(code), scopes);
    varSubsStore.set(exec.run, createVarSubs(skope, exec.context));
    return exec.run;
  } catch (err) {
    createError(err.message, el);

    var r = () => {};

    varSubsStore.set(r, {
      subscribeGet() {
        return {
          unsubscribe() {}

        };
      },

      subscribeSet() {
        return {
          unsubscribe() {}

        };
      }

    });
    return r;
  }
}
function watch(skope, elem, toWatch, handler, errorCb) {
  var watchGets = new Map();
  var subUnsubs = [];
  var varSubs = varSubsStore.get(toWatch);

  if (!varSubs) {
    var context = skope.sandbox.getContext(toWatch);

    if (!context) {
      createError('Non-sandbox watch callback', elem);
      return subUnsubs;
    }

    varSubs = createVarSubs(skope, context);
  }

  var lastVal;
  var update = false;
  var start = Date.now();
  var count = 0;
  var lastPromise;
  var ignore = new WeakMap();

  var digest = () => {
    var _varSubs;

    if (Date.now() - start > 4000) {
      count = 0;
      start = Date.now();
    } else if (count++ > 200) {
      createError('Too many digests', elem);
      return;
    }

    unsubNested(subUnsubs);
    var g = (_varSubs = varSubs) === null || _varSubs === void 0 ? void 0 : _varSubs.subscribeGet((obj, name) => {
      if (obj === undefined) return;
      var list = watchGets.get(obj) || new Set();
      list.add(name);
      watchGets.set(obj, list);
    });
    var val;

    try {
      val = toWatch();
    } catch (err) {
      g.unsubscribe();
      createError(err === null || err === void 0 ? void 0 : err.message, elem);
      return;
    }

    g.unsubscribe();

    var _loop = function _loop(item) {
      var obj = item[0];

      var _loop3 = function _loop3(name) {
        var _varSubs2;

        subUnsubs.push((_varSubs2 = varSubs) === null || _varSubs2 === void 0 ? void 0 : _varSubs2.subscribeSet(obj, name, () => {
          var names = ignore.get(obj);

          if (!names) {
            names = new Set();
            ignore.set(obj, names);
          }

          names.add(name);
        }).unsubscribe);
      };

      for (var name of item[1]) {
        _loop3(name);
      }
    };

    for (var item of watchGets) {
      _loop(item);
    }

    var _loop2 = function _loop2(_item) {
      var obj = _item[0];

      var _loop4 = function _loop4(name) {
        subUnsubs.push(skope.sandbox.subscribeSetGlobal(obj, name, mod => {
          var _ignore$get;

          if ((_ignore$get = ignore.get(obj)) !== null && _ignore$get !== void 0 && _ignore$get.has(name)) {
            ignore.get(obj).delete(name);
            return;
          }

          if (update) return;
          update = true;
          skope.call(() => {
            update = false;
            digest();
          });
        }).unsubscribe);
      };

      for (var name of _item[1]) {
        _loop4(name);
      }
    };

    for (var _item of watchGets) {
      _loop2(_item);
    }

    watchGets.clear();
    var promise = Promise.resolve(!errorCb ? undefined : val);
    lastPromise = promise;
    promise.then(v => {
      if (lastPromise !== promise) return;
      v = !errorCb ? val : v;

      if (v !== lastVal) {
        var temp = lastVal;
        lastVal = v;

        try {
          handler(v, temp);
        } catch (err) {
          createError(err === null || err === void 0 ? void 0 : err.message, elem);
        }
      }
    }, errorCb);
  };

  digest();
  return subUnsubs;
}

function eventDirective(skope, element, att, currentSubs, ready, delegate) {
  var _transitionParts$;

  var transitionParts = att.nodeName.split('$');
  var parts = transitionParts[0].slice(1).split('.');
  var debouce = /^debounce(\((\d+)\))?$/.exec(parts[1] || '');
  var throttle = /^throttle(\((\d+)\))?$/.exec(parts[1] || '');
  var queue = /^queue(\((\d+)\))?$/.exec(parts[1] || '');

  if (parts[1] && !(debouce || throttle || queue || parts[1] === 'once')) {
    createError("Invalid event directive: ".concat(parts[1]), att);
    return;
  }

  var transitionVar = (_transitionParts$ = transitionParts[1]) === null || _transitionParts$ === void 0 ? void 0 : _transitionParts$.replace(/-([\w$])/g, (match, letter) => letter.toUpperCase());

  if (transitionVar) {
    if (!regVarName.test(transitionVar)) {
      createError('Invalid variable name in attribute', att);
      return;
    }
  }

  ready(scopes => {
    if (transitionVar) {
      skope.exec(getRootElement(skope, scopes), "if (typeof ".concat(transitionVar, " === 'undefined') var ").concat(transitionVar), scopes).run();
    }

    var trans;

    var evCb = e => {
      trans = skope.execAsync(getRootElement(skope, scopes), att.nodeValue, pushScope(skope, scopes, element, currentSubs, {
        $event: e
      })).run();
      trans.catch(() => {});

      if (transitionVar) {
        skope.exec(getRootElement(skope, scopes), "".concat(transitionVar, " = trans"), pushScope(skope, scopes, element, currentSubs, {
          trans
        })).run();
      }
    };

    var ev = evCb;

    if (debouce) {
      var timer = null;

      ev = e => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          evCb(e);
        }, Number(debouce[2] || 250));
      };
    }

    if (throttle) {
      if (throttle[2] === undefined) {
        var cont = false;

        ev = e => {
          if (cont || !trans) {
            cont = false;
            evCb(e);
            trans.then(() => cont = true, () => cont = true);
          }
        };
      } else {
        var eobj;
        var _timer = null;

        ev = e => {
          eobj = e;
          if (_timer !== null) return;
          _timer = setTimeout(() => {
            _timer = null;
            evCb(eobj);
          }, Number(throttle[2]));
        };
      }
    }

    if (queue) {
      var count = 0;
      var q = Promise.resolve();

      ev = e => {
        if (!queue[2] || Number(queue[2]) > count) {
          count++;
          q = q.then(() => {
            evCb(e);
            return trans;
          }).catch(() => {}).then(() => count--);
        }
      };
    }

    if (parts[1] === 'once') {
      currentSubs.push(delegate.one(element, parts[0], ev));
    } else {
      currentSubs.push(delegate.on(element, parts[0], ev));
    }
  });
}

function ifDirective(skope, element, att, currentSubs, ready, delegate) {
  var comment = document.createComment('s-if');
  var ifElem;
  var at = element.getAttribute('s-if');
  element.before(comment);
  element.remove();
  skope.deleteStore(element, 'currentSubs');
  ready(scopes => {
    skope.getStore(comment, 'currentSubs', currentSubs);
    var nestedSubs = [];
    currentSubs.push(nestedSubs);

    try {
      currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, at), (val, lastVal) => {
        if (val) {
          if (!ifElem) {
            ifElem = element.cloneNode(true);
            ifElem.removeAttribute('s-if');
            var processed = skope.processHTML(skope, ifElem, nestedSubs, delegate);
            comment.after(processed.elem);
            processed.run(pushScope(skope, scopes, ifElem, nestedSubs));
          }
        } else if (ifElem) {
          ifElem.remove();
          ifElem = undefined;
          unsubNested(nestedSubs);
        }
      }, err => {
        if (ifElem) {
          ifElem.remove();
          ifElem = undefined;
          unsubNested(nestedSubs);
        }
      }));
    } catch (err) {
      createError(err.message, att);
    }
  });
}

function forDirective(skope, element, att, currentSubs, ready) {
  var comment = document.createComment('s-for');
  element.after(comment);
  element.remove();
  skope.deleteStore(element, 'currentSubs');
  var items = new Set();
  var at = element.getAttribute('s-for');
  var split = at.split(' in ');

  if (split.length < 2) {
    createError('In valid s-for directive', att);
    return;
  }

  var exp = split.slice(1).join(' in ');
  var varsExp = split[0];
  var key;
  var value;
  var match;
  var varMatch = varsExp.match(regVarName);

  if (varMatch) {
    [match, value] = varMatch;
  } else {
    [match, key, value] = varsExp.match(regKeyValName);

    if (!match) {
      createError('In valid s-for directive', att);
      return;
    }
  }

  ready(scopes => {
    var del = skope.wrapElem(comment.parentElement).delegate();
    currentSubs.push(del.off);
    var nestedSubs = [];
    currentSubs.push(nestedSubs);
    currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, exp), val => {
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
        elem.removeAttribute('s-for');
        var processed = skope.processHTML(skope, elem, forSubs, del);
        comment.before(processed.elem);
        items.add(elem);
        runs.push(() => processed.run(pushScope(skope, scopes, elem, forSubs, scope)));
      };

      var i = -1;

      if (isIterable(val)) {
        for (var item of val) {
          i++;
          repeat(item, i);
        }
      } else if (isObject(val)) {
        for (var j in val) {
          repeat(val[j], j);
        }
      }

      runs.forEach(run => run());
    }, () => {
      unsubNested(nestedSubs);
      items.forEach(item => {
        item.remove();
      });
      items.clear();
    }));
  });
}

function variableDirective(skope, element, att, currentSubs, ready, delegate, flags) {
  var name = att.nodeName.substring(1).replace(/-([\w$])/g, (match, letter) => letter.toUpperCase());

  if (!name.match(regVarName)) {
    createError('Invalid variable name in attribute', att);
    return ready;
  }

  if (!flags.elementScopeAdded) {
    flags.elementScopeAdded = true;
    var execSteps = [];
    ready(s => {
      var scopes = pushScope(skope, s, element, currentSubs);

      for (var cb of execSteps) {
        cb(scopes);
      }
    });

    ready = cb => execSteps.push(cb);
  }

  ready(scopes => {
    skope.execAsync(getRootElement(skope, scopes), "let ".concat(name, " = ").concat(att.nodeValue), scopes).run().catch(createErrorCb(att));
  });
  return ready;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);

    if (enumerableOnly) {
      symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      });
    }

    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function detachedDirective(skope, element, att, currentSubs, ready, delegate, flags) {
  var nestedScopes;
  var execSteps = [];
  ready(scopes => {
    nestedScopes = [getScope(skope, element, currentSubs, {}, true)];

    if (flags.elementScopeAdded) {
      nestedScopes[0].$templates = _objectSpread2({}, scopes[scopes.length - 1].$templates || {});
      delete scopes[scopes.length - 1].$templates;
      nestedScopes.push(scopes[scopes.length - 1]);
    }

    for (var cb of execSteps) {
      cb(nestedScopes);
    }
  });

  ready = cb => execSteps.push(cb);

  return ready;
}

function attributeDirective(skope, element, att, currentSubs, ready, delegate) {
  var at = att.nodeName.slice(1);
  var parts = at.split('.');
  ready(scopes => {
    var $element = skope.wrapElem(element);
    currentSubs.push(skope.watch(att, watchRun(skope, att, scopes, att.nodeValue), (val, lastVal) => {
      if (typeof val === 'object' && ['style', 'class'].includes(at)) {
        Object.entries(val).forEach(a => Promise.resolve(a[1]).then(v => {
          if (at === 'class') {
            $element.toggleClass(a[0], !!v);
          } else if (element instanceof HTMLElement || element instanceof SVGElement) {
            element.style[a[0]] = v;
          }
        }, () => {
          if (at === 'class') {
            $element.toggleClass(a[0], false);
          }
        }));
      } else if (parts.length === 2 && ['style', 'class'].includes(parts[0])) {
        if (parts[0] === 'class') {
          $element.toggleClass(parts[1], !!val);
        } else if (element instanceof HTMLElement || element instanceof SVGElement) {
          element.style[parts[1]] = val;
        }
      } else {
        $element.attr(at, "".concat(val));
      }
    }, () => {}));
  });
}

function walkerInstance() {
  var execSteps = [];
  return {
    ready: cb => execSteps.push(cb),
    run: function runNested(scopes) {
      execSteps.forEach(cb => cb(scopes));
      execSteps.length = 0;
    }
  };
}

function runDirective(skope, exec, scopes) {
  var dir = skope.directives[exec.directive];

  if (dir) {
    return dir(exec, scopes);
  }

  return [];
}

var closings = {
  '(': ')',
  '{': '}',
  '[': ']'
};
var quotes = ["'", '"', '`'];
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
        } else if (!escape && quote === '`' && char === '$' && next === '{') {
          var strs = walkText(s.substring(i + 2), '}');
          i += strs[0].length + 2;
        }
      } else if (quotes.includes(char)) {
        quote = char;
      } else if (closing) {
        if (closings[closing] === char) {
          closing = null;
        }
      } else if (closings[char]) {
        closing = char;
      } else if (char === endJs) {
        strings.push(s.substring(start, i));
        return strings;
      } else if (char === '}' && next === '}') {
        strings.push(s.substring(start, i + 2));
        inJs = false;
        i += 1;
        start = i + 1;
      }
    } else if (char === '{' && next === '{') {
      inJs = true;

      if (start !== i) {
        strings.push(s.substring(start, i));
      }

      start = i;
      i += 1;
    }
  }

  if (start !== i && start < s.length) {
    strings.push(s.substring(start, i));
  }

  return strings.filter(Boolean);
}
function walkTree(skope, element, parentSubs, ready, delegate, skipFirst) {
  var currentSubs = [];
  parentSubs.push(currentSubs);

  var walkNested = () => {
    var execSteps = [];

    var r = cb => execSteps.push(cb);

    var _loop = function _loop(el) {
      if (el instanceof Element) {
        walkTree(skope, el, currentSubs, r, delegate, false);
      } else if (el.nodeType === 3) {
        var strings = walkText(el.textContent);
        var nodes = [];
        var found = false;

        var _loop2 = function _loop2(s) {
          if (s.startsWith('{{') && s.endsWith('}}')) {
            skope.getStore(el, 'currentSubs', currentSubs);
            found = true;
            var placeholder = document.createTextNode('');
            ready(scopes => {
              currentSubs.push(skope.watch(element, watchRun(skope, el, scopes, s.slice(2, -2)), (val, lastVal) => {
                placeholder.textContent = "".concat(val);
              }, err => {
                placeholder.textContent = '';
              }));
              return scopes;
            });
            nodes.push(placeholder);
          } else {
            nodes.push(document.createTextNode(s));
          }
        };

        for (var s of strings) {
          _loop2(s);
        }

        if (found) {
          nodes.forEach(n => {
            el.before(n);
          });
          el.remove();
        }
      }
    };

    for (var el of [...element.childNodes]) {
      _loop(el);
    }

    ready(scopes => {
      for (var cb of execSteps) {
        cb(scopes);
      }
    });
  };

  if (skipFirst) {
    walkNested();
    return;
  }

  if (element instanceof Element) {
    if (element instanceof HTMLTemplateElement) {
      return;
    }

    if (element instanceof HTMLStyleElement) {
      var loaded = () => {
        var parent = element.parentElement;
        if (!parent) return;

        if (!skope.sanitizer.isAttributeForced(parent, 'skope-style')) {
          parent.removeAttribute('skope-style');
        }

        var id = parent.getAttribute('skope-style') || ++skope.styleIds;
        skope.sanitizer.setAttributeForced(parent, 'skope-style', "".concat(id));
        var i = element.sheet.cssRules.length - 1;

        for (var rule of [...element.sheet.cssRules].reverse()) {
          if (!(rule instanceof CSSStyleRule || rule instanceof CSSKeyframesRule)) {
            element.sheet.deleteRule(i);
          }

          i--;
        }

        i = 0;

        for (var _rule of [...element.sheet.cssRules]) {
          if (_rule instanceof CSSStyleRule) {
            var {
              cssText
            } = _rule.style;
            element.sheet.deleteRule(i);
            element.sheet.insertRule("[skope-style=\"".concat(id, "\"] :is(").concat(_rule.selectorText, ") { ").concat(cssText, " }"), i);
          }

          i++;
        }
      };

      if (element.sheet && element.parentElement) {
        loaded();
      } else {
        element.addEventListener('load', loaded);
      }

      return;
    }

    skope.getStore(element, 'currentSubs', parentSubs);
    element.removeAttribute('s-cloak');

    if (element.hasAttribute('s-if')) {
      ifDirective(skope, element, element.getAttributeNode('s-if'), currentSubs, ready, delegate);
      return;
    }

    if (element.hasAttribute('s-for')) {
      forDirective(skope, element, element.getAttributeNode('s-for'), currentSubs, ready);
      return;
    }

    if (element.hasAttribute('s-component')) {
      ready(scopes => {
        try {
          currentSubs.push(runDirective(skope, {
            element,
            att: element.getAttributeNode('s-component'),
            directive: 'component',
            js: '',
            original: element.outerHTML,
            subs: currentSubs,
            delegate
          }, scopes));
        } catch (err) {
          createError(err.message, element);
        }
      });
      return;
    }

    var flags = {
      elementScopeAdded: false
    };

    for (var att of element.attributes) {
      if (att.nodeName.startsWith('$')) {
        ready = variableDirective(skope, element, att, currentSubs, ready, delegate, flags);
      }
    }

    if (element.hasAttribute('s-detached')) {
      ready = detachedDirective(skope, element, element.getAttributeNode('s-detached'), currentSubs, ready, delegate, flags);
    }

    if (element instanceof HTMLIFrameElement && element.hasAttribute('skope-iframe-content')) {
      ready(() => {
        var exec = () => {
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

    if (element instanceof HTMLScriptElement) {
      if (element.type === 'skopejs') {
        ready(scopes => {
          try {
            skope.exec(getRootElement(skope, scopes), element.innerHTML, scopes).run();
          } catch (err) {
            createError(err === null || err === void 0 ? void 0 : err.message, element);
          }
        });
      } else {
        element.remove();
      }

      return;
    }

    var _loop3 = function _loop3(_att) {
      if (_att.nodeName.startsWith(':')) {
        attributeDirective(skope, element, _att, currentSubs, ready);
      } else if (_att.nodeName.startsWith('@')) {
        eventDirective(skope, element, _att, currentSubs, ready, delegate);
      } else if (_att.nodeName.startsWith('s-')) {
        try {
          ready(scopes => {
            currentSubs.push(runDirective(skope, {
              element,
              att: _att,
              directive: _att.nodeName.slice(2),
              js: _att.nodeValue,
              original: element.outerHTML,
              subs: currentSubs,
              delegate
            }, pushScope(skope, scopes, element, currentSubs)));
          });
        } catch (err) {
          createError(err.message, _att);
        }
      }
    };

    for (var _att of element.attributes) {
      _loop3(_att);
    }
  }

  if (!(element instanceof Element && element.hasAttribute('s-static'))) {
    walkNested();
  }
}

var elementStorage = new WeakMap();
function ownerDoc(coll) {
  var _coll$get;

  return (_coll$get = coll.get(0)) === null || _coll$get === void 0 ? void 0 : _coll$get.ownerDocument;
}
function createClass(sanitizer) {
  var arrs = new WeakMap();

  function arr(coll) {
    return arrs.get(coll) || [];
  }

  var defaultDelegateObject = {
    on(elem, event, callback) {
      var $el = wrap(elem, elem.ownerDocument);
      $el.on(event, callback);
      return () => $el.off(event, callback);
    },

    one(elem, event, callback) {
      var $el = wrap(elem, elem.ownerDocument);
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

    get length() {
      return arr(this).length;
    }

    get $elements() {
      return [...arr(this)];
    }

    [Symbol.iterator]() {
      return this.$elements[Symbol.iterator]();
    }

    forEach(cb) {
      this.$elements.forEach(cb);
    }

    map(cb) {
      return this.$elements.map(cb);
    }

    filter(selector) {
      return filter(this, selector);
    }

    some(cb) {
      return this.$elements.some(cb);
    }

    every(cb) {
      return this.$elements.every(cb);
    }

    slice(start, end) {
      return new ElementCollection(...arr(this).slice(start, end));
    }

    sort(callback) {
      if (!callback) {
        arr(this).sort((a, b) => {
          if (a === b) return 0;

          if (Math.floor(a.compareDocumentPosition(b) / 2)) {
            return 1;
          }

          return -1;
        });
      } else {
        var sorted = this.$elements.sort(callback);
        arrs.set(this, sorted);
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

      var sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      return this.some(elem => sel.has(elem));
    }

    not(selector) {
      if (typeof selector === 'string') {
        return filter(this, (elem, i) => !elem.matches(selector));
      }

      var sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
      return filter(this, (elem, i) => !sel.has(elem));
    }

    has(selector) {
      if (typeof selector === 'string') {
        var cache = new Set();
        return filter(this, elem => {
          if (cache.has(elem)) {
            return true;
          }

          var found = [...elem.querySelectorAll(":scope ".concat(selector))];
          found = found.concat(arr(parents(found)));
          found.forEach(e => cache.add(e));
          return found.length;
        });
      }

      var sel = selector instanceof ElementCollection ? selector : wrap(selector, this);
      return filter(this, (elem, i) => sel.some(test => elem !== test && elem.contains(test)));
    }

    find(selector) {
      if (typeof selector === 'function') {
        var sel = selector;
        return new ElementCollection(arr(this).find((a, b, c) => sel(a, b)));
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
          var $el = wrap(elem, elem.ownerDocument);

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
      var all = new Map();
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
            var allCbs = all.get(event);

            if (!allCbs) {
              allCbs = new Set();
              all.set(event, allCbs);
            }

            if (!cbs) {
              cbs = new Set();
              evs.set(event, cbs);
              allCbs.add(cbs);
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
                } while (parent !== that && (parent = parent.parentElement));

                var eq = wrapEvent(e);
                listeners.forEach((handlers, i) => {
                  if (eq.stoppedPropagation) return;
                  handlers.forEach(handle => {
                    if (eq.stoppedImmediatePropagation) return;
                    handle(eq);
                  });
                });
              };

              var remove = () => {
                all.delete(event);
                started.delete(event);
                that.removeEventListener(event, evcb, true);
              };

              that.addEventListener(event, evcb, true);
              started.set(event, remove);
            }

            subs.push(() => {
              cbs.delete(callback);

              if (cbs.size === 0) {
                evs.delete(event);
                allCbs.delete(cbs);

                if (allCbs.size === 0) {
                  var _started$get;

                  (_started$get = started.get(event)) === null || _started$get === void 0 ? void 0 : _started$get();
                }
              }
            });
          });
          return () => {
            subs.forEach(sub => sub());
          };
        },

        one(elem, event, callback) {
          var cbev = e => {
            if (once.has(cbev)) {
              var _events$get2, _events$get2$get, _events$get3;

              once.delete(callback);
              (_events$get2 = events.get(elem)) === null || _events$get2 === void 0 ? void 0 : (_events$get2$get = _events$get2.get(event)) === null || _events$get2$get === void 0 ? void 0 : _events$get2$get.delete(callback);

              if (((_events$get3 = events.get(elem)) === null || _events$get3 === void 0 ? void 0 : _events$get3.get(event).size) === 0) {
                var _events$get4;

                (_events$get4 = events.get(elem)) === null || _events$get4 === void 0 ? void 0 : _events$get4.delete(event);
              }
            }

            callback(e);
          };

          once.add(cbev);
          return this.on(elem, events, cbev);
        },

        off() {
          all.forEach(event => event.forEach(cbs => cbs.clear()));
          started.forEach(off => off());
          started.clear();
          once.clear();
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
        if (e.key.toLowerCase() === 'enter' && e.currentTarget instanceof HTMLElement && e.currentTarget.getAttribute('aria-disabled') !== 'true') {
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
          if (sanitizer().santizeAttribute(elem, k, "".concat(v))) {
            elem.setAttribute(k, "".concat(v));
          } else {
            throw new Error("Illegal attribute [".concat(k, "] value for <").concat(elem.nodeName.toLowerCase(), ">: ").concat(v));
          }
        });
      })) return this;
      return arr(this)[0] && typeof key === 'string' ? arr(this)[0].getAttribute(key) : null;
    }

    removeAttr(key) {
      this.forEach(elem => {
        if (sanitizer().santizeAttribute(elem, key, '', false, true)) {
          elem.removeAttribute(key);
        } else {
          throw new Error("Not allowed to remove attribute [".concat(key, "] value for <").concat(elem.nodeName.toLowerCase(), ">"));
        }
      });
      return this;
    }

    val(set) {
      if (typeof set !== 'undefined') {
        this.forEach(elem => {
          if (elem instanceof HTMLInputElement) {
            if (elem.type === 'checkbox' || elem.type === 'radio') {
              if (set === elem.value || set === true) {
                elem.setAttribute('checked', 'checked');
              } else {
                elem.removeAttribute('checked');
              }
            } else if (elem.type !== 'file' || !set) {
              elem.value = "".concat(set);
            }
          } else if (elem instanceof HTMLSelectElement) {
            var values = set instanceof Array ? set : [set];
            [...elem.options].forEach(opt => {
              opt.selected = values.includes(opt.value);
            });
          } else {
            elem.value = "".concat(set);
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
      if (!elem) return undefined;

      if (elem instanceof HTMLInputElement) {
        if (elem.type === 'checkbox') {
          return elem.checked;
        }

        if (elem.type === 'radio') {
          if (elem.checked) {
            return elem.value;
          }

          return undefined;
        }

        if (elem.type === 'number' || elem.type === 'range') {
          return +elem.value;
        }

        if (elem.type === 'file') {
          return elem.files;
        }

        return elem.value;
      }

      if (elem instanceof HTMLSelectElement) {
        var res = [...elem.options].filter(opt => opt.selected).map(opt => opt.value);

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
      var $elems = wrap([this.filter('input[name], select[name], textarea[name]'), this.find('input[name], select[name], textarea[name]')], this);
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
            res[elem.name] = wrap(elem, elem.ownerDocument).val();
          }
        });
      } else {
        $elems.forEach(elem => {
          if (set[elem.name] === undefined) return;
          res[elem.name] = set[elem.name];

          if (elem instanceof HTMLInputElement && elem.type === 'radio') {
            elem.checked = set[elem.name] === elem.value;
          } else {
            wrap(elem, elem.ownerDocument).val(set[elem.name]);
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

      return get(this.attr('aria-label')) || get(get(this.attr('aria-labelledby')) && wrap("#".concat(this.attr('aria-labelledby')), this).label()) || get(get(this.attr('id')) && wrap("label[for=\"".concat(this.attr('id'), "\"]"), this).label()) || get(this.attr('title')) || get(this.attr('placeholder')) || get(this.attr('alt')) || (get(this.text()) || '').trim();
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
      return this.toggleClass("".concat(name), true);
    }

    removeClass(name) {
      return this.toggleClass("".concat(name), false);
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
      return arr(this)[index < 0 ? this.length + index : index];
    }

    index(selector) {
      var ind = 0;

      if (typeof selector === 'undefined') {
        return this.first().prevAll().length;
      }

      if (typeof selector === 'string') {
        this.forEach(elem => !(elem.matches(selector) || ind++ || false));
        return ind >= this.length ? -1 : ind;
      }

      var sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
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
      if (elem) arr(res)[0] = elem;else arr(res).pop();
      return res;
    }

    next(selector) {
      return new ElementCollection(...this.map((elem, i) => elem.nextElementSibling)).filter((elem, i) => elem && (!selector || elem.matches(selector)));
    }

    nextUntil(selector, filterArg) {
      return from(propElem(this, 'nextElementSibling', filterArg, true, false, selector)).sort();
    }

    nextAll(selector) {
      return this.nextUntil(undefined, selector);
    }

    prev(selector) {
      return new ElementCollection(...this.map(elem => elem.previousElementSibling)).filter((elem, i) => elem && (!selector || elem.matches(selector)));
    }

    prevUntil(selector, filterArg) {
      return from(propElem(this, 'previousElementSibling', filterArg, true, false, selector, true)).sort().reverse();
    }

    prevAll(selector) {
      return this.prevUntil(undefined, selector);
    }

    siblings(selector) {
      return wrap([propElem(this, 'nextElementSibling', selector, true), propElem(this, 'previousElementSibling', selector, true, false, undefined, true)], this);
    }

    children(selector) {
      return from(propElem(this.map(elem => elem.firstElementChild), 'nextElementSibling', selector, true, true));
    }

    iframeInner() {
      var elem = this.get(0);

      if (!(elem instanceof HTMLIFrameElement)) {
        return new ElementCollection();
      }

      return new ElementCollection(elem.contentDocument.body);
    }

  }

  function wrapEvent(originalEvent) {
    if (originalEvent.isEqEvent) {
      return originalEvent;
    }

    var stoppedImmediatePropagation = false;
    var stoppedPropagation = false;
    var {
      currentTarget
    } = originalEvent;
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

    for (var p in originalEvent) {
      if (props[p]) continue;

      if (typeof originalEvent[p] === 'function') {
        (function () {
          var fn = originalEvent[p];
          props[p] = {
            get: () => function () {
              for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                args[_key2] = arguments[_key2];
              }

              return fn.call(originalEvent, ...args);
            }
          };
        })();
      } else if (p !== 'isTrusted') {
        props[p] = {
          value: originalEvent[p]
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

    if (!context) return new ElementCollection();
    var doc = context instanceof ElementCollection ? ownerDoc(context) : context;
    if (!doc) return new ElementCollection();
    var selectors = selector instanceof Array ? selector : [selector];
    var $context = context instanceof ElementCollection ? context : new ElementCollection(doc.documentElement);
    var elems = new Set();
    var doFilter = true;
    var doSort = selectors.length > 1;
    if (selectors.length === 1 && $context.length === 1 && selectors[0] === arr($context)[0] || $context === selector) return $context;

    for (var sel of selectors) {
      if (sel instanceof Element) {
        elems.add(sel);
      } else if (typeof sel === 'string') {
        (function () {
          var s = sel;
          $context.forEach(cElem => {
            cElem.querySelectorAll(":scope ".concat(s)).forEach(elem => elems.add(elem));
          });

          if (selectors.length === 1) {
            doFilter = false;
            doSort = false;
          }
        })();
      } else if (isIterable(sel)) {
        for (var elem of sel) {
          if (elem instanceof Element) {
            elems.add(elem);
          }
        }
      }
    }

    var res = from(elems);

    if (doFilter) {
      res = filter(res, (elem, i) => $context.some(cont => cont !== elem && cont.contains(elem)));
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

    var sel = (selector instanceof ElementCollection ? selector : wrap(selector, this)).toSet();
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

  function propElem(collection, propArg, selector, multiple, includeFirst, stopAt, reverse) {
    var res = new Set();
    var cache = new Set();
    var sSelector = typeof selector === 'string' ? selector : undefined;

    var is = (elem, sel) => {
      if (!(elem instanceof Element)) return false;
      if (!sel) return true;
      if (typeof sel === 'string') return elem.matches(sel);
      if (sel instanceof Array) return sel.includes(elem);
      return elem === sel;
    };

    var coll = [];

    if (collection instanceof ElementCollection) {
      coll = arr(collection);
    } else if (collection instanceof Array) {
      coll = collection;
    }

    for (var i = reverse ? coll.length - 1 : 0; reverse ? i >= 0 : i < coll.length; reverse ? i-- : i++) {
      var elem = coll[i];
      if (!elem || !(elem instanceof Element)) continue;
      if (cache.has(elem)) continue;
      cache.add(elem);
      var next = elem[propArg];

      if (includeFirst) {
        next = elem;
      }

      if (!next || stopAt && is(next, stopAt)) continue;

      do {
        if (is(next, sSelector)) {
          res.add(next);
        }

        cache.add(next);
      } while (multiple && next && (next = next[propArg]) && !cache.has(next) && (!stopAt || !is(next, stopAt)));
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
      if (defaultValue === undefined) return undefined;
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

  return {
    wrap,
    ElementCollection,
    getStore,
    deleteStore,
    defaultDelegateObject
  };
}

function registerTemplates(skope, elem, scopes) {
  var root = getRootScope(skope, scopes);
  if (!root) return;

  var recurse = el => {
    el.querySelectorAll('template[id]:not([s-static] template, [s-detached] template)').forEach(template => {
      if (template.id) {
        if (root.$templates[template.id]) {
          createError('Duplicate template definition', template);
        } else {
          root.$templates[template.id] = template;
        }
      } else {
        recurse(template.content);
      }
    });
  };

  recurse(elem);
}

function htmlDirective(skope) {
  return {
    name: 'html',
    callback: (exec, scopes) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      if (val instanceof Element || typeof val === 'string' || val instanceof skope.ElementCollection) {
        skope.wrapElem(exec.element).html(val);
      }
    }, () => {
      skope.wrapElem(exec.element).html('');
    })
  };
}

function showDirective(skope) {
  return {
    name: 'show',
    callback: (exec, scopes) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      exec.element.classList.toggle('s-hide', !val);
    }, () => {
      exec.element.classList.toggle('s-hide', false);
    })
  };
}

function modelDirective(skope) {
  return {
    name: 'model',
    callback: (exec, scopes) => {
      var el = exec.element;
      var isContentEditable = el instanceof HTMLElement && (el.getAttribute('contenteditable') === 'true' || el.getAttribute('contenteditable') === '');
      var $el = skope.wrapElem(el);
      var last = !isContentEditable ? $el.val() : $el.html();

      if (!el.hasAttribute('name')) {
        el.setAttribute('name', exec.js.trim());
      }

      var reset = false;

      var change = () => {
        last = !isContentEditable ? $el.val() : $el.html();

        try {
          skope.exec(getRootElement(skope, scopes), "".concat(exec.js.trim(), " = ($$value === undefined && !reset) ? ").concat(exec.js.trim(), " : $$value"), pushScope(skope, scopes, el, exec.subs, {
            $$value: last,
            reset
          })).run();
          reset = false;
        } catch (err) {
          createError(err === null || err === void 0 ? void 0 : err.message, exec.att);
        }
      };

      var sub = [];
      sub.push(exec.delegate.on(el, 'input', change));

      if (el.form) {
        var $form = skope.wrap(el.form, el.ownerDocument);
        sub.push($form.delegate().on($form.get(0), 'reset', () => reset = !!setTimeout(change)));
      }

      sub.push(skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js.trim()), (val, lastVal) => {
        if (val === last) return;

        if (isContentEditable) {
          $el.html("".concat(val));
        } else {
          $el.val(val);
        }
      }, () => {
        if (isContentEditable) {
          $el.html('');
        }
      }));
      return sub;
    }
  };
}

function refDirective(skope) {
  return {
    name: 'ref',
    callback: (exec, scopes) => {
      if (!exec.js.match(regVarName)) {
        throw createError("Invalid ref name: ".concat(exec.js), exec.element);
      }

      var name = getScope(skope, exec.element, [], {
        name: exec.js.trim()
      });
      skope.exec(document, '$refs[name] = $wrap([...($refs[name] || []), $el])', [...scopes, name]).run();
      return [() => {
        skope.exec(document, '$refs[name] = $refs[name].not($el)', [...scopes, name]).run();
      }];
    }
  };
}

function textDirective(skope) {
  return {
    name: 'text',
    callback: (exec, scopes) => skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
      skope.wrapElem(exec.element).text("".concat(val));
    }, () => {
      skope.wrapElem(exec.element).text('');
    })
  };
}

var ddd = document.createElement('div');
ddd.innerHTML = '<span $$templates="$templates"><span>';
var $$templatesAttr = ddd.querySelector('span').attributes.item(0);
function componentDirective(skope) {
  return {
    name: 'component',
    callback: (exec, scopes) => {
      var _getRootScope;

      var template = (_getRootScope = getRootScope(skope, scopes)) === null || _getRootScope === void 0 ? void 0 : _getRootScope.$templates[exec.att.nodeValue];

      if (!(template instanceof HTMLTemplateElement)) {
        createError('Template not found', exec.att);
        return [];
      }

      var elem = exec.element;
      var $elem = skope.wrapElem(elem);
      var subs = [];
      var delegate = $elem.delegate();
      var isStatic = elem.hasAttribute('s-static');
      elem.removeAttribute('s-static');
      var templateContent = template.content.cloneNode(true);
      var slot = templateContent.querySelector('[slot]');

      for (var attribute of template.attributes) {
        var name = attribute.nodeName.toLowerCase();
        if (name === 'id') continue;
        if (elem.hasAttribute(name)) continue;
        elem.setAttributeNode(attribute.cloneNode(true));
      }

      elem.setAttributeNode($$templatesAttr.cloneNode(true));

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
      var slotContent = document.createElement('template');
      var isIframe = elem instanceof HTMLIFrameElement;

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
      skope.processHTML(skope, elem, subs, delegate).run(pushScope(skope, scopes, elem, subs));

      if (isIframe) {
        $elem.html(templateContent);
      }

      elem.removeAttribute('s-detached');
      elem.setAttribute('s-component', exec.att.nodeValue);
      elem.setAttribute('component-processed', '');

      if (slot) {
        skope.getStore(slot, 'scopes', scopes);

        if (isIframe) {
          if (isStatic) {
            slot.setAttribute('s-static', '');
          }

          skope.preprocessHTML(skope, slot, slotContent.content);
          slot.appendChild(slotContent.content);
          skope.processHTML(skope, slot, subs, exec.delegate).run(scopes);
        } else {
          slot.appendChild(slotContent.content);
          setTimeout(() => {
            if (isStatic) {
              slot.setAttribute('s-static', '');
            }

            skope.processHTML(skope, slot, subs, exec.delegate).run(scopes);
          });
        }
      }

      return subs;
    }
  };
}

function transitionDirective(skope) {
  return {
    name: 'transition',
    callback: (exec, scopes) => {
      var $el = skope.wrapElem(exec.element);
      $el.addClass('s-transition');
      $el.addClass('s-transition-idle');
      var lastPromise;
      return skope.watch(exec.att, watchRun(skope, exec.att, scopes, exec.js), (val, lastVal) => {
        if (val === undefined || lastPromise !== val) {
          $el.addClass('s-transition-idle');
          $el.removeClass('s-transition-active');
          $el.removeClass('s-transition-done');
          $el.removeClass('s-transition-error');
        }

        if (val instanceof Promise) {
          lastPromise = val;
          $el.removeClass('s-transition-idle');
          $el.addClass('s-transition-active');
          val.then(() => {
            if (lastPromise !== val) return;
            $el.removeClass('s-transition-active');
            $el.addClass('s-transition-done');
          }, () => {
            if (lastPromise !== val) return;
            $el.removeClass('s-transition-active');
            $el.addClass('s-transition-error');
          });
        }
      });
    }
  };
}

function directives(skope) {
  var ret = {};

  for (var dir of [refDirective, htmlDirective, showDirective, textDirective, modelDirective, componentDirective, transitionDirective]) {
    var directive = dir(skope);
    ret[directive.name] = directive;
  }

  return ret;
}

function createElementScopeClass(skope, wrap, getStore) {
  var ElementScope = class {
    constructor(element) {
      this.$el = wrap(element, element.ownerDocument);
    }

    $dispatch(eventType, detail) {
      var bubbles = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
      var cancelable = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
      this.$el.trigger(eventType, detail, bubbles, cancelable);
    }

    $watch(cb, callback) {
      var subUnsubs = skope.watch(this.$el.get(0), cb, callback);
      var sub = getStore(this.$el.get(0), 'currentSubs', []);
      sub.push(subUnsubs);
      return {
        unsubscribe: () => unsubNested(subUnsubs)
      };
    }

    $delay(ms) {
      return new Promise(res => setTimeout(res, ms));
    }

  };
  return ElementScope;
}

function createRootScopeClass(skope, wrap, ElementScope) {
  var RootScope = class extends ElementScope {
    constructor() {
      super(...arguments);
      this.$templates = {};
      this.$refs = {};
    }

    $wrap(element) {
      return wrap(element, this.$el);
    }

  };
  return RootScope;
}

function initialize(skope) {
  var eQuery = createClass(() => skope.sanitizer);
  var {
    wrap,
    ElementCollection,
    getStore,
    deleteStore,
    defaultDelegateObject
  } = eQuery;
  skope.defaultDelegateObject = defaultDelegateObject;
  skope.getStore = getStore;
  skope.deleteStore = deleteStore;
  skope.wrap = wrap;
  var ElementScope = createElementScopeClass(skope, wrap, getStore);
  var RootScope = createRootScopeClass(skope, wrap, ElementScope);

  ElementCollection.prototype.html = function h(content) {
    if (content === undefined) {
      var _this$get;

      return (_this$get = this.get(0)) === null || _this$get === void 0 ? void 0 : _this$get.innerHTML;
    }

    if (content === null || !(content instanceof DocumentFragment || content instanceof Element || typeof content === 'string' || content instanceof ElementCollection)) {
      return this;
    }

    var elem = this.get(0);
    if (!elem) return this;
    var contentElem;
    var html;

    if (content instanceof ElementCollection) {
      html = content.detach();
    } else {
      html = content;
    }

    var currentSubs = skope.getStore(elem, 'currentSubs', []);
    var scopes = getScopes(skope, elem, currentSubs);

    if (elem instanceof HTMLIFrameElement) {
      var prev = elem;
      unsubNested(skope.getStore(elem.contentDocument.body, 'currentSubs'));
      elem = document.createElement('body');

      if (prev.matches('[s-static], [s-static] *')) {
        elem.setAttribute('s-static', '');
      }

      var prevSub = currentSubs;
      currentSubs = skope.getStore(elem, 'currentSubs', []);
      prevSub.push(currentSubs);
      skope.getStore(elem, 'currentSubs', currentSubs);
      skope.getStore(elem, 'scopes', scopes);
      var sty = document.createElement('style');
      sty.innerHTML = 'body { padding: 0; margin: 0; }';
      prev.contentDocument.head.appendChild(sty);
      prev.contentDocument.body.replaceWith(elem);

      var recurse = el => {
        if (!el || !el.parentElement || el.matches('[skope]') || el.hasAttribute('s-detached')) return [];
        var styles = recurse(el.parentElement);
        styles.push(...skope.wrapElem(el.parentElement).children('style').map(e => e.innerHTML));
        return styles;
      };

      recurse(prev).forEach(css => {
        var st = document.createElement('style');
        st.innerHTML = css;
        prev.contentDocument.body.appendChild(st);
      });
    } else if (!(elem instanceof HTMLTemplateElement)) {
      for (var el of [...elem.children]) {
        unsubNested(getStore(el, 'currentSubs'));
      }

      elem.innerHTML = '';
    }

    if (elem instanceof HTMLTemplateElement) {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = elem.content;
    } else {
      scopes = getScopes(skope, elem, currentSubs, {});
      contentElem = skope.preprocessHTML(skope, elem, html);
      registerTemplates(skope, contentElem, scopes);
    }

    elem.appendChild(contentElem);

    if (!elem.matches('[s-static], [s-static] *')) {
      var processed = skope.processHTML(skope, elem, currentSubs, defaultDelegateObject, true);
      processed.run(scopes);
    }

    return this;
  };

  ElementCollection.prototype.text = function t(set) {
    var _this$get2;

    if (set !== undefined) {
      var toSet = "".concat(set);
      this.forEach(elem => {
        unsubNested(skope.getStore(elem, 'childSubs'));
        elem.textContent = toSet;
      });
      return this;
    }

    return (_this$get2 = this.get(0)) === null || _this$get2 === void 0 ? void 0 : _this$get2.textContent.trim();
  };

  ElementCollection.prototype.detach = function d() {
    var contentElem = document.createElement('template');

    for (var elem of this) {
      unsubNested(skope.getStore(elem, 'currentSubs'));
      contentElem.appendChild(elem);
    }

    return contentElem.content;
  };

  skope.RootScope = RootScope;
  skope.ElementScope = ElementScope;
  skope.prototypeWhitelist.set(FileList, new Set());
  skope.prototypeWhitelist.set(File, new Set());
  skope.prototypeWhitelist.set(RootScope, new Set());
  skope.prototypeWhitelist.set(ElementCollection, new Set());
  skope.prototypeWhitelist.set(ElementScope, new Set());
  skope.ElementCollection = ElementCollection;
  var directives$1 = directives(skope);

  for (var dir in directives$1) {
    skope.defineDirective(directives$1[dir]);
  }
}

class Skope {
  constructor(options) {
    this.components = {};
    this.directives = {};
    this.globals = Sandbox.SAFE_GLOBALS;
    this.prototypeWhitelist = Sandbox.SAFE_PROTOTYPES;
    this.sandboxCache = new WeakMap();
    this.styleIds = 0;
    this.calls = [];
    this.sanitizer = (options === null || options === void 0 ? void 0 : options.sanitizer) || new HTMLSanitizer();
    delete this.globals.Function;
    delete this.globals.eval;

    if (!(options !== null && options !== void 0 && options.allowRegExp)) {
      delete this.globals.RegExp;
    }

    initialize(this);
    this.sandbox = new Sandbox({
      globals: this.globals,
      prototypeWhitelist: this.prototypeWhitelist,
      executionQuota: (options === null || options === void 0 ? void 0 : options.executionQuote) || 100000n
    });
  }

  call(cb) {
    this.calls.push(cb);
    if (this.callTimer) return;
    this.callTimer = setTimeout(() => {
      this.callTimer = null;
      var toCall = [...this.calls];
      this.calls.length = 0;

      for (var c of toCall) {
        try {
          c();
        } catch (err) {
          console.error(err);
        }
      }
    });
  }

  defineComponent(name, comp) {
    this.components[name] = comp;
    var prot = Object.getPrototypeOf(comp);

    if (prot !== Object.getPrototypeOf({}) && !this.sandbox.context.prototypeWhitelist.has(prot)) {
      this.sandbox.context.prototypeWhitelist.set(prot, new Set());
    }
  }

  wrapElem(el) {
    return this.wrap(el, el.ownerDocument);
  }

  watch(elem, toWatch, handler, errorCb) {
    return watch(this, elem, toWatch, handler, errorCb);
  }

  exec(el, code, scopes) {
    el = el || document;
    var codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    var key = "sync:".concat(code);
    codes[key] = codes[key] || this.sandbox.compile(code);
    return codes[key](...scopes);
  }

  execAsync(el, code, scopes) {
    el = el || document;
    var codes = this.sandboxCache.get(el) || {};
    this.sandboxCache.set(el, codes);
    var key = "async:".concat(code);
    codes[key] = codes[key] || this.sandbox.compileAsync(code);
    return codes[key](...scopes);
  }

  defineDirective(exec) {
    this.directives[exec.name] = exec.callback;
  }

  init(elem, component) {
    var alreadyPreprocessed = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var subs = [];

    if (!alreadyPreprocessed) {
      var sub2 = this.sanitizer.observeAttribute(elem || document.documentElement, 's-static', () => {}, true, true);
      subs.push(sub2.cancel);
    }

    var sub = this.sanitizer.observeAttribute(elem || document.documentElement, 'skope', el => {
      var comp = component || el.getAttribute('skope');
      var scope = getScope(this, el, subs, this.components[comp] || {}, true);
      registerTemplates(this, el, [scope]);
      var processed = this.processHTML(this, el, subs, this.defaultDelegateObject);
      this.sanitizer.setAttributeForced(el, 'skope-processed', '');
      processed.run([scope]);
    }, false);
    subs.push(sub.cancel);
    return {
      cancel() {
        unsubNested(subs);
      }

    };
  }

  preprocessHTML(skope, parent, html) {
    var elem;

    if (typeof html === 'string') {
      var template = document.createElement('template');
      template.innerHTML = html;
      elem = template.content;
    } else {
      elem = html;
    }

    if (parent.matches('[s-static], [s-static] *')) {
      skope.sanitizer.sanitizeHTML(elem, true);
    } else {
      for (var el of elem.querySelectorAll('[s-static]:not([s-static] [s-static])')) {
        for (var child of el.children) {
          skope.sanitizer.sanitizeHTML(child, true);
        }
      }

      skope.sanitizer.sanitizeHTML(elem);
    }

    return elem;
  }

  processHTML(skope, elem, subs, delegate) {
    var skipFirst = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : false;
    var exec = walkerInstance();
    walkTree(skope, elem, subs, exec.ready, delegate, skipFirst);
    return {
      elem,
      run: exec.run
    };
  }

}

export { Skope as default };
//# sourceMappingURL=Skope.js.map
