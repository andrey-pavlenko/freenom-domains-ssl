import { request } from 'https';
import { TLSSocket } from 'tls';
import { logLevels, Level, configure, logger } from '@freenom/logger';
import { email, createEmailTransport, alarmer } from '@freenom/notifier';

async function main() {
  await (async () => {
    const logLevel: Level = ((v) => {
      if (logLevels.includes(v as Level)) {
        return v as Level;
      } else {
        return logLevels[0];
      }
    })(process.env.LOGLEVEL ?? 'debug');
    await configure(logLevel);
  })();

  try {
    await check(getOptions());
  } catch (e) {
    logger.fatal(e);
  }
}

function getOptions() {
  const missing: string[] = [];

  const hosts = (process.env.HOSTS ?? '').split(/\s*,\s*/).filter((s) => !!s);
  if (hosts.length === 0) {
    missing.push('HOSTS');
  }

  for (const key of [
    'NOTIFY_ALARMER_API_KEY',
    'NOTIFY_SMTP_HOST',
    'NOTIFY_SMTP_USER',
    'NOTIFY_SMTP_PASS'
  ]) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  const notifyDaysLeft = +(process.env.NOTIFY_DAYS_LEFT ?? 'NaN');
  if (!(notifyDaysLeft > 0)) {
    missing.push('NOTIFY_DAYS_LEFT');
  }

  const notifySmtpPort = +(process.env.NOTIFY_SMTP_PORT ?? 'NaN');
  if (!(notifySmtpPort > 0)) {
    missing.push('NOTIFY_SMTP_PORT');
  }

  if (missing.length) {
    throw new Error(
      'The following environment variables are missing from the .env file: ' +
        missing.map((s) => `"${s}"`).join(', ')
    );
  }

  return {
    hosts,
    notifyDaysLeft,
    notifyAlarmerApiKey: process.env.NOTIFY_ALARMER_API_KEY as string,
    notifySmtpHost: process.env.NOTIFY_SMTP_HOST as string,
    notifySmtpPort,
    notifySmtpUser: process.env.NOTIFY_SMTP_USER as string,
    notifySmtpPass: process.env.NOTIFY_SMTP_PASS as string
  };
}

export interface CertificateInfo {
  host: string;
  issuer: string;
  valid_from: Date;
  valid_to: Date;
  subject: string;
  subjectaltname: string;
}

export async function getCertificate(host: string, port?: number): Promise<CertificateInfo> {
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
      } else {
        reject(new Error('socket is not TLSSocket instance'));
      }
    });
    rq.on('error', reject);
    rq.end();
  });
}

async function check(options: ReturnType<typeof getOptions>) {
  type AddressSuccess = { address: string; certificate: CertificateInfo; daysLeft?: number };
  type AddressError = { address: string; error: string };
  type AddressResult = AddressSuccess | AddressError;

  logger.info('=== Check SSL certificates expiration: task start ===');

  const certificates: AddressResult[] = await Promise.all(
    options.hosts.map((h) => {
      const [host, port] = ((address) => {
        const s = address.split(':');
        if (s[1]) {
          const port = +(s[1] ?? 'NaN');
          return [s[0], isFinite(port) && port > 0 ? port : undefined];
        } else {
          return [s[0]];
        }
      })(h);
      return new Promise<AddressResult>((resolve) => {
        getCertificate(host, port)
          .then((c) => resolve({ address: h, certificate: c }))
          .catch((e) => resolve({ address: h, error: (e as Error).message }));
      });
    })
  );

  const errors: AddressError[] = [];
  let expiring: AddressSuccess[] = [];
  let valid: AddressSuccess[] = [];
  const now = Date.now();

  for (const c of certificates) {
    if ('error' in c) {
      errors.push(c);
    } else {
      c.daysLeft = Math.ceil((c.certificate.valid_to.getTime() - now) / (1000 * 60 * 60 * 24));
      if (c.daysLeft <= options.notifyDaysLeft) {
        expiring.push(c);
      } else {
        valid.push(c);
      }
    }
  }

  expiring = expiring.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  valid = valid.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));

  if (errors.length) {
    logger.error(
      'SSL request errors:',
      errors.map((e) => `${e.address}: ${e.error}`)
    );
  }

  if (expiring.length) {
    logger.warn(
      'Certificates are expiring soon:',
      expiring.map(
        (a) =>
          `${a.address} expires within ${a.daysLeft} days. Issuer: ${
            a.certificate.issuer
          }, hosts: ${a.certificate.subjectaltname || a.certificate.host}`
      )
    );
  }

  if (valid.length) {
    logger.info(
      'Valid certificates:',
      valid.map((a) => `${a.address} is valid for ${a.daysLeft} days`)
    );
  }

  if (expiring.length) {
    let message = '';
    if (errors.length) {
      message += `SSL #certificates errors:\n\n${errors
        .map((a) => `${a.address}: ${a.error}`)
        .join('\n')}\n\n\n`;
    }
    message += `SSL #certificates are expiring soon:\n\n${expiring
      .map(
        (a) =>
          `${a.address} expires within ${a.daysLeft} days. , hosts: ${
            a.certificate.subjectaltname || a.certificate.host
          }`
      )
      .join('\n')}`;

    try {
      createEmailTransport({
        host: options.notifySmtpHost,
        port: options.notifySmtpPort,
        user: options.notifySmtpUser,
        pass: options.notifySmtpPass
      });
      await email({
        from: options.notifySmtpUser,
        to: options.notifySmtpUser,
        subject: 'SSL certificates expiration report',
        text: message
      });
      logger.trace('Email notification sent successfully');
    } catch (e) {
      logger.error('Failed to send email notification', e);
    }
    try {
      await alarmer(options.notifyAlarmerApiKey, message);
      logger.trace('Alarmer notification sent successfully');
    } catch (e) {
      logger.error('Failed to send Alarmer notification', e);
    }
  }
  logger.info('=== Check SSL certificates expiration: task end ===');
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
