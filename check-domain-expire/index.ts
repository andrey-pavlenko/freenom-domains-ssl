import { logLevels, Level, configure, logger } from '@freenom/logger';
import { login, renewable, DomainInfo, DomainError } from '@freenom/html-api';
import { email, createEmailTransport, alarmer } from '@freenom/notifier';

export async function main() {
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
  const userAgent =
    process.env.USER_AGENT ??
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.5112.101 Safari/537.36';

  const missing: string[] = [];
  for (const key of [
    'FREENOM_LOGIN_URL',
    'FREENOM_LOGIN',
    'FREENOM_PASSWORD',
    'NOTIFY_ALARMER_API_KEY',
    'NOTIFY_SMTP_HOST',
    'NOTIFY_SMTP_USER',
    'NOTIFY_SMTP_PASS'
  ]) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  const minRenewalDays = +(process.env.MIN_RENEWAL_DAYS ?? '14');
  if (!(minRenewalDays > 0)) {
    missing.push('MIN_RENEWAL_DAYS');
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
    userAgent,
    freenomLoginUrl: process.env.FREENOM_LOGIN_URL as string,
    freenomLogin: process.env.FREENOM_LOGIN as string,
    freenomPassword: process.env.FREENOM_PASSWORD as string,
    minRenewalDays,
    notifyAlarmerApiKey: process.env.NOTIFY_ALARMER_API_KEY as string,
    notifySmtpHost: process.env.NOTIFY_SMTP_HOST as string,
    notifySmtpPort,
    notifySmtpUser: process.env.NOTIFY_SMTP_USER as string,
    notifySmtpPass: process.env.NOTIFY_SMTP_PASS as string
  };
}

async function check(options: ReturnType<typeof getOptions>) {
  logger.trace('=== Check domain expiration: task start ===');
  const loginRes = await login(
    options.freenomLoginUrl,
    options.freenomLogin,
    options.freenomPassword,
    {
      'user-agent': options.userAgent
    }
  );
  logger.trace('Got login result', loginRes);

  const renewableUrl = new URL(options.freenomLoginUrl);
  renewableUrl.pathname = '/domains.php';
  renewableUrl.search = '?a=renewals';
  logger.trace('Request renewable domains from', renewableUrl.toString());
  const domains = (
    await renewable(renewableUrl.toString(), {
      'user-agent': options.userAgent,
      cookie: loginRes.cookies + ';WHMCSItemsPerPage=-1',
      referrer: loginRes.address
    })
  ).sort((a, b) => {
    if ('error' in a || 'error' in b) {
      return NaN;
    }
    return a.daysLeft - b.daysLeft;
  });

  const expiration: DomainInfo[] = [];
  const success: DomainInfo[] = [];
  const errors: DomainError[] = [];
  for (const d of domains) {
    if ('error' in d) {
      errors.push(d);
    } else {
      if (d.daysLeft <= options.minRenewalDays) {
        expiration.push(d);
      } else {
        success.push(d);
      }
    }
  }

  if (errors.length) {
    logger.error('Domain errors:', errors);
  }

  if (expiration.length) {
    logger.warn(
      'Domains are expiring soon:',
      expiration.map((d) => `${d.name} expires within ${d.daysLeft} days`)
    );
  }

  if (success.length) {
    logger.info(
      'Domain expiration days:',
      success.map((d) => `${d.name} is valid for ${d.daysLeft} days`)
    );
  }

  if (expiration.length || errors.length) {
    let message = '';
    if (errors.length) {
      message += `#Domain errors:\n\n${errors.map((d) => d.error).join('\n')}`;
    }
    if (expiration.length) {
      if (message.length) {
        message += '\n\n\n';
      }
      message += `#Domains are expiring soon:\n\n${expiration
        .map((d) => `${d.name} expires within ${d.daysLeft} days`)
        .join('\n')}`;
    }
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
        subject: 'Domain expiration report',
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

  logger.trace('=== Check domain expiration: task end ===');
}

if (process.env.NODE_ENV !== 'test') {
  main();
}
