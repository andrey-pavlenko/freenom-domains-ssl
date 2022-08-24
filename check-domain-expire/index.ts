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
  return [
    'WHMCSZH5eHTGhfvzP=49a4tqiq35g0692kbh1libckc7; path=/; HttpOnly',
    'WHMCSUser=1008653892%3A151ce8214e5c6e7b239f165f365b6f4b261ec55b; expires=Sat, 02-Sep-2023 11:11:13 GMT; Max-Age=31536000; path=/; httponly'
  ];
}
async function getCookie01(): Promise<string[]> {
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

const ds = [
  {
    id: 1119857068,
    name: 'lead.gq',
    isActive: true,
    daysLeft: 14,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1119857068'
  },
  {
    id: 1121401555,
    name: 'liorro.tk',
    isActive: true,
    daysLeft: 35,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1121401555'
  },
  {
    id: 1075424800,
    name: 'notezz.ml',
    isActive: true,
    daysLeft: 36,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1075424800'
  },
  {
    id: 1126762819,
    name: 'agato.tk',
    isActive: true,
    daysLeft: 160,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1126762819'
  },
  {
    id: 1127137852,
    name: 'foxy.tk',
    isActive: true,
    daysLeft: 167,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1127137852'
  },
  {
    id: 1134764844,
    name: 'qui-quo.tk',
    isActive: true,
    daysLeft: 308,
    minRenewalDays: 14,
    renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=1134764844'
  }
];

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

    // const cookie = await getCookie();
    const cookie = [
      'WHMCSZH5eHTGhfvzP=49a4tqiq35g0692kbh1libckc7; path=/; HttpOnly',
      'WHMCSUser=1008653892%3A151ce8214e5c6e7b239f165f365b6f4b261ec55b; expires=Sat, 02-Sep-2023 11:11:13 GMT; Max-Age=31536000; path=/; httponly'
    ];
    logger.debug('Got login cookie', cookie);

    logger.debug('Request renewable domains');
    // const { domains, errors } = await renewable(
    //   'https://my.freenom.com/domains.php?a=renewals',
    //   cookie
    // );
    const { domains, errors } = { domains: ds, errors: [] };
    logger.debug(
      'Got renewable domains',
      domains.map(({ name, daysLeft }) => ({ name, daysLeft }))
    );
    if (errors?.length) {
      logger.error('Got renewable domains has errors', errors);
    }

    const domainsSoonExpire = domains.filter((d) => d.daysLeft <= d.minRenewalDays);

    if (domainsSoonExpire.length || errors.length) {
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
              errors.length ? `Errors when checking domains:\n\n${errors.join('\n')}` : ''
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

    // if (domainsSoonExpire.length) {
    //   logger.info(
    //     'Notification about domains are expiring',
    //     domainsSoonExpire.map(({ name, daysLeft }) => ({ name, daysLeft }))
    //   );
    //   transport.sendMail(
    //     {
    //       from: 'andrey.pavlenko@mail.ru',
    //       to: 'andrey.pavlenko@mail.ru',
    //       subject: 'test',
    //       text: 'Soon expire'
    //     },
    //     (error) => console.info(error)
    //   );
    // } else {
    // }

    logger.info('Check domain expiration: task end');
  } catch (e) {
    logger.fatal('Task failed:', e);
  }
}

task();
