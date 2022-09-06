import { request } from 'https';
import { TLSSocket } from 'tls';
import log4js from 'log4js';
import axios from 'axios';

/*
https://github.com/rheh/ssl-date-checker/blob/master/src/Checker.js
https://nodejs.org/api/tls.html#tlssocketgetpeercertificatedetailed
*/

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

export interface CertificateInfo {
  host: string;
  issuer: string;
  valid_from: Date;
  valid_to: Date;
  subject: string;
  subjectaltname: string;
}

const options = {
  hosts: (process.env.HOSTS ?? '').split(/\s*,\s*/).filter((s) => !!s),
  notify_days_left: +(process.env.NOTIFY_DAYS_LEFT ?? '1'),
  alarmer_api_key: process.env.ALARMER_API_KEY,
  alarmer_url: 'https://alarmerbot.ru',
  check() {
    const errors: string[] = [];
    if (this.hosts.length === 0) {
      errors.push('process.env.HOSTS is empty, no hosts to check');
    }
    if (isNaN(this.notify_days_left) || this.notify_days_left <= 0) {
      errors.push(
        `invalid process.env.NOTIFY_DAYS_LEFT value "${process.env.NOTIFY_DAYS_LEFT}", should be a positive number`
      );
    }
    if (!this.alarmer_api_key) {
      errors.push('process.env.ALARMER_API_KEY is empty, unable to send notifications');
    }
    if (errors.length) {
      throw new Error(errors.join('; '));
    }
  }
};

async function getCertificate(host: string, port?: number): Promise<CertificateInfo> {
  // console.info('getCertificate', host, port);
  return new Promise((resolve, reject) => {
    const rq = request({ host, port, method: 'GET', rejectUnauthorized: false }, (res) => {
      if (res.socket instanceof TLSSocket) {
        const certificateInfo = (res.socket as TLSSocket).getPeerCertificate(true);
        const info: CertificateInfo = {
          host,
          issuer: certificateInfo.issuer.O,
          valid_from: new Date(certificateInfo.valid_from),
          valid_to: new Date(certificateInfo.valid_to),
          subject: certificateInfo.subject.CN ?? certificateInfo.subject.O,
          subjectaltname: certificateInfo.subjectaltname
        };
        resolve(info);
        // console.info(certificateInfo);
      } else {
        reject(new Error('socet is not TLSSocket instance'));
      }
    });

    rq.on('error', reject);

    rq.end();
    // console.info(rq);
  });
}

async function notify(
  aboutExpire: CertificateInfo[],
  errors?: Record<string, Error>[]
): Promise<string> {
  const expiringMessage = aboutExpire.length
    ? `The following certificates expire in ${options.notify_days_left} days:\n\n${aboutExpire
        .map(
          (c) =>
            `${c.issuer}: ${
              c.subjectaltname ?? c.subject
            }\nexpires ${c.valid_to.toLocaleDateString()}`
        )
        .join('\n\n')}`
    : '';
  const errorsMessage =
    errors && errors.length
      ? `Got hosts errors:\n\n${errors
          .map((e) => {
            const [host, error] = Object.entries(e)[0];
            return `${host}: ${error.message}`;
          })
          .join('\n')}`
      : '';
  const message = ['Checking the expiration date of #certificates', expiringMessage, errorsMessage]
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
  logger.info('=== Check SSL certifitates expiration: task start ===');
  try {
    options.check();
    const expiredEdgeDate = (() => {
      const edge = new Date();
      edge.setDate(edge.getDate() + options.notify_days_left);
      return edge;
    })();
    const errors: Record<string, Error>[] = [];
    const valid: CertificateInfo[] = [];
    const aboutExpire: CertificateInfo[] = [];
    const convertDatesToLocale = (info: CertificateInfo) => ({
      ...info,
      valid_from: info.valid_from.toLocaleString(),
      valid_to: info.valid_to.toLocaleString()
    });
    for (const host of options.hosts) {
      try {
        const info = await getCertificate(host);
        if (info.valid_to <= expiredEdgeDate) {
          aboutExpire.push(info);
        } else {
          valid.push(info);
        }
      } catch (e) {
        errors.push({ [host]: e as Error });
      }
    }
    if (errors.length) {
      logger.error('Got hosts errors:', errors);
    }
    if (aboutExpire.length) {
      logger.info('Certificate expiration notice', aboutExpire.map(convertDatesToLocale));
    } else {
      logger.info('No certificates expiring');
    }
    if (valid.length) {
      logger.debug('Valid certificates', valid.map(convertDatesToLocale));
    }
    if (aboutExpire.length || errors.length) {
      try {
        logger.debug(`Alarmer response: "${await notify(aboutExpire, errors)}"`);
      } catch (e) {
        logger.error('Alarmer request failed:', e);
      }
    }
  } catch (e) {
    logger.fatal('=== Check SSL certifitates expiration failed:', e, '===');
  }
  logger.info('=== Check SSL certifitates expiration: task end ===');
}

task();
