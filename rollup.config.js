import babel from '@rollup/plugin-babel';
import filesize from 'rollup-plugin-filesize';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

const extensions = ['.js', '.ts']

export default {
  input: 'src/Scope.ts',
  output: {
    dir: 'dist',
    name: 'ScopeJS',
    format: 'es',
    exports: 'named'
  },
  plugins: [
    typescript(),
    resolve({ extensions }),
    babel({ extensions, babelHelpers: 'bundled' }),
    filesize()
  ]
}
