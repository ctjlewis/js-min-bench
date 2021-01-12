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

export interface ExperimentConfiguration {
  readonly experiment: string;
  readonly framework: string;
  readonly tool: string;
  readonly variant?: string;

  experimentIdentifier: string;
  platformIdentifier: string;
}

export class ExperimentConfiguration {
  constructor(
    readonly experiment = 'todomvc',
    readonly framework = 'react',
    readonly tool = 'raw',
    readonly variant?: string
  ) {}

  experimentIdentifier: string = `${this.experiment}-${this.framework}`;
  platformIdentifier: string = `${this.tool}${
    this.variant ? `-${this.variant}` : ``
  }`;

  toString() {
    return `${this.experimentIdentifier}.${this.platformIdentifier}`;
  }
}

export interface ExperimentObservation {
  [field: string]: Measurement;
  /**
   * Guaranteed fields.
   */
  buildTime: Measurement;
  size: Measurement;
  gzipSize: Measurement;
  brotliSize: Measurement;
}

export interface ExperimentResult {
  [field: string]: any;
  /**
   * Result metadata.
   */
  input: string;
  tool: string;
  variant?: string;
  failure?: string;
  untested?: boolean;
  /**
   * All observation data held here. Keys can be iterated over.
   */
  data: ExperimentObservation;
}

export interface Measurement {
  readonly numericValue: number;
  readonly numericUnit: string;
  readonly displayValue: string;
}

export class Measurement {
  constructor(
    readonly numericValue = 0,
    readonly numericUnit = '',
    readonly displayValue = `${numericValue}${numericUnit}`
  ) {}

  static from(measurement: Measurement) {
    const { numericValue, numericUnit, displayValue } = measurement;
    return new Measurement(numericValue, numericUnit, displayValue);
  }
}
