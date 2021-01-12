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
import * as metadata from '../specs/metadata';

import commander from 'commander';
import Mocha from 'mocha';
import { serve, WebServer } from './serve';
import {
  ExperimentConfiguration,
  ExperimentResult,
  Measurement,
} from '../specs/json';
import { render } from './render';
import { resolve } from 'path';
import { measure } from './measure';

const camelcase = (str: string): string => {
  let output = '';
  let capitalizeNext = false;
  for (const char of str) {
    if (char === '-') {
      capitalizeNext = true;
    } else {
      output += capitalizeNext ? char.toUpperCase() : char;
      capitalizeNext = false;
    }
  }
  return output;
};

/** Synchronously executes a subcommand. */
function exec(cmd: string) {
  childProcess.execSync(cmd, { stdio: 'inherit' });
}

/** gzips a bundle and returns the gzipped size. */
function gzip(path: string): number {
  exec(`gzip -k -9 -f ${path}`);
  return fs.statSync(`${path}.gz`).size;
}

/** brotli compresses a bundle and returns the compressed file size. */
function brotli(path: string): number {
  const brotli = process.env['BROTLI'] || 'brotli';
  exec(`${brotli} -k -9 -f ${path}`);
  return fs.statSync(`${path}.br`).size;
}

function gen10xAngular(path: string): string {
  const ngPath = metadata.js['angularjs'].bundlePath;
  const ngJS = fs.readFileSync(ngPath, 'utf-8');
  let data = ngJS;
  while (data.length < 10 * 1000 * 1000) {
    data += ngJS;
  }

  const outPath = `out/data/${path}`;
  fs.writeFileSync(outPath, data);
  return outPath;
}

/**
 * Runs a test suite with a JS bundle substituted in.
 * @return a failure message if failed, undefined on success.
 */
async function runTests(
  test: metadata.Test,
  bundlePath: string
): Promise<string | undefined> {
  const server = new WebServer(test.webroot);
  const port = 9000;

  console.log({ test, bundlePath });

  server.remaps.set('/bundle.js', bundlePath);
  await server.run(port);

  const mocha = new Mocha();
  mocha.addFile(resolve(test.test));
  mocha.reporter('progress');

  const failures: number = await new Promise((resolve) => {
    mocha.run((failures) => {
      resolve(failures);
    });
  });

  await server.stop();
  await mocha.unloadFiles();

  if (failures > 0) {
    console.warn(`run test manually via\n$ ${server.cmdline()}`);
    return 'test failure';
  } else {
    console.log('No errors');
  }
}

export async function run() {
  try {
    fs.mkdirSync('out/data', { recursive: true });
  } catch (e) {
    if (e.code != 'EEXIST') throw e;
  }

  let totalErrors = 0;

  const { inputFilter, toolFilter, skipTests } = commander;
  console.log({ inputFilter, toolFilter, skipTests });

  let experimentIdentifiers = Object.keys(metadata.js);
  experimentIdentifiers.sort();

  let results: ExperimentResult[] = [];
  for (const experimentIdentifier of experimentIdentifiers) {
    if (inputFilter && !inputFilter.test(experimentIdentifier)) continue;

    const { bundlePath, transform, test, externs } = metadata.js[
      experimentIdentifier
    ];
    let inputPath = bundlePath;

    if (transform) {
      if (transform === 'angularjs 10x') {
        inputPath = gen10xAngular(inputPath);
      } else {
        throw new Error(`unknown transform ${transform}`);
      }
    }

    for (const { id: tool, variants } of metadata.tools) {
      for (const { id: variant, command } of variants) {
        const experimentConfiguration = new ExperimentConfiguration(
          undefined,
          undefined,
          tool,
          variant
        );
        experimentConfiguration.experimentIdentifier = experimentIdentifier;
        const { platformIdentifier } = experimentConfiguration;

        if (toolFilter && !toolFilter.test(platformIdentifier)) {
          continue;
        }

        const out = `out/data/${experimentConfiguration.toString()}`;
        const cmd = command
          .replace('%%in%%', inputPath)
          .replace('%%out%%', out)
          .replace('%%externs%%', externs || '');

        const start = Date.now();
        const result: ExperimentResult = {
          input: experimentIdentifier,
          tool,
          variant,
          data: {
            buildTime: new Measurement(0, 'kB'),
            brotliSize: new Measurement(0, 'kB'),
            gzipSize: new Measurement(0, 'kB'),
            size: new Measurement(0, 'kB'),
          },
        };

        try {
          exec(cmd);
        } catch (e) {
          console.warn(`Could not execute cmd: ${cmd}`);
          console.warn(e);
          result.data.buildTime = new Measurement(Date.now() - start, 'ms');
          result.failure = e.toString();
          results.push(result);
          continue;
        }

        result.data.buildTime = new Measurement(Date.now() - start, 'ms');

        if (!skipTests && test) {
          const failureMsg = await runTests(test, out);
          if (failureMsg) {
            result.failure = failureMsg;
            results.push(result);
            totalErrors++;
            continue;
          }
        } else {
          result.untested = true;
          console.warn('warning: no test');
        }

        result.data.size = new Measurement(fs.statSync(out).size / 1000, 'kB');
        result.data.gzipSize = new Measurement(gzip(out) / 1000, 'kB');
        result.data.brotliSize = new Measurement(brotli(out) / 1000, 'kB');

        const audits = await measure(experimentConfiguration);
        for (const audit of audits) {
          const id = camelcase(audit.id);
          const measurement = Measurement.from(audit);
          result.data[id] = measurement;

          const logClasses = [
            'speedIndex',
            'interactive',
            'mainthreadWorkBreakdown',
          ];
          if (logClasses.includes(id)) {
            console.log(measurement);
          }
        }

        results.push(result);
      }
    }
  }

  /**
   * Write the JSON results.
   */
  fs.writeFileSync('out/results.json', JSON.stringify(results, null, 2));
  console.log('Results written to out/results.json');

  /**
   * Render HTML.
   */
  render();

  /**
   * Exit if any relevant errors failed.
   */
  process.exit(Number(totalErrors > 0));
}
