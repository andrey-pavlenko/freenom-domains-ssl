import log4js from 'log4js';
import axios from 'axios';
import { login, renewable, RenewableDomain } from '@freenom/html-api';

log4js.configure({
  appenders: {
    out: {
      type: 'stdout',
      layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss,SSS} [%-5p] -- %m' }
    }
  },
  categories: {
    default: { appenders: ['out'], level: process.env.LOGLEVEL ?? 'all' }
  }
});

const logger = log4js.getLogger();

const options = {
  freenom_login: process.env.FREENOM_LOGIN,
  freenom_password: process.env.FREENOM_PASSWORD,
  freenom_renewals_url: 'https://my.freenom.com/domains.php?a=renewals',
  alarmer_api_key: process.env.ALARMER_API_KEY,
  alarmer_url: 'https://alarmerbot.ru',
  check() {
    const errors: string[] = [];
    if (!this.freenom_login) {
      errors.push('process.env.FREENOM_LOGIN is empty');
    }
    if (!this.freenom_password) {
      errors.push('process.env.FREENOM_PASSWORD is empty');
    }
    if (!this.alarmer_api_key) {
      errors.push('process.env.ALARMER_API_KEY is empty, unable to send notifications');
    }
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
  }
};

async function notify(domains: RenewableDomain[], errors?: string[]): Promise<string> {
  const expiringMessage = domains.length
    ? `The following domains will expire soon:\n\n${domains
        .map(({ name, daysLeft }) => `${name} expires in ${daysLeft} days`)
        .join('\n')}`
    : '';
  const errorsMessage =
    errors && errors.length ? `Errors when checking domains:\n\n${errors.join('\n')}` : '';
  const message = ['Checking expired #domains', expiringMessage, errorsMessage]
    .filter((s) => !!s)
    .join('\n\n');
  const rs = await axios.get(
    options.alarmer_url +
      '?' +
      new URLSearchParams({ key: options.alarmer_api_key ?? '', message }).toString()
  );
  return `${rs.status}: ${rs.statusText}`;
}

async function task() {
  logger.info('=== Check domain expiration: task start ===');

  try {
    options.check();
    const strigifyDomain = ({ name, daysLeft }: RenewableDomain) => ({ name, daysLeft });
    const { setCookie } = await login(options.freenom_login ?? '', options.freenom_password ?? '');
    logger.debug('Got login cookie', setCookie);
    const { domains, errors } = await renewable(options.freenom_renewals_url, setCookie);
    logger.debug('Got renewable domains', (domains ?? []).map(strigifyDomain));
    if (errors?.length) {
      logger.error('Got renewable domains has errors', errors);
    }
    const domainsSoonExpire = (domains ?? []).filter((d) => d.daysLeft <= d.minRenewalDays);
    if (domainsSoonExpire.length) {
      logger.info('Domains are expiring soon', domainsSoonExpire.map(strigifyDomain));
    }
    if (domainsSoonExpire.length || errors?.length) {
      try {
        logger.debug(`Alarmer response: "${await notify(domainsSoonExpire, errors)}"`);
      } catch (e) {
        logger.error('Alarmer request failed:', e);
      }
    }
    logger.info('=== Check domain expiration: task end ===');
  } catch (e) {
    logger.fatal('=== Check domain expiration failed:', e, '===');
  }
}

task();
