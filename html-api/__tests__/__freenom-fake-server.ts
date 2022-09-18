import { createServer, RequestListener } from 'http';
export type { RequestListener } from 'http';

export default class Server {
  private _server: ReturnType<typeof createServer>;
  private _requestHandler: RequestListener | undefined;

  constructor(handler?: RequestListener) {
    this._server = createServer((req, res) => {
      if (this._requestHandler != null) {
        return this._requestHandler(req, res);
      } else {
        console.warn('Request handler not defined, set handler by "setRequestHandler"');
      }
    });
    if (handler != null) {
      this.setHandler(handler);
    }

    this._server.on('error', (err) => console.error('Server error:', err));
  }

  setHandler(handler: RequestListener): Server {
    this._requestHandler = handler;
    return this;
  }

  get address(): string {
    const adr = this._server.address();
    if (!adr) {
      return '';
    }
    if (typeof adr === 'string') {
      return adr;
    }
    return `${adr.address === '::' ? 'localhost' : adr.address}:${adr.port}`;
  }

  get adrOptions(): { host?: string; port?: number } {
    const adr = this._server.address();
    if (!adr) {
      return {};
    }
    if (typeof adr === 'string') {
      const match = adr.match(/^([^:]+)(?::(\d+))?$/);
      if (match) {
        return { host: match[1], port: +match[2] };
      } else {
        return {};
      }
    }
    return {
      host: adr.address === '::' ? 'localhost' : adr.address,
      port: adr.port
    };
  }

  get listening(): boolean {
    return this._server.listening;
  }

  async start(port = 0, host?: string): Promise<Server> {
    return new Promise((resolve, reject) => {
      this._server.listen({ port, host }, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  async stop(): Promise<Server> {
    return new Promise((resolve, reject) => {
      this._server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }
}

/*
const server = http.createServer((req, res) => {
  console.info('request');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('Hello');
});

server.listen(3333, () => {
  console.info('started', server.address());
});
*/
