import * as http from 'http';
import * as url from 'url';
import * as fs from 'fs';
import * as path from 'path';

import * as metadata from '../specs/metadata';
import { ExperimentConfiguration } from '../specs/json';

export class WebServer {
  server = http.createServer(this.handler.bind(this));
  listening: Promise<void> = new Promise((resolve) => {
    this.server.on('listening', () => {
      resolve();
    });
  });
  remaps = new Map<string, string>();

  constructor(private root: string) {}

  private handler(req: http.IncomingMessage, res: http.ServerResponse) {
    const reqUrl = url.parse(req.url || '/');
    let reqPath = path.normalize(reqUrl.path || '/');
    if (!reqPath.startsWith('/')) return serveError(400, 'bad path');

    if (reqPath.endsWith('/')) reqPath += 'index.html';

    const remap = this.remaps.get(reqPath);
    reqPath = remap ? path.normalize(remap) : path.join(this.root, reqPath);

    const file = fs.createReadStream(reqPath);
    file.on('error', (err) => {
      serveError(500, err.toString());
    });
    file.pipe(res);

    function serveError(status: number, msg: string) {
      res.statusCode = status;
      res.end(msg);
    }
  }

  run(port: number) {
    this.server.listen(port);
    return this.listening;
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve();
      });
    });
  }

  cmdline(): string {
    let cmd = `node out/src/web_server.js --root=${this.root}`;
    for (const [src, dst] of this.remaps) {
      cmd += ` --remap=${src}=${dst}`;
    }
    return cmd;
  }
}

export async function serve(configuration?: ExperimentConfiguration) {
  /**
   * Initialize a default configuration if there isn't one. Load the metadata
   * for the given experiment.
   */
  if (!configuration) configuration = new ExperimentConfiguration();
  const config = metadata.js[configuration.experimentIdentifier];

  /**
   * Server variables.
   */
  const server = new WebServer(config?.test?.webroot || '');
  const port = 9000;
  const bundlePath = `out/data/${configuration.toString()}`;

  console.log(`Mapping bundle.js to ${bundlePath}`);
  console.log(`Serving at: http://localhost:${port}`);

  server.remaps.set('/bundle.js', bundlePath);
  await server.run(port);
  return server;
}
