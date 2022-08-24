import { stringify as querystringStringify } from 'querystring';
import axios, { AxiosError } from 'axios';
import { JSDOM } from 'jsdom';
import { LOGIN_PAGE, USER_AGENT } from './options';

export enum ErrorTypes {
  INIT_SESSION_NO_REDIRECT,
  INIT_SESSION_BAD_LOCATION,
  INIT_SESSION_NO_COOKIE,
  PARSE_LOGIN_FORM_FAILED,
  LOGIN_REQUEST_NO_REDIRECT,
  LOGIN_REQUEST_NO_COOKIE,
  LOGIN_REQUEST_BAD_LOCATION,
  LOGIN_PAGE_INCORRECT_TYPE,
  LOGIN_PAGE_INCORRECT_FORM,
  LOGIN_INCORRECT
}

export class LoginError extends Error {
  public readonly code: number;
  constructor(code: number, message?: string) {
    super(message ?? ErrorTypes[code]);
    this.code = code;
  }
}

const redirectStatuses = new Set([301, 302, 303, 307]);

function parseRedirect(
  { response, request }: AxiosError,
  {
    noRedirectCode,
    noCookieCode,
    badLocationCode
  }: { noRedirectCode: number; noCookieCode: number; badLocationCode: number }
): {
  setCookie: string[];
  location: string;
} {
  if (!redirectStatuses.has(response?.status ?? -1)) {
    throw new LoginError(
      noRedirectCode,
      `response status "${response?.status}: ${response?.statusText}" is not redirect status`
    );
  }
  const setCookie = response?.headers['set-cookie'];
  if (!setCookie) {
    throw new LoginError(
      noCookieCode,
      response?.headers
        ? `missing "set-cookie" in response.headers ${JSON.stringify(response.headers)}`
        : 'missing response.headers'
    );
  }
  const protocol = request.protocol;
  const host: string = request.host;
  const location = response?.headers['location'];
  if (!protocol || !host || !location) {
    throw new LoginError(
      badLocationCode,
      `protocol: "${protocol}", host: "${host}", location: "${location}"`
    );
  }
  return {
    setCookie,
    location: `${protocol}//${host}/${location.replace(/^\/+/, '')}`
  };
}

export async function initLoginSession(url: string): Promise<{
  loginUrl: string;
  cookie: string;
}> {
  try {
    await axios.get(url, {
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'cache-control': 'no-cache',
        pragma: 'no-cache'
      },
      maxRedirects: 0
    });
    throw new LoginError(ErrorTypes.INIT_SESSION_NO_REDIRECT, 'response without redirect');
  } catch (e) {
    if (e instanceof AxiosError) {
      const { setCookie, location } = parseRedirect(e, {
        noRedirectCode: ErrorTypes.INIT_SESSION_NO_REDIRECT,
        noCookieCode: ErrorTypes.INIT_SESSION_NO_COOKIE,
        badLocationCode: ErrorTypes.INIT_SESSION_BAD_LOCATION
      });
      const cookie = setCookie
        .map((c) => c.split(';')[0]?.trim())
        .filter((c) => !!c)
        .join(';');
      if (cookie.length === 0) {
        throw new LoginError(
          ErrorTypes.INIT_SESSION_NO_COOKIE,
          `array is empty after extract cookie from ${JSON.stringify(setCookie)}`
        );
      }
      return {
        loginUrl: location,
        cookie
      };
    } else {
      throw e;
    }
  }
}

interface LoginFormInput {
  name: string;
  type: string;
  value: string;
}

export function parseLoginForm(htmlPage: string): {
  action: string;
  method: string;
  inputs: LoginFormInput[];
} {
  const dom = new JSDOM(htmlPage);
  const document = dom.window.document;
  const form = (() => {
    const password = document.querySelector('input[type=password]');
    if (!password) {
      throw new LoginError(ErrorTypes.PARSE_LOGIN_FORM_FAILED, 'input[type=password] not found');
    }
    const form = password.closest('form');
    if (!form) {
      throw new LoginError(
        ErrorTypes.PARSE_LOGIN_FORM_FAILED,
        'parent form of input[type=password] not found'
      );
    }
    return form;
  })();
  const action = form.action;
  const method = form.method;
  const inputs: LoginFormInput[] = [];
  form.querySelectorAll('input').forEach(({ name, type, value }) => {
    inputs.push({ name, type, value });
  });
  return { action, method, inputs };
}

