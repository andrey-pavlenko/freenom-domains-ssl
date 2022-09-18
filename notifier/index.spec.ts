import { createEmailTransport, email, emailTransport, alarmer } from './index';
import https from 'https';

describe('notifier/index.ts', () => {
  describe('email', () => {
    it.skip('send real email', async () => {
      createEmailTransport({
        host: process.env.SMTP_HOST,
        port: +(process.env.SMTP_PORT ?? 'NaN'),
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      });
      await email({
        from: process.env.SMTP_USER ?? '',
        to: process.env.SMTP_USER ?? '',
        subject: 'Test email subject',
        text: 'Test email text'
      });
    });

    it('createEmailTransport error', () => {
      try {
        createEmailTransport({});
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe(
          '"options.host" is empty, "options.port" is empty, "options.user" is empty, "options.pass" is empty'
        );
      }
      expect(emailTransport).toBeNull();
      try {
        createEmailTransport({ host: 'smtp.test.com' });
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe(
          '"options.port" is empty, "options.user" is empty, "options.pass" is empty'
        );
      }
      expect(emailTransport).toBeNull();
      try {
        createEmailTransport({ host: 'smtp.test.com', port: 465 });
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('"options.user" is empty, "options.pass" is empty');
      }
      expect(emailTransport).toBeNull();
      try {
        createEmailTransport({ host: 'smtp.test.com', port: 465, user: 'test' });
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('"options.pass" is empty');
      }
      createEmailTransport({ host: 'smtp.test.com', port: 465, user: 'test', pass: 'test' });
      expect(emailTransport).not.toBeNull();
    });

    it('send email', async () => {
      try {
        createEmailTransport({});
      } catch (e) {
        expect(emailTransport).toBeNull();
      }
      try {
        await email({ from: 'test', to: 'test', subject: 'test', text: 'test' });
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('emailTransport not initialized');
      }
      createEmailTransport({ host: 'smtp.test.com', port: 465, user: 'test', pass: 'test' });
      if (emailTransport == null) {
        expect('').toBe('emailTransport must be not null');
        return;
      }

      let sendMailMock = jest.fn((opts, cb) => {
        cb(null);
      });
      emailTransport.sendMail = sendMailMock as unknown as typeof emailTransport.sendMail;
      const opts = { from: 'test', to: 'test', subject: 'test', text: 'test' };
      await email(opts);
      expect(emailTransport.sendMail).toHaveBeenCalledTimes(1);
      expect(sendMailMock.mock.calls[0][0]).toEqual(opts);

      sendMailMock = jest.fn((opts, cb) => {
        cb(new Error('Test'));
      });
      emailTransport.sendMail = sendMailMock as unknown as typeof emailTransport.sendMail;
      try {
        await email(opts);
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe('Test');
      }

      try {
        createEmailTransport({});
      } catch (e) {
        expect(emailTransport).toBeNull();
      }
    });
  });

  describe('alarmer', () => {
    it.skip('send real alarm', async () => {
      if (!process.env.ALARMER_API_KEY) {
        expect('').toBe('process.env.ALARMER_API_KEY must has value');
        return;
      }
      await alarmer(process.env.ALARMER_API_KEY, 'Testing');
    });

    it('error, no key', async () => {
      try {
        await alarmer('', 'Testing');
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toBe(
          '"key" must contain the Alarmer API key and cannot be empty'
        );
      }
    });

    it('send with mock request', async () => {
      const _request = https.request;
      let requestMock = jest.fn((_, cb) =>
        cb({
          on: () => void 0,
          statusCode: 200
        })
      );
      https.request = requestMock;

      await alarmer('test', 'Testing');
      expect(requestMock.mock.calls[0][0]).toBe('https://alarmerbot.ru?key=test&message=Testing');

      requestMock = jest.fn((_, cb) =>
        cb({
          on: () => void 0,
          statusCode: 400
        })
      );
      https.request = requestMock;
      try {
        await alarmer('test', 'Testing');
        expect('').toBe('Must throw error');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/statusCode "400"/);
      }

      https.request = _request;
    });
  });
});
