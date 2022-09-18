import axios, { AxiosError, AxiosResponseHeaders } from 'axios';
import login, {
  initLoginSession,
  parseLoginForm,
  loginPostRequest,
  LoginError,
  ErrorTypes
} from '../login';
import { LOGIN_PAGE } from '../options';

describe('login.ts', () => {
  describe('initLoginSession', () => {
    let axios_get: typeof axios.get;
    beforeAll(() => (axios_get = axios.get));
    afterAll(() => (axios.get = axios_get));

    it('no redirect, should throw error', async () => {
      axios.get = jest.fn(async () => Promise.resolve({})) as typeof axios.get;
      try {
        await initLoginSession('test');
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.INIT_SESSION_NO_REDIRECT);
      }
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('no AxiosError, should throw this error', async () => {
      const e = new Error('Custom error');
      axios.get = jest.fn(async () => Promise.reject(e)) as typeof axios.get;
      await expect(initLoginSession('test')).rejects.toThrow(e);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('no set-ccokie header, should throw error', async () => {
      axios.get = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            {},
            { data: '', status: 302, statusText: 'Found', config: {}, headers: {} }
          )
        )
      );
      try {
        await initLoginSession('test');
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.INIT_SESSION_NO_COOKIE);
      }
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('bad location, should throw error', async () => {
      axios.get = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            { protocol: 'http', host: 'test' },
            {
              data: '',
              status: 302,
              statusText: 'Found',
              config: {},
              headers: {
                'set-cookie': ['1']
              } as AxiosResponseHeaders
            }
          )
        )
      );
      try {
        await initLoginSession('test');
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.INIT_SESSION_BAD_LOCATION);
      }
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('sucess', async () => {
      const location = 'test';
      axios.get = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            { protocol: 'http:', host: 'test.ru' },
            {
              data: '',
              status: 302,
              statusText: 'Found',
              config: {},
              headers: {
                'set-cookie': [
                  'WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly',
                  'WHMCSUser=test; expires=Fri, 25-Aug-2023 15:59:30 GMT; Max-Age=31536000; path=/; httponly'
                ],
                location
              } as unknown as AxiosResponseHeaders
            }
          )
        )
      );
      expect(await initLoginSession('test')).toEqual({
        cookie: 'WHMCSZH5eHTGhfvzP=test;WHMCSUser=test',
        loginUrl: `http://test.ru/${location}`
      });
      expect(axios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('parseLoginForm', () => {
    it('empty html, should throw error', () => {
      try {
        parseLoginForm('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.PARSE_LOGIN_FORM_FAILED);
      }
    });

    it('html without form, should throw error', () => {
      try {
        parseLoginForm('<p>Hello world</p>');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.PARSE_LOGIN_FORM_FAILED);
        expect((e as LoginError).message).toMatch(/input.*not\s+found/i);
      }
    });

    it('html with password and no form, should throw error', () => {
      try {
        parseLoginForm('<div><p>Hello world</p><input type="password" /></div>');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.PARSE_LOGIN_FORM_FAILED);
        expect((e as LoginError).message).toMatch(/parent\s+form\s+of\s+input.*not\s+found/i);
      }
    });

    it('html with form, success', () => {
      let parsed = parseLoginForm('<form><input type="password" /></form>');
      expect(parsed).toStrictEqual({
        action: 'about:blank',
        method: 'get',
        inputs: [{ name: '', type: 'password', value: '' }]
      });
      parsed = parseLoginForm(`<form action="test" method="post">
      <input type="text" name="login" />
      <input type="password" name="password" />
      <input type="hidden" name="token" value="test"/>
      </form>`);
      expect(parsed).toStrictEqual({
        action: 'test',
        method: 'post',
        inputs: [
          { name: 'login', type: 'text', value: '' },
          { name: 'password', type: 'password', value: '' },
          { name: 'token', type: 'hidden', value: 'test' }
        ]
      });
    });
  });

  describe('loginPostRequest', () => {
    let axios_post: typeof axios.post;
    beforeAll(() => (axios_post = axios.post));
    afterAll(() => (axios.post = axios_post));

    it('no redirect, should throw error', async () => {
      axios.post = jest.fn(async () => Promise.resolve({})) as typeof axios.get;
      try {
        await loginPostRequest({ url: 'test', referer: 'test', cookie: 'test', data: {} });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.LOGIN_REQUEST_NO_REDIRECT);
      }
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('no AxiosError, should throw this error', async () => {
      const e = new Error('Custom error');
      axios.post = jest.fn(async () => Promise.reject(e)) as typeof axios.get;
      await expect(
        loginPostRequest({ url: 'test', referer: 'test', cookie: 'test', data: {} })
      ).rejects.toThrow(e);
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('no set-ccokie header, should throw error', async () => {
      axios.post = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            {},
            { data: '', status: 302, statusText: 'Found', config: {}, headers: {} }
          )
        )
      );
      try {
        await loginPostRequest({ url: 'test', referer: 'test', cookie: 'test', data: {} });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.LOGIN_REQUEST_NO_COOKIE);
      }
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('bad location, should throw error', async () => {
      axios.post = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            { protocol: 'http', host: 'test' },
            {
              data: '',
              status: 302,
              statusText: 'Found',
              config: {},
              headers: {
                'set-cookie': ['1']
              } as AxiosResponseHeaders
            }
          )
        )
      );
      try {
        await loginPostRequest({ url: 'test', referer: 'test', cookie: 'test', data: {} });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.LOGIN_REQUEST_BAD_LOCATION);
      }
      expect(axios.post).toHaveBeenCalledTimes(1);
    });

    it('sucess', async () => {
      const location = 'test';
      axios.post = jest.fn(() =>
        Promise.reject(
          new AxiosError(
            '',
            '',
            {},
            { protocol: 'http:', host: 'test.ru' },
            {
              data: '',
              status: 302,
              statusText: 'Found',
              config: {},
              headers: {
                'set-cookie': [
                  'WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly',
                  'WHMCSUser=test; expires=Fri, 25-Aug-2023 15:59:30 GMT; Max-Age=31536000; path=/; httponly'
                ],
                location
              } as unknown as AxiosResponseHeaders
            }
          )
        )
      );
      expect(
        await loginPostRequest({ url: 'test', referer: 'test', cookie: 'test', data: {} })
      ).toEqual({
        setCookie: [
          'WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly',
          'WHMCSUser=test; expires=Fri, 25-Aug-2023 15:59:30 GMT; Max-Age=31536000; path=/; httponly'
        ],
        accountUrl: `http://test.ru/${location}`
      });
      expect(axios.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    let axios_get: typeof axios.get;
    let axios_post: typeof axios.post;
    beforeAll(() => {
      axios_get = axios.get;
      axios_post = axios.post;
    });
    afterAll(() => {
      axios.get = axios_get;
      axios.post = axios_post;
    });

    it('incorrect login, should throw error', async () => {
      const url = new URL(LOGIN_PAGE);
      const axiosMock = {
        initLoginSession: jest.fn(() => {
          axios.get = axiosMock.getLoginPage;
          return Promise.reject(
            new AxiosError(
              '',
              '',
              {},
              { protocol: url.protocol, host: url.host },
              {
                data: '',
                status: 302,
                statusText: 'Found',
                config: {},
                headers: {
                  'set-cookie': ['WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly'],
                  location: 'test_page'
                } as unknown as AxiosResponseHeaders
              }
            )
          );
        }) as typeof axios.get,
        getLoginPage: jest.fn(() => {
          return Promise.resolve({
            data: `<div class="col-md-4 max-width form">
						<form method="post" action="dologin.php" class="form-stacked">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
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
									<!-- google -->
									<div class="g-signin2" data-onsuccess="onSignIn" data-prompt="select_account"></div>

									<!-- facebook -->
									<div class="fb-login-button" data-width="320" data-max-rows="1" data-size="large"
										data-button-type="continue_with" data-show-faces="false" data-auto-logout-link="false"
										onlogin="checkLoginState();" data-use-continue-as="false"></div>
								</div>
							</div>
						</form>
						<form id="gl" action="/sociallogin.php" method="POST">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
							<input type="hidden" name="token_id" id="token_id" />
						</form>
						<form id="fl" action="/sociallogin.php" method="POST">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
							<input type="hidden" name="access_token" id="access_token" />
						</form>
					</div>`,
            status: 200,
            config: {},
            headers: {
              'content-type': 'text/html; charset=utf-8'
            } as unknown as AxiosResponseHeaders
          });
        }) as typeof axios.get,
        loginPostRequest: jest.fn(() =>
          Promise.reject(
            new AxiosError(
              '',
              '',
              {},
              { protocol: url.protocol, host: url.host },
              {
                data: '',
                status: 302,
                statusText: 'Found',
                config: {},
                headers: {
                  'set-cookie': ['WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly'],
                  location: 'account'
                } as unknown as AxiosResponseHeaders
              }
            )
          )
        ) as typeof axios.post
      };
      axios.get = axiosMock.initLoginSession;
      axios.post = axiosMock.loginPostRequest;
      try {
        await login('test', 'test');
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(LoginError);
        expect((e as LoginError).code).toBe(ErrorTypes.LOGIN_INCORRECT);
      }
      expect(axiosMock.initLoginSession).toHaveBeenCalledTimes(1);
      expect((axiosMock.initLoginSession as jest.Mock).mock.lastCall[0]).toBe(LOGIN_PAGE);
      expect(axiosMock.getLoginPage).toBeCalledTimes(1);
      expect((axiosMock.getLoginPage as jest.Mock).mock.lastCall[0]).toBe(
        'https://my.freenom.com/test_page'
      );
      expect((axiosMock.getLoginPage as jest.Mock).mock.lastCall[1]).toMatchObject({
        headers: {
          cookie: 'WHMCSZH5eHTGhfvzP=test'
        }
      });
      expect(axiosMock.loginPostRequest).toBeCalledTimes(1);
      expect((axiosMock.loginPostRequest as jest.Mock).mock.lastCall[0]).toBe(
        'https://my.freenom.com/dologin.php'
      );
      expect((axiosMock.loginPostRequest as jest.Mock).mock.lastCall[2]).toMatchObject({
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: 'WHMCSZH5eHTGhfvzP=test'
        }
      });
    });

    it('success', async () => {
      const url = new URL(LOGIN_PAGE);
      const axiosMock = {
        initLoginSession: jest.fn(() => {
          axios.get = axiosMock.getLoginPage;
          return Promise.reject(
            new AxiosError(
              '',
              '',
              {},
              { protocol: url.protocol, host: url.host },
              {
                data: '',
                status: 302,
                statusText: 'Found',
                config: {},
                headers: {
                  'set-cookie': ['WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly'],
                  location: 'test_page'
                } as unknown as AxiosResponseHeaders
              }
            )
          );
        }) as typeof axios.get,
        getLoginPage: jest.fn(() => {
          return Promise.resolve({
            data: `<div class="col-md-4 max-width form">
						<form method="post" action="dologin.php" class="form-stacked">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
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
									<!-- google -->
									<div class="g-signin2" data-onsuccess="onSignIn" data-prompt="select_account"></div>

									<!-- facebook -->
									<div class="fb-login-button" data-width="320" data-max-rows="1" data-size="large"
										data-button-type="continue_with" data-show-faces="false" data-auto-logout-link="false"
										onlogin="checkLoginState();" data-use-continue-as="false"></div>
								</div>
							</div>
						</form>
						<form id="gl" action="/sociallogin.php" method="POST">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
							<input type="hidden" name="token_id" id="token_id" />
						</form>
						<form id="fl" action="/sociallogin.php" method="POST">
							<input type="hidden" name="token" value="be086a3fdfa6db1b2a98dcd9be87bfb20dc58b75" />
							<input type="hidden" name="access_token" id="access_token" />
						</form>
					</div>`,
            status: 200,
            config: {},
            headers: {
              'content-type': 'text/html; charset=utf-8'
            } as unknown as AxiosResponseHeaders
          });
        }) as typeof axios.get,
        loginPostRequest: jest.fn(() =>
          Promise.reject(
            new AxiosError(
              '',
              '',
              {},
              { protocol: url.protocol, host: url.host },
              {
                data: '',
                status: 302,
                statusText: 'Found',
                config: {},
                headers: {
                  'set-cookie': [
                    'WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly',
                    'WHMCSUser=test; expires=Fri, 25-Aug-2023 15:59:30 GMT; Max-Age=31536000; path=/; httponly'
                  ],
                  location: 'account'
                } as unknown as AxiosResponseHeaders
              }
            )
          )
        ) as typeof axios.post
      };
      axios.get = axiosMock.initLoginSession;
      axios.post = axiosMock.loginPostRequest;
      const result = await login('test', 'test');
      expect(axiosMock.initLoginSession).toHaveBeenCalledTimes(1);
      expect((axiosMock.initLoginSession as jest.Mock).mock.lastCall[0]).toBe(LOGIN_PAGE);
      expect(axiosMock.getLoginPage).toBeCalledTimes(1);
      expect((axiosMock.getLoginPage as jest.Mock).mock.lastCall[0]).toBe(
        'https://my.freenom.com/test_page'
      );
      expect((axiosMock.getLoginPage as jest.Mock).mock.lastCall[1]).toMatchObject({
        headers: {
          cookie: 'WHMCSZH5eHTGhfvzP=test'
        }
      });
      expect(axiosMock.loginPostRequest).toBeCalledTimes(1);
      expect((axiosMock.loginPostRequest as jest.Mock).mock.lastCall[0]).toBe(
        'https://my.freenom.com/dologin.php'
      );
      expect((axiosMock.loginPostRequest as jest.Mock).mock.lastCall[2]).toMatchObject({
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          cookie: 'WHMCSZH5eHTGhfvzP=test'
        }
      });
      expect(result).toStrictEqual({
        accountUrl: 'https://my.freenom.com/account',
        setCookie: [
          'WHMCSZH5eHTGhfvzP=test; path=/; HttpOnly',
          'WHMCSUser=test; expires=Fri, 25-Aug-2023 15:59:30 GMT; Max-Age=31536000; path=/; httponly'
        ]
      });
    });
  });
});
