import babel from '@rollup/plugin-babel';
import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from "rollup-plugin-copy-assets";

const extensions = ['.js', '.ts']

export default {
  input: ['src/Skope.ts', 'src/defaultInit.ts', 'src/HTMLSanitizer.ts'],
  preserveModules: false,
  output: {
    dir: 'dist',
    name: 'Skope',
    format: 'es',
    exports: 'named',
    sourcemap: true,
  },
  plugins: [
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
}
