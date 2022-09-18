import { createServer, IncomingMessage, RequestListener } from 'http';
export type { RequestListener, IncomingMessage } from 'http';

export default class Server {
  private _server: ReturnType<typeof createServer>;
  private _protocol: string;
  private _requestHandler: RequestListener | undefined;

  constructor(handler?: RequestListener, protocol = 'http:') {
    this._protocol = protocol.endsWith(':') ? protocol : protocol + ':';
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

  get url(): URL {
    return new URL(this.address);
  }

  get address(): string {
    const adr = this._server.address();
    if (!adr) {
      return '';
    }
    if (typeof adr === 'string') {
      return this._protocol + '//' + adr;
    }
    return `${this._protocol}//${adr.address === '::' ? 'localhost' : adr.address}:${adr.port}`;
  }

  async body(request: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let data = '';
      request.on('error', reject);
      request.on('data', (chunk) => (data += chunk));
      request.on('end', () => resolve(data));
      request.on('close', () => resolve(data));
    });
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
