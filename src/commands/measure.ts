const lighthouse = require('lighthouse');

import fs from 'fs';
import puppeteer from 'puppeteer';
import { URL } from 'url';
import { ExperimentConfiguration } from '../specs/json';
import { serve } from './serve';

/**
 * Open Chrome and measure Lighthouse Performance audits against the given URL.
 *
 * @param url The url to measure.
 * @returns The generated Lighthouse audits.
 */
export const measure = async (configuration?: ExperimentConfiguration) => {
  const server = await serve(configuration);

  // Use Puppeteer to launch headful Chrome and don't use its default 800x600 viewport.
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const lighthouseConfig = {
    port: new URL(browser.wsEndpoint()).port,
    logLevel: 'info',
    onlyCategories: ['performance'],
    output: 'json',
  };

  const result = await lighthouse('http://localhost:9000', lighthouseConfig);
  const lhr: { audits: any[] } = result.lhr;
  const audits = [];

  if (configuration) {
    fs.mkdirSync('out/lighthouse', { recursive: true });
    fs.writeFileSync(
      `out/lighthouse/${configuration.toString()}.json`,
      JSON.stringify(lhr, null, 2)
    );
  }

  for (const audit of Object.values(lhr.audits)) {
    if (audit.numericValue) {
      audits.push(audit);
    }
  }

  await browser.close();
  await server.stop();
  return audits;
};
