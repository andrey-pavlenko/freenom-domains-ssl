import { request as httpsRequest } from 'https';
import { request as httpRequest, RequestOptions, IncomingMessage } from 'http';

export interface Response extends IncomingMessage {
  body: Promise<string>;
}
export async function request(
  options: string | URL | RequestOptions,
  body?: string | Buffer
): Promise<Response> {
  if (typeof options === 'string') {
    options = new URL(options);
  }
  const requestFn = options.protocol === 'https:' ? httpsRequest : httpRequest;
  return new Promise((resolve, reject) => {
    const request = requestFn(options, (response) => {
      if (response.readable) {
        (response as Response).body = new Promise((resolve, reject) => {
          let data = '';
          response.on('data', (chunk) => (data += chunk));
          response.on('close', () => resolve(data));
          response.on('end', () => resolve(data));
          response.on('error', reject);
        });
      } else {
        (response as Response).body = Promise.resolve('');
      }
      resolve(response as Response);
    });
    request.on('error', reject);
    if (body != null) {
      request.write(body, (err) => {
        if (err) {
          reject(err);
        }
      });
    }
    request.end();
  });
}

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export function isRedirect(statusCode: number | undefined): boolean {
  return redirectStatuses.has(statusCode ?? NaN);
}
