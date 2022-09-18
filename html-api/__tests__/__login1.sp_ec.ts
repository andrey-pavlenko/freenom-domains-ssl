import { parse as parseSetCookie } from 'set-cookie-parser';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { request, isRedirect } from '../request';
import FakeServer from './freenom-fake-server';
// import https from 'https';
// import { IncomingMessage, RequestOptions } from 'http';

describe('login.ts', () => {
  const fakeServer = new FakeServer();

  beforeAll(async () => {
    await fakeServer.start();
  });

  afterAll(async () => {
    await fakeServer.stop();
  });

  it('test', async () => {
    fakeServer.setHandler((req, res) => {
      if (!req.headers['user-agent']?.match(/^mozilla\/\d/i)) {
        res.statusCode = 400;
        res.end();
        return;
      }

      if ((req.url || '/') != '/auth') {
        res.statusCode = 302;
        res.setHeader('location', '/auth');
        res.end();
        return;
      }

      const cookie = parseCookie(req.headers.cookie || '');
      if (cookie.InitSession != 'init') {
        res.statusCode = 302;
        res.setHeader('location', '/auth');
        res.setHeader('set-cookie', [
          serializeCookie('InitSession', 'init', {
            httpOnly: true,
            domain: '/'
          }),
          serializeCookie('Dummy', 'test', {
            httpOnly: true,
            domain: '/'
          })
        ]);
        res.end();
        return;
      }

      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(`<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
      </head>
      <body>
      	<form>
          <input type="hidden" name="token">
          <input type="text" name="username">
          <input type="text" name="password">
        </form>
      </body>
      </html>`);
    });

    let res = await request({ ...fakeServer.adrOptions, method: 'GET' });
    expect(res.statusCode).toBe(400);
    res = await request({
      ...fakeServer.adrOptions,
      method: 'GET',
      path: '/',
      headers: { 'user-agent': 'Mozilla/5.5' }
    });
    expect(res.statusCode).toBe(302);
    expect(isRedirect(res.statusCode)).toBeTruthy();
    expect(res.headers['location']).toBe('/auth');

    res = await request({
      ...fakeServer.adrOptions,
      method: 'GET',
      path: '/auth',
      headers: { 'user-agent': 'Mozilla/5.5' }
    });
    expect(res.statusCode).toBe(302);
    expect(isRedirect(res.statusCode)).toBeTruthy();
    expect(res.headers['location']).toBe('/auth');
    expect(res.headers['set-cookie']?.length).toBeGreaterThanOrEqual(1);

    const cookies = parseSetCookie(res);
    res = await request({
      ...fakeServer.adrOptions,
      method: 'GET',
      path: '/auth',
      headers: {
        'user-agent': 'Mozilla/5.5',
        cookie: cookies.map(({ name, value }) => serializeCookie(name, value)).join('; ')
      }
    });
    expect(res.statusCode).toBe(200);
    expect(isRedirect(res.statusCode)).toBeFalsy();
    expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
  });

  it.skip('https', async () => {
    const res = await request({
      host: 'qui-quo.tk',
      path: '/login',
      protocol: 'https:'
    });

    console.info(res.statusCode, res.headers);
    /*
    200 
    {
      server: 'nginx/1.18.0 (Ubuntu)',
      date: 'Sun, 18 Sep 2022 18:42:50 GMT',
      'content-type': 'text/html;charset=utf-8',
      'content-length': '4788',
      connection: 'close',
      'set-cookie': [
        'ring-session=72f13f24-b48b-4b9f-8e61-a316f38d3d45;Path=/;HttpOnly;Max-Age=604800'
      ],
      'accept-ranges': 'bytes'
    }
    */
  });
});
