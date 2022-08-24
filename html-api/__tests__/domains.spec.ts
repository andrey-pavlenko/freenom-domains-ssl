import axios from 'axios';
import { renewable } from '../domains';

describe('domains.ts', () => {
  describe('renewable', () => {
    let axios_get: typeof axios.get;
    beforeAll(() => (axios_get = axios.get));
    afterAll(() => (axios.get = axios_get));

    it('empty page, should throw error', async () => {
      axios.get = jest.fn(async () => Promise.resolve({})) as typeof axios.get;
      try {
        await renewable('https://my.freenom.com/domains.php?a=renewals', [
          'test=test',
          'test1=test1'
        ]);
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/table.*not found/i);
      }
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('no table, should throw error', async () => {
      axios.get = jest.fn(async () =>
        Promise.resolve({
          data: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <section class="pageHeader">
    <h1 class="primaryFontColor">Domain Renewals</h1>
  </section>
  <section class="renewalContent">
  </section>
</body>
</html>`
        })
      ) as typeof axios.get;
      try {
        await renewable('https://my.freenom.com/domains.php?a=renewals', [
          'test=test',
          'test1=test1'
        ]);
        expect('Should throw error').toBe('');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message).toMatch(/table.*not found/i);
      }
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('table with incorrect rows', async () => {
      axios.get = jest.fn(async () =>
        Promise.resolve({
          data: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <section class="pageHeader">
    <h1 class="primaryFontColor">Domain Renewals</h1>
  </section>
  <section class="renewalContent">
    <div class="row centered margin padding">
      <div class="container">
        <div class="col-md-12">
          <p>Secure your domain(s) by adding more years to them. Choose how many years you want to renew for and then
            submit to continue.</p><br>
          <form method="post" action="domains.php?submitrenewals=true">
            <input type="hidden" name="token" value="test">
            <table class="table table-striped table-bordered" cellspacing="1" align="center">
              <thead>
                <tr><th>Domain</th><th>Status</th><th>Days Until Expiry</th><th></th><th></th></tr>
              </thead>
              <tbody>
                <tr><td>Active</td><td><span class="textred">25 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=111">Renew This Domain</a></td>
                </tr>
                <tr><td>test1.tk</td><td>unknown</td><td><span class="textgreen">unknown</span></td><td><span class="textred">unknown</span></td><td>Renew This Domain</td>
                </tr>
                <tr><td>test2.ml</td><td>Active</td><td><span class="textgreen">40 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight">Renew This Domain</a></td>
                </tr>
                <tr><td>agato.tk</td><td>Active</td><td><span class="textgreen">164 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=114">Renew This Domain</a></td>
                </tr>
                <tr><td>foxy.tk</td><td>Active</td><td><span class="textgreen">171 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span> </td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=115">Renew This Domain</a></td>
                </tr>
                <tr><td>qui-quo.tk</td><td>Active</td><td><span class="textgreen">312 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=116">Renew This Domain</a></td>
                </tr>
              </tbody>
            </table>
          </form>
          <br>
        </div>
      </div>
    </div>
  </section>
</body>
</html>`
        })
      ) as typeof axios.get;
      const { domains, errors } = await renewable('https://my.freenom.com/domains.php?a=renewals', [
        'test=test',
        'test1=test1'
      ]);
      expect(domains).toStrictEqual([
        {
          id: 114,
          name: 'agato.tk',
          isActive: true,
          daysLeft: 164,
          minRenewalDays: 14,
          renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=114'
        },
        {
          id: 115,
          name: 'foxy.tk',
          isActive: true,
          daysLeft: 171,
          minRenewalDays: 14,
          renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=115'
        },
        {
          id: 116,
          name: 'qui-quo.tk',
          isActive: true,
          daysLeft: 312,
          minRenewalDays: 14,
          renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=116'
        }
      ]);
      expect(errors?.map((s) => s.match(/(row #\d+)/i)?.at(1))).toEqual([
        'row #0',
        'row #1',
        'row #2'
      ]);
      expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it('success', async () => {
      axios.get = jest.fn(async () =>
        Promise.resolve({
          data: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
</head>
<body>
  <section class="pageHeader">
    <h1 class="primaryFontColor">Domain Renewals</h1>
  </section>
  <section class="renewalContent">
    <div class="row centered margin padding">
      <div class="container">
        <div class="col-md-12">
          <p>Secure your domain(s) by adding more years to them. Choose how many years you want to renew for and then
            submit to continue.</p><br>
          <form method="post" action="domains.php?submitrenewals=true">
            <input type="hidden" name="token" value="test">
            <table class="table table-striped table-bordered" cellspacing="1" align="center">
              <thead>
                <tr><th>Domain</th><th>Status</th><th>Days Until Expiry</th><th></th><th></th></tr>
              </thead>
              <tbody>
                <tr><td>lead.gq</td><td>Active</td><td><span class="textred">25 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=111">Renew This Domain</a></td>
                </tr>
                <tr><td>liorro.tk</td><td>Active</td><td><span class="textgreen">39 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=112">Renew This Domain</a></td>
                </tr>
                <tr><td>notezz.ml</td><td>Active</td><td><span class="textgreen">40 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=113">Renew This Domain</a></td>
                </tr>
                <tr><td>agato.tk</td><td>Active</td><td><span class="textgreen">164 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=114">Renew This Domain</a></td>
                </tr>
                <tr><td>foxy.tk</td><td>Active</td><td><span class="textgreen">171 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span> </td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=115">Renew This Domain</a></td>
                </tr>
                <tr><td>qui-quo.tk</td><td>Active</td><td><span class="textgreen">312 Days</span></td><td><span class="textred">Minimum Advance Renewal is 14 Days for Free Domains</span></td><td><a class="smallBtn greyBtn pullRight" href="domains.php?a=renewdomain&amp;domain=116">Renew This Domain</a></td>
                </tr>
              </tbody>
            </table>
          </form>
          <br>
        </div>
      </div>
    </div>
  </section>
</body>
</html>`
        })
      ) as typeof axios.get;
      const domains = await renewable('https://my.freenom.com/domains.php?a=renewals', [
        'test=test',
        'test1=test1'
      ]);
      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(domains).toStrictEqual({
        domains: [
          {
            id: 111,
            name: 'lead.gq',
            isActive: true,
            daysLeft: 25,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=111'
          },
          {
            id: 112,
            name: 'liorro.tk',
            isActive: true,
            daysLeft: 39,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=112'
          },
          {
            id: 113,
            name: 'notezz.ml',
            isActive: true,
            daysLeft: 40,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=113'
          },
          {
            id: 114,
            name: 'agato.tk',
            isActive: true,
            daysLeft: 164,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=114'
          },
          {
            id: 115,
            name: 'foxy.tk',
            isActive: true,
            daysLeft: 171,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=115'
          },
          {
            id: 116,
            name: 'qui-quo.tk',
            isActive: true,
            daysLeft: 312,
            minRenewalDays: 14,
            renewUrl: 'https://my.freenom.com/domains.php?a=renewdomain&domain=116'
          }
        ]
      });
    });
  });
});
