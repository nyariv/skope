import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import copy from "rollup-plugin-copy-assets";

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
    copy({
      assets: [
        "src/skopejs.css",
      ],
    }),
    typescript(),
    resolve({ extensions }),
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
    typescript(),
    resolve({ extensions }),
    filesize()
  ]
}]
