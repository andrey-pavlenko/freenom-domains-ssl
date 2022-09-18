import FakeServer from '@freenom/fake-server';
import { request, isRedirect } from '../index';
import { parse, format } from 'content-type';

describe('request.ts', () => {
  const server = new FakeServer();
  beforeAll(async () => server.start());
  afterAll(async () => server.stop());

  it('GET, response 400', async () => {
    server.setHandler((req, res) => {
      res.statusCode = 400;
      res.end();
    });

    let res = await request(server.address);
    expect(res.statusCode).toBe(400);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(await res.body).toBe('');
    res = await request(server.url);
    expect(res.statusCode).toBe(400);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(await res.body).toBe('');
  });

  it('GET, response 302', async () => {
    server.setHandler((req, res) => {
      res.statusCode = 302;
      res.setHeader('location', '/auth');
      res.end();
    });

    let res = await request(server.address);
    expect(res.statusCode).toBe(302);
    expect(isRedirect(res.statusCode)).toBeTruthy();
    expect(res.headers.location).toBe('/auth');
    expect(await res.body).toBe('');
    res = await request(server.url);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/auth');
    expect(isRedirect(res.statusCode)).toBeTruthy();
    expect(await res.body).toBe('');
  });

  it('GET, response 200 with body', async () => {
    server.setHandler((req, res) => {
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      res.end('Hello');
    });

    let res = await request(server.address);
    expect(res.statusCode).toBe(200);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(await res.body).toBe('Hello');
    expect(parse(res)).toEqual({ type: 'text/plain', parameters: { charset: 'utf-8' } });
    res = await request(server.url);
    expect(res.statusCode).toBe(200);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(parse(res)).toEqual({ type: 'text/plain', parameters: { charset: 'utf-8' } });
    expect(await res.body).toBe('Hello');
  });

  it('POST', async () => {
    server.setHandler(async (req, res) => {
      const contentType = req.headers['content-type'] ? parse(req) : { type: '' };
      if (req.method === 'POST' && req.url === '/item' && contentType.type === 'application/json') {
        res.setHeader('content-type', format(contentType));
        res.end(await server.body(req));
        return;
      }
      res.statusCode = 404;
      res.end();
    });

    const url = server.url;
    const data = { id: 1, data: 'Simple item' };
    let res = await request(
      {
        hostname: url.hostname,
        port: url.port,
        method: 'post',
        path: '/item',
        headers: {
          'content-type': 'application/json; charset=utf-8'
        }
      },
      JSON.stringify(data)
    );
    expect(res.statusCode).toBe(200);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(await res.body).toBe(JSON.stringify(data));
    expect(parse(res)).toEqual({ type: 'application/json', parameters: { charset: 'utf-8' } });

    res = await request({
      hostname: url.hostname,
      port: url.port,
      method: 'get',
      path: '/item'
    });
    expect(res.statusCode).toBe(404);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(await res.body).toBe('');
  });
});
