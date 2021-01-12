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
/**
 * @fileoverview
 * The `render` function reads from out/results.json and renders it to an HTML
 * table.
 *
 * @todo
 * Someone please just rewrite this entire file. I wasted four hours trying to
 * fix it despite the excessive complexity and it should really just be
 * rewritten entirely.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExperimentResult, Measurement } from '../specs/json';
import * as metadata from '../specs/metadata';

const excludeFields = [
  'input',
  'tool',
  'variant',
  'metrics',
  'unminifiedJavascript',
  'usesTextCompression',
  'unusedJavascript',
  'networkServerLatency',
  'networkRtt',
  'bootupTime',
  'serverResponseTime',
];

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

function min(data: Measurement[]): number {
  return data.reduce((a, b) => {
    a = a || {};
    b = b || {};
    const measurement = new Measurement(
      Math.min(a.numericValue, b.numericValue),
      b.numericUnit
    );
    return measurement;
  }).numericValue;
}

function max(data: Measurement[]): number {
  return data.reduce((a, b) => {
    a = a || {};
    b = b || {};
    const measurement = new Measurement(
      Math.max(a.numericValue, b.numericValue),
      b.numericUnit
    );
    return measurement;
  }).numericValue;
}

function twoColumnRow(
  result: ExperimentResult,
  results: ExperimentResult[],
  column: string,
  suffix: string = ''
): string {
  /** The selected value for this result. */
  const measurement: Measurement = result.data[column] || {};

  /** Map all results to their selected field values. */
  const selectedField = results
    .filter((result) => !result.failure)
    .filter((result) => result.tool !== 'raw')
    .map((result) => result.data[column]);

  /**
   * Get the best and worst selected field values across the provided results.
   */
  const rawValue: Measurement =
    results
      .filter((result) => result.tool === 'raw')
      .map((result) => result.data[column])[0] || new Measurement();

  const bestValue = min(selectedField);
  const worstValue = max(selectedField);

  let special = '';
  if (measurement.numericValue === bestValue) special = 'best';
  if (measurement.numericValue === worstValue) special = 'worst';

  let out = `<td class="${special}" align=right>${measurement.displayValue}</td>`;

  if (column === 'buildTime') {
    out += `<td class="${special}"></td>`;
  } else if (worstValue) {
    /** Express as a % reduction in size. */
    const percentageReduction =
      -(measurement.numericValue / rawValue.numericValue - 1) * 100;
    const pctFormatted = percentageReduction
      ? percentageReduction.toFixed(1) + '%'
      : '';
    out += `<td class="pct ${special}" align=right>${pctFormatted}</td>`;
  } else {
    out += '<td></td>';
  }

  return out;
}

function resultsTable(allResults: ExperimentResult[]): string {
  let html = `<table><tr><th>input+tool+variant</th>`;
  const rolledUpEntries = Array.from(rollup(allResults, 'input').entries());

  /** Get non-reserved headings. */
  const includedCols = Object.keys(rolledUpEntries[0][1][0].data)
    .filter((key) => !excludeFields.includes(key))
    .reverse();

  /** Build heading row. */
  for (const field of includedCols) {
    html += `<th><a href='#${field}'>${field}</a></th><th></th>`;
  }

  /** Close out heading row. */
  html += '</tr>';

  /** Build table. */
  for (const [input, results] of rolledUpEntries) {
    html += `<tr class="tool-row"><td><i>${input}</i></td></tr>`;

    let lastTool = '';
    for (const result of results) {
      html += `<tr>`;

      if (result.tool != lastTool) {
        const untestedMsg = result.untested
          ? ` <span title="warning: not tested">⚠</span>`
          : '';

        html += `<td style='padding-left: 8px'>
            <a href='#${result.tool}'>${result.tool}</a>
            ${untestedMsg}
          </td>`;

        lastTool = result.tool;
      } else {
        /** + compress-mangle */
        html += `<td style='padding-left: 8ex'>+ ${result.variant}</td>`;
      }

      if (!result.failure) {
        for (const column of includedCols) {
          let unit = '';
          if (/size/i.test(column)) unit = 'kB';
          if (/time/i.test(column)) unit = 's';
          html += twoColumnRow(result, results, column, unit);
        }
      } else {
        html += `<td colspan=6 align=center title='${result.failure}'>failed (hover for details)</td>`;
      }
      html += `</tr>`;
    }
  }

  /** Close out table and return. */
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

export function render() {
  /** Load results from results.json. */
  const resultsJson = fs.readFileSync('out/results.json', 'utf-8');
  const results = JSON.parse(resultsJson);

  /** Specify template repalcements. */
  const templateData: { [k: string]: string } = {
    resultsTable: resultsTable(results),
    toolDetails: toolDetails(),
  };

  /** Load template from results.template. */
  const template = fs.readFileSync('src/specs/results.template', 'utf8');
  /** Replace the template fields and build HTML output. */
  const htmlOutput = template.replace(/%%(\w+)%%/g, (_, f) => templateData[f]);

  /** Write */
  fs.writeFileSync('index.html', htmlOutput);
  console.log('HTML written to index.html.');
}
