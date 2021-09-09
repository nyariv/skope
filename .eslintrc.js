module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
  ],
  parserOptions: {
     project: './tsconfig.json'
  },
  rules: Object.fromEntries(`
@typescript-eslint/no-unused-vars
@typescript-eslint/no-explicit-any
@typescript-eslint/explicit-module-boundary-types
@typescript-eslint/no-empty-function
no-cond-assign
import/no-cycle
no-param-reassign
no-return-assign
no-plusplus
max-len
@typescript-eslint/no-use-before-define
no-restricted-syntax
no-console
vars-on-top
guard-for-in
class-methods-use-this
no-continue
no-nested-ternary
`.split('\n').map((a) => [a, "off"]))
};
