import { createTransport } from 'nodemailer';
import { request } from 'https';

export let emailTransport: ReturnType<typeof createTransport> | null = null;
export function createEmailTransport(options: {
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
}): typeof emailTransport {
  const error = (['host', 'port', 'user', 'pass'] as const)
    .reduce((e, key) => {
      if (!options[key]) {
        e.push(`"options.${key}" is empty`);
      }
      return e;
    }, [] as string[])
    .join(', ');
  if (error) {
    emailTransport = null;
    throw new Error(error);
  }

  emailTransport = createTransport({
    host: options.host,
    port: options.port,
    auth: {
      user: options.user,
      pass: options.pass
    }
  });

  return emailTransport;
}

export async function email({
  from,
  to,
  subject,
  text
}: {
  from: string;
  to: string;
  subject?: string;
  text: string;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (emailTransport == null) {
      reject(new Error('emailTransport not initialized'));
      return;
    }
    emailTransport.sendMail(
      {
        from,
        to,
        subject,
        text
      },
      (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      }
    );
  });
}

export async function alarmer(key: string, text: string): Promise<void> {
  if (!key) {
    throw new Error('"key" must contain the Alarmer API key and cannot be empty');
  }
  const alarmerUrl = 'https://alarmerbot.ru';
  const url = alarmerUrl + '?' + new URLSearchParams({ key, message: text }).toString();
  return new Promise((resolve, reject) => {
    const rq = request(url, (response) => {
      response.on('error', reject);
      if (response.statusCode === 200) {
        resolve();
      } else {
        reject(new Error(`${alarmerUrl} statusCode "${response.statusCode}"`));
      }
    });
    rq.on('error', reject);
    rq.end();
  });
}
