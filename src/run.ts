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

import * as fs from 'fs';
import * as childProcess from 'child_process';
import {Result} from './json';
import * as metadata from './metadata';
import * as commander from 'commander';
import * as Mocha from 'mocha';

function exec(cmd: string) {
  childProcess.execSync(cmd, {stdio: 'inherit'});
}

function gzip(path: string) {
  exec(`gzip -k -9 -f ${path}`);
}

function brotli(path: string) {
  const brotli = process.env['BROTLI'] || 'brotli';
  exec(`${brotli} -k -9 -f ${path}`);
}

function summarize(results: Result[]) {
  fs.writeFileSync('out/results.json', JSON.stringify(results));
}

function gen10xAngular(path: string): string {
  const ngPath = metadata.js['angularjs'].path;
  const ngJS = fs.readFileSync(ngPath, 'utf-8');
  let data = ngJS;
  while (data.length < 10 * 1000 * 1000) {
    data += ngJS;
  }

  const outPath = `out/${path}`;
  fs.writeFileSync(outPath, data);
  return outPath;
}

async function main() {
  commander
    .option(
      '--tools [regex]',
      'regex to match tools to run',
      arg => new RegExp(arg)
    )
    .option(
      '--inputs [regex]',
      'regex to match inputs to run',
      arg => new RegExp(arg)
    )
    .parse(process.argv);
  const toolFilter = commander.tools;
  const inputFilter = commander.inputs;

  try {
    fs.mkdirSync('out');
  } catch (e) {
    if (e.code != 'EEXIST') throw e;
  }

  let inputs = Object.keys(metadata.js);
  inputs.sort();

  let results: Result[] = [];
  for (const input of inputs) {
    if (inputFilter && !inputFilter.test(input)) continue;
    const {path, transform, test} = metadata.js[input];
    let inputPath = path;
    if (transform) {
      if (transform === 'angularjs 10x') {
        inputPath = gen10xAngular(inputPath);
      } else {
        throw new Error(`unknown transform ${transform}`);
      }
    }
    for (const {id: tool, variants} of metadata.tools) {
      for (const {id: variant, command} of variants) {
        const toolVariant = tool + (variant ? `-${variant}` : '');
        if (toolFilter && !toolFilter.test(toolVariant)) continue;
        console.log(`${input} ${toolVariant}`);
        const out = `out/${input}.${toolVariant}`;
        const cmd = command
          .replace('%%in%%', inputPath)
          .replace('%%out%%', out);
        const start = Date.now();
        try {
          exec(cmd);
        } catch (e) {
          const end = Date.now();
          results.push({
            input,
            tool,
            variant,
            time: end - start,
            size: 0,
            gzSize: 0,
            brSize: 0,
            failed: true
          });
          continue;
        }
        const time = Date.now() - start;

        if (test) {
          const mocha = new Mocha();
          mocha.addFile(test);
          mocha.reporter('progress');
          const failures = await new Promise((resolve, reject) => {
            mocha.run(failures => {
              resolve(failures);
            });
          });
          console.log('run result', failures);
        } else {
          // TODO: include this warning in the output.
          console.warn('warning: no test');
        }

        const size = fs.statSync(out).size;
        gzip(out);
        const gzSize = fs.statSync(`${out}.gz`).size;
        brotli(out);
        const brSize = fs.statSync(`${out}.br`).size;

        results.push({
          input,
          tool,
          variant,
          time,
          size,
          gzSize,
          brSize
        });
      }
    }
  }

  summarize(results);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
