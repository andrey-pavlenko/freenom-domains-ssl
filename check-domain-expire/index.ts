import log4js from 'log4js';
import { createTransport } from 'nodemailer';
import { login, renewable } from '@freenom/html-api';

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: { type: 'pattern', pattern: '%[%d{yyyy-MM-dd hh:mm:ss,SSS} [%-5p]%] -- %m' }
    }
  },
  categories: {
    default: { appenders: ['out'], level: process.env.LOGLEVEL ?? 'all' }
  }
});

const logger = log4js.getLogger();

async function getCookie(): Promise<string[]> {
  const errors: string[] = [];

  if (!process.env.FREENOM_LOGIN) {
    errors.push('process.env.FREENOM_LOGIN is empty');
  }
  if (!process.env.FREENOM_PASSWORD) {
    errors.push('process.env.FREENOM_PASSWORD is empty');
  }

  if (errors.length) {
    throw new Error(`getCookie failed: ${errors.join(', ')}`);
  }

  return (await login(process.env.FREENOM_LOGIN ?? '', process.env.FREENOM_PASSWORD ?? ''))
    .setCookie;
}

function createSmtpTransport(): ReturnType<typeof createTransport> {
  const errors: string[] = [];
  let port = NaN;

  if (!process.env.SMTP_HOST) {
    errors.push('process.env.SMTP_HOST is empty');
  }
  if (!process.env.SMTP_PORT) {
    errors.push('process.env.SMTP_PORT is empty');
  } else {
    port = +process.env.SMTP_PORT;
    if (isNaN(port) || port <= 0) {
      errors.push(`process.env.SMTP_PORT is invalid: "${process.env.SMTP_PORT}"`);
    }
  }
  if (!process.env.SMTP_USER) {
    errors.push('process.env.SMTP_USER is empty');
  }
  if (!process.env.SMTP_PASS) {
    errors.push('process.env.SMTP_PASS is empty');
  }
  if (!process.env.NOTIFY_MAIL_FROM) {
    errors.push('process.env.NOTIFY_MAIL_FROM is empty');
  }
  if (!process.env.NOTIFY_MAIL_TO) {
    errors.push('process.env.NOTIFY_MAIL_TO is empty');
  }

  if (errors.length) {
    throw new Error(`createSmtpTransport failed: ${errors.join(', ')}`);
  }

  return createTransport({
    host: process.env.SMTP_HOST,
    port,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function task() {
  logger.info('Check domain expiration: task start');

  try {
    logger.debug('Request login cookie');

    const smtpTransport = createSmtpTransport();

    const cookie = await getCookie();
    logger.debug('Got login cookie', cookie);

    logger.debug('Request renewable domains');
    const { domains, errors } = await renewable(
      'https://my.freenom.com/domains.php?a=renewals',
      cookie
    );
    logger.debug(
      'Got renewable domains',
      (domains ?? []).map(({ name, daysLeft }) => ({ name, daysLeft }))
    );
    if (errors?.length) {
      logger.error('Got renewable domains has errors', errors);
    }

    const domainsSoonExpire = (domains ?? []).filter((d) => d.daysLeft <= d.minRenewalDays);

    if (domainsSoonExpire.length || errors?.length) {
      const domains = (domainsSoonExpire ?? []).map(
        ({ name, daysLeft }) => `${name} expires in ${daysLeft} days`
      );
      logger.info('Notification about domains are expiring or errors', {
        domains,
        errors
      });
      await new Promise<void>((resolve, reject) => {
        smtpTransport.sendMail(
          {
            from: process.env.NOTIFY_MAIL_FROM,
            to: process.env.NOTIFY_MAIL_TO,
            subject: 'Domain expiration result',
            text: [
              domains.length ? `Domains are expiring:\n\n${domains.join('\n')}` : '',
              errors?.length ? `Errors when checking domains:\n\n${errors.join('\n')}` : ''
            ].join('\n\n')
          },
          (error) => {
            if (error) {
              reject(error);
            } else {
              logger.debug('Mail successfully sent');
              resolve();
            }
          }
        );
      });
    } else {
      logger.info('No domains about to expire and no errors');
    }
    logger.info('Check domain expiration: task end');
  } catch (e) {
    logger.fatal('Task failed:', e);
  }
}

task();