export async function loginPostRequest({
  url,
  referer,
  data,
  cookie
}: {
  url: string;
  referer: string;
  data: Record<string, string>;
  cookie: string;
}): Promise<{ accountUrl: string; setCookie: string[] }> {
  try {
    await axios.post(url, querystringStringify(data), {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded',
        pragma: 'no-cache',
        'user-agent': USER_AGENT,
        cookie,
        referer
      },
      maxRedirects: 0
    });
    throw new LoginError(ErrorTypes.LOGIN_REQUEST_NO_REDIRECT, 'response without redirect');
  } catch (e) {
    if (e instanceof AxiosError) {
      const { setCookie, location } = parseRedirect(e, {
        noRedirectCode: ErrorTypes.LOGIN_REQUEST_NO_REDIRECT,
        noCookieCode: ErrorTypes.LOGIN_REQUEST_NO_COOKIE,
        badLocationCode: ErrorTypes.LOGIN_REQUEST_BAD_LOCATION
      });
      if (setCookie.length === 0) {
        throw new LoginError(
          ErrorTypes.LOGIN_REQUEST_NO_COOKIE,
          `setCookie is empty ${JSON.stringify(setCookie)}`
        );
      }
      if (!setCookie.some((c) => c.match(/^[A-Z]+user=/i))) {
        throw new LoginError(
          ErrorTypes.LOGIN_INCORRECT,
          `incorrect login, setCookie doesn't contains user ${JSON.stringify(setCookie)}`
        );
      }
      return {
        accountUrl: location,
        setCookie
      };
    } else {
      throw e;
    }
  }
}

export default async function login(
  login: string,
  password: string
): Promise<{ accountUrl: string; setCookie: string[] }> {
  const session = await initLoginSession(LOGIN_PAGE);
  const loginPageResponse = await axios.get(session.loginUrl, {
    headers: {
      cookie: session.cookie,
      'user-agent': USER_AGENT
    }
  });
  if (!loginPageResponse.headers['content-type'].startsWith('text/html')) {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_TYPE,
      `"content-type" is not "text/html", headers: ${JSON.stringify(loginPageResponse.headers)}`
    );
  }
  const loginForm = parseLoginForm(loginPageResponse.data);
  if (!loginForm.action) {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_FORM,
      `"form.action is invalid, form: ${JSON.stringify(loginForm)}`
    );
  }
  if (!loginForm.action.match(/^https?:\/\//)) {
    const loginPostUrl = new URL(session.loginUrl);
    loginPostUrl.pathname = loginForm.action;
    loginForm.action = loginPostUrl.href;
  }
  if (!loginForm.method || loginForm.method !== 'post') {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_FORM,
      `"form.method is invalid, expected "post", form: ${JSON.stringify(loginForm)}`
    );
  }
  if (!loginForm.inputs.find((i) => i.name === 'token')) {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_FORM,
      `"form.inputs[name=token] not found, form: ${JSON.stringify(loginForm)}`
    );
  }
  if (!loginForm.inputs.find((i) => i.name === 'username')) {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_FORM,
      `"form.inputs[name=username] not found, form: ${JSON.stringify(loginForm)}`
    );
  }
  if (!loginForm.inputs.find((i) => i.name === 'password' && i.type === 'password')) {
    throw new LoginError(
      ErrorTypes.LOGIN_PAGE_INCORRECT_FORM,
      `"form.inputs[name=password, type=password] not found, form: ${JSON.stringify(loginForm)}`
    );
  }
  loginForm.inputs = loginForm.inputs.map((i) => {
    if (i.name === 'username') {
      i.value = login;
    } else if (i.name === 'password' && i.type === 'password') {
      i.value = password;
    }
    return i;
  });
  const data: Record<string, string> = {};
  for (const i of loginForm.inputs) {
    if (i.name) {
      data[i.name] = i.value;
    }
  }
  return await loginPostRequest({
    url: loginForm.action,
    referer: session.loginUrl,
    data,
    cookie: session.cookie
  });
}
