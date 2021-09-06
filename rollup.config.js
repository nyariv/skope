import babel from '@rollup/plugin-babel';
import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from "rollup-plugin-copy-assets";
import commonjs from '@rollup/plugin-commonjs';

const extensions = ['.js', '.ts'];

export default [{
  input: ['src/Skope.ts'],
  preserveModules: false,
  output: {
    dir: 'dist',
    name: 'Skope',
    format: 'es',
    exports: 'named',
    sourcemap: true,
  },
  plugins: [
    commonjs(),
    copy({
      assets: [
        "src/skopejs.css",
      ],
    }),
    typescript(),
    resolve({ extensions }),
    babel({ extensions, babelHelpers: 'bundled' }),
    filesize()
  ]
}, {
  input: ['src/defaultInit.ts'],
  output: {
    dir: 'dist',
    name: 'defaultInit',
    format: 'iife',
    sourcemap: true,
  },
  plugins: [
    commonjs(),
    typescript(),
    resolve({ extensions }),
    babel({ extensions, babelHelpers: 'bundled' }),
    filesize()
  ]
}]
