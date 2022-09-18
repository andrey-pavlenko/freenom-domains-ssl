jest.mock('@freenom/logger', () => _logger);
const _logger = {
  logLevels: ['all', 'trace', 'debug', 'info', 'warn', 'error', 'fatal'],
  configure: jest.fn(),
  logger: {
    all: jest.fn(),
    trace: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  }
};

jest.mock('@freenom/html-api', () => _htmlApi);
const _htmlApi = {
  login: jest.fn(),
  renewable: jest.fn()
};

jest.mock('@freenom/notifier', () => _notifier);
const _notifier = {
  email: jest.fn(),
  createEmailTransport: jest.fn(),
  alarmer: jest.fn()
};

import { main } from './index';

describe('check-domain-expire', () => {
  it('options fail', async () => {
    const _v = process.env.FREENOM_LOGIN_URL;
    delete process.env.FREENOM_LOGIN_URL;
    await main();
    expect(_logger.logger.fatal.mock.lastCall[0].toString()).toMatch(
      /^Error:.*variables.*missing.*"FREENOM_LOGIN_URL"/
    );
    process.env.FREENOM_LOGIN_URL = _v;
  });

  it('login fail', async () => {
    _htmlApi.login.mockImplementation(async () => {
      throw new Error('Mock login failed');
    });
    await main();
    expect(_logger.logger.fatal.mock.lastCall[0].toString()).toBe('Error: Mock login failed');
  });

  it('renewable fail', async () => {
    _htmlApi.login.mockImplementation(async () => ({
      address: '/clientarea.php',
      cookies: 'WHMCSZ=12345;WHMCSUser=12345'
    }));
    _htmlApi.renewable.mockImplementation(async () => {
      throw new Error('Mock renewable failed');
    });
    await main();
    expect(_logger.logger.fatal.mock.lastCall[0].toString()).toBe('Error: Mock renewable failed');
  });

  it('notifier fail', async () => {
    _htmlApi.login.mockImplementation(async () => ({
      address: '/clientarea.php',
      cookies: 'WHMCSZ=12345;WHMCSUser=12345'
    }));
    _htmlApi.renewable.mockImplementation(async () => [
      {
        id: 1,
        name: 'test.gq',
        status: 'Active',
        daysLeft: 29,
        renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain'
      },
      {
        id: 2,
        name: 'test.tk',
        status: 'Active',
        daysLeft: 138,
        renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain'
      },
      {
        id: 3,
        name: 'test1.tk',
        status: 'Active',
        daysLeft: 14,
        renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain'
      },
      {
        id: 4,
        name: 'test2.tk',
        status: 'Active',
        daysLeft: 286,
        renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain'
      },
      {
        error: 'Something went wrong'
      },
      {
        id: 5,
        name: 'test.ml',
        status: 'Active',
        daysLeft: 3,
        renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain'
      }
    ]);
    _logger.logger.fatal.mockClear();
    _notifier.email.mockImplementation(async () => {
      throw new Error('Mock email fail');
    });
    _notifier.alarmer.mockImplementation(async () => {
      throw new Error('Mock alarmer fail');
    });
    _logger.logger.error.mockClear();
    await main();
    expect(_logger.logger.error.mock.calls[0]).toEqual([
      'Domain errors:',
      [{ error: 'Something went wrong' }]
    ]);
    expect(_logger.logger.error.mock.calls[1][0]).toBe('Failed to send email notification');
    expect(_logger.logger.error.mock.calls[2][0]).toBe('Failed to send Alarmer notification');
    expect(_logger.logger.warn.mock.lastCall).toEqual([
      'Domains are expiring soon:',
      ['test.ml expires within 3 days', 'test1.tk expires within 14 days']
    ]);
    expect(_logger.logger.info.mock.lastCall).toEqual([
      'Domain expiration days:',
      [
        'test.gq is valid for 29 days',
        'test.tk is valid for 138 days',
        'test2.tk is valid for 286 days'
      ]
    ]);
    // console.info(_logger.logger.info.mock.lastCall);
    // expect(_logger.logger.fatal.mock.lastCall[0].toString()).toBe('Error: Mock renewable failed');
  });

  it('notifier fail', async () => {
    _notifier.email.mockImplementation(async () => void 0);
    _notifier.alarmer.mockImplementation(async () => void 0);
    await main();
    const message = `#Domain errors:\n\nSomething went wrong\n\n\n#Domains are expiring soon:\n\ntest.ml expires within 3 days\ntest1.tk expires within 14 days`;
    expect(_notifier.email.mock.lastCall[0].text).toBe(message);
    expect(_notifier.alarmer.mock.lastCall[1]).toBe(message);
  });
});
