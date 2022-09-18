import FakeServer from '@freenom/fake-server';
import { parse as parseCookie } from 'cookie';
import { renewable } from '../index';

describe('domains.ts', () => {
  describe('renewable', () => {
    interface DomainRowParams {
      domain: string;
      status: string;
      days?: number;
      id?: number;
    }

    const domainRow = ({ domain, status, days, id }: DomainRowParams) =>
      `<tr><td>${domain}</td><td>${status}</td><td><span class="text${
        days && days <= 14 ? 'green' : 'red'
      }">${days} Days</span></td><td><span class="text${days && days <= 14 ? 'green' : 'red'}">${
        days && days <= 14 ? 'Renewable' : 'Minimum Advance Renewal is 14 Days for Free Domains'
      }</span></td><td><a class="smallBtn greyBtn pullRight" ${
        id ? `href="domains.php?a=renewdomain&domain=${id}` : ''
      }">Renew This Domain</a></td></tr>`;

    let tableHeader =
      '<tr><th>Domain</th><th>Status</th><th>Days Until Expiry</th><th></th><th></th></tr>';

    let domainforRows: DomainRowParams[] = [
      {
        domain: 'test1.tk',
        status: 'Active',
        days: 14,
        id: 111
      },
      {
        domain: 'test2.tk',
        status: 'Active',
        days: 28,
        id: 112
      }
    ];

    const server = new FakeServer((req, res) => {
      if (
        !req.headers['user-agent']?.match(/^mozilla\/\d/i) ||
        req.method !== 'GET' ||
        !req.url ||
        !req.headers.cookie
      ) {
        res.statusCode = 400;
        res.end();
        return;
      }

      if (req.url !== '/domains?a=renewals') {
        res.setHeader('content-type', 'text/plain; charset=utf-8');
        res.write('Unknown page');
        res.end();
        return;
      }

      const cookies = parseCookie(req.headers.cookie);
      if (cookies['WHMCSZ'] !== 'session' || cookies['WHMCSUser'] !== 'test') {
        res.statusCode = 302;
        res.setHeader('location', server.address);
        res.end();
        return;
      }

      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <table>
    <thead>${tableHeader}</thead>
    <tbody>${domainforRows.map(domainRow).join('\n')}</tbody>
  </table>
</body>
</html>`);
      res.end();
    });

    beforeAll(async () => {
      await server.start();
    });

    afterAll(async () => {
      await server.stop();
    });

    it('renewable: success', async () => {
      const domains = await renewable(server.address + '/domains?a=renewals', {
        'user-agent': 'Mozilla/5.0',
        cookie: 'WHMCSZ=session; WHMCSUser=test; WHMCSItemsPerPage=-1'
      });
      expect(domains).toEqual([
        {
          id: 111,
          name: 'test1.tk',
          status: 'Active',
          daysLeft: 14,
          renewUrl: `${server.address}/domains.php?a=renewdomain&domain=111`
        },
        {
          id: 112,
          name: 'test2.tk',
          status: 'Active',
          daysLeft: 28,
          renewUrl: `${server.address}/domains.php?a=renewdomain&domain=112`
        }
      ]);
    });

    it('renewable: cells has errors', async () => {
      const _domainforRows = domainforRows;
      domainforRows = [
        {
          domain: '',
          status: 'Active',
          days: 14,
          id: 111
        },
        {
          domain: 'test2.tk',
          status: 'Active',
          id: 112
        },
        {
          domain: 'test3.tk',
          status: '',
          days: 22,
          id: 113
        }
      ];
      const domains = await renewable(server.address + '/domains?a=renewals', {
        'user-agent': 'Mozilla/5.0',
        cookie: 'WHMCSZ=session; WHMCSUser=test; WHMCSItemsPerPage=-1'
      });
      expect(domains).toEqual([
        { error: '"name" property not detected in cell 0, row 0' },
        { error: '"daysLeft" property not detected in cell 3 (domain, "test2.tk"), row 1' },
        {
          id: 113,
          name: 'test3.tk',
          status: '',
          daysLeft: 22,
          renewUrl: `${server.address}/domains.php?a=renewdomain&domain=113`
        }
      ]);
      domainforRows = _domainforRows;
    });

    it('renewable: wrong table header', async () => {
      const _tableHeader = tableHeader;
      tableHeader =
        '<tr><th>Domain</th><th>Status</th><th>Days To Expiry</th><th></th><th></th></tr>';
      try {
        await renewable(server.address + '/domains?a=renewals', {
          'user-agent': 'Mozilla/5.0',
          cookie: 'WHMCSZ=session; WHMCSUser=test; WHMCSItemsPerPage=-1'
        });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/table of domains not found/i);
      }
      tableHeader = _tableHeader;
    });

    it('renewable: request fail', async () => {
      try {
        await renewable(server.address + '/domains?a=renewals', {
          'user-agent': 'Chrome/5.0',
          cookie: 'WHMCSZ=session; WHMCSUser=test; WHMCSItemsPerPage=-1'
        });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/request [^\s]+ failed/i);
      }
    });

    it('renewable: request fail, redirect', async () => {
      try {
        await renewable(server.address + '/domains?a=renewals', {
          'user-agent': 'Mozilla/5.0',
          cookie: 'WHMCSItemsPerPage=-1'
        });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/request [^\s]+ failed/i);
      }
    });

    it('renewable: not html response', async () => {
      try {
        await renewable(server.address + '/some-page', {
          'user-agent': 'Mozilla/5.0',
          cookie: 'WHMCSZ=session; WHMCSUser=test; WHMCSItemsPerPage=-1'
        });
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/unsupported content-type/i);
      }
    });
  });
});
