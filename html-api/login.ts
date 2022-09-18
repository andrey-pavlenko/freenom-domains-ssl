import { parse as parseSetCookie } from 'set-cookie-parser';
import { serialize as serializeCookie } from 'cookie';
import { parse as parseContentType } from 'content-type';
import { JSDOM } from 'jsdom';
import { request, isRedirect, Response } from './request';
import type { OutgoingHttpHeaders } from 'http';

export async function login(
  url: string,
  username: string,
  password: string,
  headers?: OutgoingHttpHeaders
) {
  const form = await getLoginFormHtml(url, headers);
  if (!form.cookies) {
    throw new Error(
      `login failed: undefined "cookie" in the form ${JSON.stringify({
        ...form,
        html: `${form.html.slice(0, 20)} ... ${form.html.length} bytes`
      })}`
    );
  }
  const formData = getLoginData(form.html);

  const postUrl = ((action) => {
    if (action.match(/^https?:\/\//i)) {
      return action;
    } else if (action.startsWith('/')) {
      const u = new URL(url);
      u.pathname = action;
      return u.toString();
    } else if (action) {
      return url.replace(/\/$/, '') + '/' + action;
    } else {
      throw new Error(
        `login failed: undefined "action" in the formData ${JSON.stringify(formData)}`
      );
    }
  })(formData.action);

  if (formData.method.toLowerCase() !== 'post') {
    throw new Error(
      `login failed: "method" must be "POST" in the formData ${JSON.stringify(formData)}`
    );
  }

  const postData = (() => {
    const inputs = formData.inputs.reduce<Record<string, string>>((a, { name, value }) => {
      if (name) {
        a[name] = value;
      }
      return a;
    }, {});
    const missing = ['token', 'username', 'password']
      .reduce<string[]>((a, k) => {
        if (!(k in inputs)) a.push(k);
        return a;
      }, [])
      .map((s) => `"${s}"`)
      .join(', ');

    if (missing) {
      throw new Error(
        `login failed: the required inputs ${missing} are missing in the formData.inputs ${JSON.stringify(
          formData.inputs
        )}`
      );
    }
    inputs.username = username;
    inputs.password = password;
    return inputs;
  })();

  if (headers && form.address) {
    headers.referer = form.address;
  }

  return postLoginData(postUrl, { data: postData, cookie: form.cookies, headers });
}

export async function getLoginFormHtml(
  address: string,
  headers?: OutgoingHttpHeaders
): Promise<{ address: string; cookies: string; html: string }> {
  const sucessCodes = new Set([200, 304]);
  const url = new URL(address);
  const maxRequests = 4;
  let requestNo = 0;
  let cookies = '';
  let response: Response;

  while (requestNo < maxRequests) {
    response = await request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { ...headers, cookie: cookies }
    });

    if (response.headers['set-cookie']) {
      cookies = parseSetCookie(response)
        .map(({ name, value }) => serializeCookie(name, value))
        .join(';');
    }
    if (isRedirect(response.statusCode)) {
      if (response.headers.location) {
        url.pathname = response.headers.location;
      }
    } else if (sucessCodes.has(response.statusCode ?? NaN)) {
      if (parseContentType(response).type === 'text/html') {
        return {
          address: url.toString(),
          cookies,
          html: await response.body
        };
      } else {
        throw new Error(
          `getLoginFormHtml received a success status code "${
            response.statusCode
          }" from "${url.toString()}", but unsupported content-type. Headers ${JSON.stringify(
            response.headers
          )}`
        );
      }
    } else {
      throw new Error(
        `getLoginFormHtml received a status code "${
          response.statusCode
        }" without a redirection from "${url.toString()}". Headers ${JSON.stringify(
          response.headers
        )}`
      );
    }

    requestNo += 1;
  }
  throw new Error(`getLoginFormHtml maximum requests reached: ${maxRequests}`);
}

export function getLoginData(formHtml: string): {
  action: string;
  method: string;
  inputs: {
    name: string;
    type: string;
    value: string;
  }[];
} {
  const {
    window: { document }
  } = new JSDOM(formHtml);
  const { form, error }: { form?: HTMLFormElement; error?: string } = (() => {
    const password = document.querySelector('input[type=password]');
    if (!password) {
      return { error: 'input[type=password] not found' };
    }
    const form = password.closest('form');
    if (!form) {
      return { error: 'parent form of input[type=password] not found' };
    }
    return { form };
  })();
  if (error) {
    throw new Error(`getLoginData failed ${error}`);
  }
  if (!form) {
    throw new Error(`getLoginData form not found`);
  }
  const inputs = Array.from(form.querySelectorAll('input')).map(({ name, type, value }) => ({
    name,
    type,
    value
  }));
  return {
    action: form.action,
    method: form.method,
    inputs
  };
}

export interface PostLoginDataParams {
  data: Record<string, string>;
  cookie: string;
  headers?: OutgoingHttpHeaders;
}

export async function postLoginData(
  address: string,
  { data, cookie, headers }: PostLoginDataParams
): Promise<{
  address: string;
  cookies: string;
}> {
  const url = new URL(address);

  const response = await request(
    {
      hostname: url.hostname,
      port: url.port,
      method: 'post',
      path: url.pathname,
      headers: {
        ...headers,
        accept: 'text/html,application/xhtml+xml,application/xml',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded',
        pragma: 'no-cache',
        cookie
      }
    },
    new URLSearchParams(data).toString()
  );
  if (!isRedirect(response.statusCode)) {
    throw new Error(
      `postLoginData received a status code "${
        response.statusCode
      }" without a redirection from "${url.toString()}". Headers ${JSON.stringify(
        response.headers
      )}`
    );
  }
  if (!response.headers['set-cookie']) {
    throw new Error(
      `postLoginData response "${url.toString()}" has no set-cookie header. Headers ${JSON.stringify(
        response.headers
      )}`
    );
  }

  const cookies = parseSetCookie(response)
    .map(({ name, value }) => serializeCookie(name, value))
    .join(';');

  return {
    address: response.headers.location ?? '',
    cookies
  };
}
