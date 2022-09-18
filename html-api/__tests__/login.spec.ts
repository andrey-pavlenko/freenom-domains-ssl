import FakeServer from '@freenom/fake-server';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { getLoginFormHtml, getLoginData, postLoginData } from '../login';
import { login } from '../index';

describe('login.ts', () => {
  describe('getLoginform', () => {
    const server = new FakeServer();

    beforeAll(async () => {
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    it('getLoginform: success', async () => {
      server.setHandler((req, res) => {
        if (!req.headers['user-agent']?.match(/^mozilla\/\d/i)) {
          res.statusCode = 400;
          res.end();
          return;
        }

        if (req.url != '/auth') {
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

      const loginHtml = await getLoginFormHtml(server.address, { 'user-agent': 'Mozilla/5.0' });
      expect(loginHtml.address).toBe(server.address + '/auth');
      expect(loginHtml.cookies.length).toBeGreaterThan(1);
      expect(loginHtml.html.startsWith('<!DOCTYPE html>')).toBeTruthy();
    });

    it('getLoginform: success but no redirect, no cookie', async () => {
      server.setHandler((req, res) => {
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(`<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document</title>
        </head>
        <body>Hello</body>
        </html>`);
      });

      const loginHtml = await getLoginFormHtml(server.address, { 'user-agent': 'Mozilla/5.0' });
      expect(loginHtml.address).toBe(server.address + '/');
      expect(loginHtml.cookies).toBe('');
      expect(loginHtml.html.startsWith('<!DOCTYPE html>')).toBeTruthy();
    });

    it('getLoginform: fail wrong type application/json', async () => {
      server.setHandler((req, res) => {
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ test: 'Test' }));
      });

      try {
        await getLoginFormHtml(server.address, { 'user-agent': 'Mozilla/5.0' });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/success status code.*application\/json/i);
      }
    });

    it('getLoginform: fail wrong statusCode', async () => {
      server.setHandler((req, res) => {
        res.statusCode = 400;
        res.end();
      });

      try {
        await getLoginFormHtml(server.address, { 'user-agent': 'Mozilla/5.0' });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/status code[\s"]*400\D/i);
      }
    });

    it('getLoginform: fail maximum requests', async () => {
      server.setHandler((req, res) => {
        res.statusCode = 302;
        res.end();
      });

      try {
        await getLoginFormHtml(server.address, { 'user-agent': 'Mozilla/5.0' });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/maximum requests reached/i);
      }
    });

    it.skip('getLoginform: real request', async () => {
      const loginHtml = await getLoginFormHtml('https://my.freenom.com', {
        'user-agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.101 Safari/537.36'
      });
      expect(loginHtml.address).toBe('https://my.freenom.com/clientarea.php');
      expect(loginHtml.cookies.startsWith('WHMC')).toBeTruthy();
      expect(loginHtml.html.startsWith('<!DOCTYPE html>')).toBeTruthy();

      console.info({
        ...loginHtml,
        ...{ html: `${loginHtml.html.slice(0, 20)} ... ${loginHtml.html.length} bytes` }
      });
    });
  });

  describe('getLoginData', () => {
    it('empty html, should throw error', () => {
      try {
        getLoginData('');
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/input\[type=password\] not found/i);
      }
    });

    it('html without form, should throw error', () => {
      try {
        getLoginData('<p>Hello world</p>');
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/input\[type=password\] not found/i);
      }
    });

    it('html with password and no form, should throw error', () => {
      try {
        getLoginData('<div><p>Hello world</p><input type="password" /></div>');
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/parent\s+form\s+of\s+input.*not\s+found/i);
      }
    });

    it('html with form, success', () => {
      let data = getLoginData('<form><input type="password" /></form>');
      expect(data).toStrictEqual({
        action: 'about:blank',
        method: 'get',
        inputs: [{ name: '', type: 'password', value: '' }]
      });
      data = getLoginData(`<form action="test" method="post">
      <input type="text" name="login" />
      <input type="password" name="password" />
      <input type="hidden" name="token" value="test"/>
      </form>`);
      expect(data).toStrictEqual({
        action: 'test',
        method: 'post',
        inputs: [
          { name: 'login', type: 'text', value: '' },
          { name: 'password', type: 'password', value: '' },
          { name: 'token', type: 'hidden', value: 'test' }
        ]
      });
    });

    it('html real form', () => {
      const data = getLoginData(`<!DOCTYPE html>
<html lang="en">

<head>
  <!--Start of header.tpl from directory Freenom-->
  <meta http-equiv="content-type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  </meta>
  <title>Client Area - Freenom</title>
  <base href="https://my.freenom.com/" />
</head>

<body class="Client Area ">
  <div class="wrapper">
    <section class="login">
      <div class="row margin padding">
        <div class="container">
          <div class="col-md-12 textCenter">
            <h1 class="splash">Login</h1>
          </div>
          <div class="col-md-4 max-width form">
            <form method="post" action="dologin.php" class="form-stacked">
              <input type="hidden" name="token" value="c33ee17fef7c0b26fd7a7d52521338bad4cad924" />
              <div class="form-segment">
                <strong>Sign in with your e-mail</strong>
                <div class="control-group">
                  <div class="controls">
                    <input class="input-xlarge" placeholder="Email Address" name="username" id="username" type="text" />
                  </div>
                </div>
                <div class="control-group">
                  <div class="controls">
                    <input name="password" placeholder="Password" id="password" type="password" />
                  </div>
                </div>
                <input type="submit" class="largeBtn primaryColor pullRight" value="Login" />
                <div class="rememberMe">
                  <input type="checkbox" id="rememberMe" name="rememberme" /> <label for="rememberMe">Remember
                    Me</label>
                </div>

                <span class="passwordReset"><a href="pwreset.php"> Request a Password Reset</a></span>
              </div>
              <div class="form-segment fb">
                <div class="socialLogin">
                  <strong>Use social sign in</strong>
                  <div class="g-signin2" data-onsuccess="onSignIn" data-prompt="select_account"></div>
                  <div class="fb-login-button" data-width="320" data-max-rows="1" data-size="large"
                    data-button-type="continue_with" data-show-faces="false" data-auto-logout-link="false"
                    onlogin="checkLoginState();" data-use-continue-as="false"></div>
                </div>
              </div>
            </form>
            <form id="gl" action="/sociallogin.php" method="POST">
              <input type="hidden" name="token" value="c33ee17fef7c0b26fd7a7d52521338bad4cad924" />
              <input type="hidden" name="token_id" id="token_id" />
            </form>
            <form id="fl" action="/sociallogin.php" method="POST">
              <input type="hidden" name="token" value="c33ee17fef7c0b26fd7a7d52521338bad4cad924" />
              <input type="hidden" name="access_token" id="access_token" />
            </form>
          </div>
        </div>
      </div>
    </section>
  </div>
</body>

</html>`);
      expect(data).toStrictEqual({
        action: 'https://my.freenom.com/dologin.php',
        method: 'post',
        inputs: [
          {
            name: 'token',
            type: 'hidden',
            value: 'c33ee17fef7c0b26fd7a7d52521338bad4cad924'
          },
          { name: 'username', type: 'text', value: '' },
          { name: 'password', type: 'password', value: '' },
          { name: '', type: 'submit', value: 'Login' },
          { name: 'rememberme', type: 'checkbox', value: 'on' }
        ]
      });
    });
  });

  describe('postLoginData', () => {
    const server = new FakeServer();

    beforeAll(async () => {
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    it('postLoginData: success', async () => {
      server.setHandler(async (req, res) => {
        if (!req.headers['user-agent']?.match(/^mozilla\/\d/i)) {
          res.statusCode = 400;
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 400;
          res.end();
          return;
        }

        if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
          res.statusCode = 403;
          res.end();
          return;
        }

        if (!req.headers.cookie || req.headers.cookie !== 'WMZ=wmz') {
          res.statusCode = 403;
          res.end();
          return;
        }

        const { login, password } = Object.fromEntries(new URLSearchParams(await server.body(req)));
        if (password !== 'password') {
          res.statusCode = 403;
          res.end();
          return;
        }

        res.statusCode = 302;
        res.setHeader('set-cookie', [
          serializeCookie('Session', 'Test', {
            httpOnly: true,
            domain: '/'
          }),
          serializeCookie('User', login, {
            httpOnly: true,
            domain: '/'
          })
        ]);
        res.setHeader('location', server.address + '/account');
        res.end();
      });

      const res = await postLoginData(server.address, {
        cookie: 'WMZ=wmz',
        data: { login: 'test', password: 'password' },
        headers: { 'user-agent': 'Mozilla/5.0' }
      });
      expect(res.address).toBe(server.address + '/account');
      expect(res.cookies).toBe('Session=Test;User=test');
    });

    it('postLoginData: no redirect, failed', async () => {
      server.setHandler(async (req, res) => {
        res.write('Hello');
        res.end();
      });

      try {
        await postLoginData(server.address, {
          cookie: '',
          data: { login: 'test', password: 'password' },
          headers: { 'user-agent': 'Mozilla/5.0' }
        });
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/received a status code.*without a redirection/i);
      }
    });

    it('postLoginData: no set-cookie, failed', async () => {
      server.setHandler(async (req, res) => {
        res.statusCode = 302;
        res.setHeader('location', '/text');
        res.end();
      });

      try {
        await postLoginData(server.address, {
          cookie: '',
          data: { login: 'test', password: 'password' },
          headers: { 'user-agent': 'Mozilla/5.0' }
        });
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/has no set-cookie header/i);
      }
    });
  });

  describe('login', () => {
    let clearFormCookie = false;
    let formMethod = 'post';
    let formInputs = `<input type="hidden" name="token" value="c33ee17fef7c0b26fd7a7d52521338bad4cad924" />
    <input class="input-xlarge" placeholder="Email Address" name="username" id="username" type="text" />
    <input name="password" placeholder="Password" id="password" type="password" />
    <input type="checkbox" id="rememberMe" name="rememberme" />
    <input type="submit" class="largeBtn primaryColor pullRight" value="Login" />
`;

    const server = new FakeServer();
    server.setHandler(async (req, res) => {
      if (!req.headers['user-agent']?.match(/^mozilla\/\d/i)) {
        res.statusCode = 403;
        res.end();
        return;
      }

      if (req.method === 'GET') {
        if (req.url != '/auth') {
          res.statusCode = 302;
          res.setHeader('location', '/auth');
          res.end();
          return;
        }

        const cookie = parseCookie(req.headers.cookie || '');
        if (cookie.Session != 'init') {
          res.statusCode = 302;
          res.setHeader('location', '/auth');
          res.setHeader('set-cookie', [
            serializeCookie('Session', 'init', {
              httpOnly: true,
              domain: '/'
            })
          ]);
          res.end();
          return;
        }

        if (clearFormCookie) {
          res.setHeader('set-cookie', '');
        } else {
          res.setHeader('set-cookie', [
            serializeCookie('Session', 'init', {
              httpOnly: true,
              domain: '/'
            })
          ]);
        }
        res.setHeader('content-type', 'text/html');
        res.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <!--Start of header.tpl from directory Freenom-->
  <meta http-equiv="content-type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0"></meta>
  <title>Auth</title>
  <base href="${server.address}/}" />
</head>

<body>
  <form method="${formMethod}" action="login">
    ${formInputs}
  </form>
</body>

</html>`);
      }

      if (req.method === 'POST') {
        if (req.headers['content-type'] !== 'application/x-www-form-urlencoded') {
          res.statusCode = 403;
          res.end();
          return;
        }

        if (!req.headers.cookie || req.headers.cookie !== 'Session=init') {
          res.statusCode = 403;
          res.end();
          return;
        }

        const { username, password } = Object.fromEntries(
          new URLSearchParams(await server.body(req))
        );
        if (password !== 'password') {
          res.statusCode = 403;
          res.end();
          return;
        }

        res.statusCode = 302;
        res.setHeader('set-cookie', [
          serializeCookie('Session', 'Test', {
            httpOnly: true,
            domain: '/'
          }),
          serializeCookie('User', username, {
            httpOnly: true,
            domain: '/'
          })
        ]);
        res.setHeader('location', server.address + '/account');
        res.end();
      }

      res.statusCode = 400;
      res.end();
    });

    beforeAll(async () => {
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    it('login: success', async () => {
      const res = await login(server.address, 'test', 'password', { 'user-agent': 'Mozilla/5.0' });
      expect(res.address).toBe(server.address + '/account');
      expect(res.cookies).toBe('Session=Test;User=test');
    });

    it('login: fail no cookie', async () => {
      clearFormCookie = true;
      try {
        await login(server.address, 'test', 'password', { 'user-agent': 'Mozilla/5.0' });
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/login failed: undefined "cookie" in the form/);
      }
    });

    it('login: fail wrong method', async () => {
      clearFormCookie = false;
      formMethod = 'get';
      try {
        await login(server.address, 'test', 'password', { 'user-agent': 'Mozilla/5.0' });
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/login failed: "method" must be "POST"/);
      }
    });

    it('login: fail missing inputs', async () => {
      formMethod = 'post';
      const _formInputs = formInputs;
      formInputs = `<input class="input-xlarge" placeholder="Email Address" type="text" />
    <input type="password" />
    <input type="submit" class="largeBtn primaryColor pullRight" value="Login" />`;

      try {
        await login(server.address, 'test', 'password', { 'user-agent': 'Mozilla/5.0' });
        expect('Should thow error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(
          /login failed: the required inputs "token", "username", "password" are missing/
        );
      }
      formInputs = _formInputs;
    });

    it.skip('login: real', async () => {
      if (!(process.env.FREENOM_LOGIN && process.env.FREENOM_PASSWORD && process.env.FREENOM_URL)) {
        console.info(
          'Missing some env variables: "FREENOM_LOGIN", "FREENOM_PASSWORD", "FREENOM_URL"'
        );
        return;
      }
      const res = await login(
        process.env.FREENOM_URL,
        process.env.FREENOM_LOGIN,
        process.env.FREENOM_PASSWORD,
        {
          'user-agent':
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.101 Safari/537.36'
        }
      );
      // console.info(res);
      expect(res.address).toBe('/clientarea.php');
      expect(res.cookies).toMatch(/WHMCS[\w]+=[\w]+;WHMCSUser=[\w]+/);
    });
  });
});
