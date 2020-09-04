import babel from '@rollup/plugin-babel';
import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from "rollup-plugin-copy-assets";

const extensions = ['.js', '.ts']

export default {
  input: ['src/Scope.ts', 'src/defaultInit.ts'],
  output: {
    dir: 'dist',
    name: 'ScopeJS',
    format: 'es',
    exports: 'named',
    sourcemap: true
  },
  plugins: [
    copy({
      assets: [
        "src/scopejs.css",
      ],
    }),
    typescript(),
    resolve({ extensions }),
    babel({ extensions, babelHelpers: 'bundled' }),
    filesize()
  ]
}
