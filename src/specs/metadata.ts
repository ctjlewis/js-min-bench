/**
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// TODO: this duplicates some logic from google-closure-compiler npm package,
// maybe there's a better way to reuse it?

function getClosurePath(): string {
  const module =
    process.platform === 'darwin'
      ? 'google-closure-compiler-osx'
      : 'google-closure-compiler-linux';
  return require(module);
}

// const closureCommand = [
//   getClosurePath(),
//   '--jscomp_off checkVars',
//   '--warning_level QUIET',
//   '--language_in ES_NEXT',
//   '--language_out ECMASCRIPT_2015',
// ].join(' ');

const closureCommand = [
  getClosurePath(),
  '--jscomp_off checkVars',
  '--warning_level QUIET',
  '--language_in ES_NEXT',
  '--language_out ECMASCRIPT_2015',
  '--isolation_mode IIFE',
  '--assume_function_wrapper',
  '--strict_mode_input',
].join(' ');

// const closureCommand = [
//   getClosurePath(),
//   '--jscomp_off=checkVars',
//   '--warning_level=QUIET',

//   '--language_in ES_NEXT',
//   '--language_out ECMASCRIPT5_STRICT',

//   '--isolation_mode IIFE',
//   '--assume_function_wrapper',
//   '--strict_mode_input',
// ].join(' ');

export interface Test {
  webroot: string;
  test: string;
}

export interface JSFileMetadata {
  bundlePath: string;
  desc: string;
  /** Path to project README; defaults to README.md alongside bundle. */
  readme?: string;
  version?: string;
  transform?: string;
  externs?: string;
  test?: Test;
}

export const js: { [name: string]: JSFileMetadata } = {
  angularjs: {
    bundlePath: 'third_party/angularjs/angular.js',
    desc: 'angularjs 1.6.6 minified bundle',
    version: '1.6.6',
  },
  'fake-10mb-angular': {
    transform: 'angularjs 10x',
    bundlePath: 'fake-10mb-angular.js',
    desc:
      'angularjs 1.6.6 minified, artificially repeated until input file >10mb',
    version: '1.6.6',
  },
  'angular-hello': {
    bundlePath: 'third_party/angular/main.js',
    desc:
      'angular5 + cli hello world ' +
      '(note: <a href="https://github.com/angular/closure-demo">closure-optimized build</a> is much smaller)',
  },
  react: {
    bundlePath: 'third_party/react/react.production.min.js',
    desc: 'react production bundle',
  },
  'react-dom': {
    bundlePath: 'third_party/react/react-dom.production.min.js',
    desc: 'react-dom production bundle',
  },
  vue: {
    bundlePath: 'third_party/vue/vue.js',
    desc: 'vue.js 2.5.3',
    version: '2.5.3',
  },
  'todomvc-vanillajs': {
    bundlePath: 'third_party/todomvc/vanillajs/bundle.js',
    externs: 'third_party/todomvc/vanillajs/externs.js',
    desc: 'todomvc vanillajs',
    readme: 'third_party/todomvc/README.md',
    test: {
      webroot: 'third_party/todomvc/vanillajs',
      test: 'out/third_party/todomvc/test.js',
    },
  },
  'todomvc-react': {
    bundlePath: 'third_party/todomvc/react/bundle.js',
    externs: 'third_party/todomvc/react/externs.js',
    desc: 'todomvc react',
    readme: 'third_party/todomvc/README.md',
    test: {
      webroot: 'third_party/todomvc/react',
      test: 'out/third_party/todomvc/test.js',
    },
  },
};

export interface ToolMetadata {
  id: string;
  name: string;
  variants: Array<{ id?: string; desc?: string; command: string }>;
}

export const tools: ToolMetadata[] = [
  {
    id: 'raw',
    name: 'baseline input file',
    variants: [
      {
        command: 'cp %%in%% %%out%%',
      },
    ],
  },
  {
    id: 'uglify',
    name: 'uglifyjs 3.5.6',
    variants: [
      { command: 'node_modules/.bin/uglifyjs %%in%% -o %%out%%' },
      {
        id: 'compress-mangle',
        desc: '<tt>--compress</tt> and <tt>--mangle</tt> flags',
        command:
          'node_modules/.bin/uglifyjs %%in%% -o %%out%% --compress --mangle',
      },
    ],
  },
  {
    id: 'terser',
    name: 'terser 3.17.0',
    variants: [
      { command: 'node_modules/.bin/terser %%in%% -o %%out%%' },
      {
        id: 'compress-mangle',
        desc: '<tt>--compress</tt> and <tt>--mangle</tt> flags',
        command:
          'node_modules/.bin/terser %%in%% -o %%out%% --compress --mangle',
      },
    ],
  },
  {
    id: 'closure',
    name:
      "<a href='https://developers.google.com/closure/compiler/'>Google Closure Compiler</a> 20190415",
    variants: [
      {
        command: `${closureCommand} --js_output_file=%%out%% %%in%%`,
      },
      {
        id: 'advanced',
        desc: 'advanced mode + externs',
        command: `${closureCommand} -O advanced third_party/externs.js %%externs%% --js_output_file=%%out%% %%in%%`,
      },
    ],
  },
  // {
  //   id: 'j8t',
  //   name: "<a href='https://github.com/evmar/j8t'>j8t</a> (work in progress)",
  //   variants: [
  //     {
  //       command: '../j8t/target/release/j8t %%in%% > %%out%%',
  //     },
  //   ],
  // },
];
