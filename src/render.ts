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
import * as path from 'path';
import {Result} from './json';
import * as metadata from './metadata';

function rollup<T, K extends keyof T>(data: T[], key: K): Map<T[K], T[]> {
  let map = new Map<T[K], T[]>();
  for (let t of data) {
    let row = map.get(t[key]);
    if (!row) {
      row = [];
      map.set(t[key], row);
    }
    row.push(t);
  }
  return map;
}

function min(data: number[]): number {
  return data.reduce((a, b) => Math.min(a, b));
}

function max(data: number[]): number {
  return data.reduce((a, b) => Math.max(a, b));
}

function sizeCells(size: number, bestSize: number, worstSize: number): string {
  const best = size === bestSize ? ' class=best' : '';
  return (
    `<td align=right${best}>${size.toLocaleString()}</td>` +
    `<td align=right${best}>${
      size === worstSize ? '' : (size * 100 / worstSize).toFixed(1) + '%'
    }</td>`
  );
}

function resultsTable(allResults: Result[]): string {
  let html = `<table>`;
  html +=
    `<tr><th>input+tool+variant</th><th>size</th><th></th>` +
    `<th><a href='#gzip'>gzip</a></th><th></th>` +
    `<th><a href='#brotli'>brotli</a></th><th></th>` +
    `<th><a href='#runtime'>runtime</a></th></tr>\n`;
  for (const [input, results] of rollup(allResults, 'input').entries()) {
    const meta = metadata.js[input];
    const readmePath =
      meta.readme || path.join(path.dirname(meta.bundlePath), 'README.md');
    const readmeUrl = `https://github.com/evmar/js-min-bench/tree/master/${readmePath}`;

    html += `<tr><td><a href='${readmeUrl}'>${input}</a></td></tr>`;
    const candidates = results.filter(r => !r.failure);
    const sizes = ([] as number[]).concat(
      ...candidates.map(c => [c.size, c.gzSize, c.brSize])
    );
    const bestSize = min(sizes);
    const worstSize = max(sizes);
    const bestTime = min(
      candidates.filter(r => r.tool !== 'raw').map(r => r.time)
    );
    let lastTool = '';
    for (const result of results) {
      html += `<tr>`;
      if (result.tool != lastTool) {
        const untestedMsg = result.untested
          ? ` <span title="warning: not tested">⚠</span>`
          : '';
        html +=
          `<td style='padding-left: 4ex'>` +
          `<a href='#${result.tool}'>${result.tool}</a>${untestedMsg}</td>`;
        lastTool = result.tool;
      } else {
        html += `<td style='padding-left: 8ex'>+ ${result.variant}</td>`;
      }

      if (!result.failure) {
        html += sizeCells(result.size, bestSize, worstSize);
        html += sizeCells(result.gzSize, bestSize, worstSize);
        html += sizeCells(result.brSize, bestSize, worstSize);
      } else {
        html += `<td colspan=6 align=center title='${
          result.failure
        }'>failed (hover for details)</td>`;
      }

      if (result.tool === 'raw') {
        html += `<td></td>`;
      } else {
        let best = result.time === bestTime ? ' class=best' : '';
        let time = (result.time / 1000).toFixed(1);
        html += `<td align=right${best}>${time}s</td></tr>\n`;
      }
    }
  }
  html += `</table>\n`;
  return html;
}

/** Redacts "/home/username/.../ bit from a command line. */
function redactCommand(cmd: string): string {
  return cmd.replace(/^.*\/js-min-bench\//, '');
}

function toolDetails(): string {
  let html = '<dl>';
  html +=
    `<dt>raw</dt>` + `<dd>raw input file, as baseline for comparison</dd>`;
  for (const tool of metadata.tools.slice(1)) {
    html +=
      `<dt><a name='${tool.id}'>${tool.id}</a></dt>` +
      `<dd>${tool.name}<br>` +
      `<tt>$ ${redactCommand(tool.variants[0].command)}</tt><br>`;
    if (tool.variants.length > 1) {
      html += `<dl>`;
      for (const variant of tool.variants.slice(1)) {
        html +=
          `<dt>${variant.id}</dt>` +
          `<dd><tt>$ ${redactCommand(variant.command)}</tt></dd>\n`;
      }
      html += `</dl>`;
    }
    html += '</dd>\n';
  }
  html += '</dl>\n';
  return html;
}

function main() {
  const allResults: Result[] = JSON.parse(
    fs.readFileSync('out/results.json', 'utf8')
  );

  const template = fs.readFileSync('src/results.template', 'utf8');
  const templateData: {[k: string]: string} = {
    resultsTable: resultsTable(allResults),
    toolDetails: toolDetails()
  };
  console.log(template.replace(/%%(\w+)%%/g, (_, f) => templateData[f]));
}

main();
