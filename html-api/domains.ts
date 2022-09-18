import { parse as parseContentType } from 'content-type';
import { JSDOM } from 'jsdom';
import { request } from './request';
import type { OutgoingHttpHeaders } from 'http';

export interface DomainInfo {
  id: number;
  name: string;
  status: string;
  daysLeft: number;
  renewUrl: string;
}

export interface DomainError {
  error: string;
}

export type RenewableDomain = DomainInfo | DomainError;

export async function renewable(
  address: string,
  headers?: OutgoingHttpHeaders
): Promise<RenewableDomain[]> {
  const url = new URL(address);

  function parseDomainRow(tr: HTMLTableRowElement, i: number): RenewableDomain {
    const name = tr.cells.item(0)?.textContent?.trim();
    const status = tr.cells.item(1)?.textContent?.trim();
    const daysLeft = ((text) => {
      if (text) {
        const match = text.match(/(\d+)\s*days?/i)?.at(1);
        if (match != null) {
          return +match;
        }
      }
    })(tr.cells.item(2)?.textContent);
    const [id, renewUrl] = ((href) => {
      if (href != null) {
        const rUrl = new URL(href, url.origin);
        const id = rUrl.searchParams.get('domain');
        if (id) {
          return [+id, rUrl.toString()];
        }
      }
      return [undefined, undefined];
    })(tr.cells.item(4)?.querySelector('a')?.href?.trim());

    const error = [
      !name ? `"name" property not detected in cell 0, row ${i}` : '',
      status == null
        ? '"status" property not detected in cell 2' +
          (name ? ` (domain, "${name}")` : '') +
          `, row ${i}`
        : '',
      daysLeft == null
        ? '"daysLeft" property not detected in cell 3' +
          (name ? ` (domain, "${name}")` : '') +
          `, row ${i}`
        : '',
      id == null
        ? '"id" property not detected in cell 4' +
          (name ? ` (domain, "${name}")` : '') +
          `, row ${i}`
        : ''
    ]
      .filter((s) => !!s)
      .join(', ');

    if (error) {
      return { error };
    }
    return {
      id: id as number,
      name: name as string,
      status: status as string,
      daysLeft: daysLeft as number,
      renewUrl: renewUrl as string
    };
  }

  const response = await request({
    hostname: url.hostname,
    port: url.port,
    method: 'GET',
    path: url.pathname + url.search,
    headers: {
      ...headers,
      accept: 'text/html,application/xhtml+xml',
      'cache-control': 'no-cache',
      pragma: 'no-cache'
    }
  });
  if (!(response.statusCode === 200 || response.statusCode === 304)) {
    throw new Error(`renewable request "${address} failed, statusCode is "${response.statusCode}"`);
  }
  if (parseContentType(response).type !== 'text/html') {
    throw new Error(
      `renewable request received a success status code "${
        response.statusCode
      }" from "${url.toString()}", but unsupported content-type. Headers ${JSON.stringify(
        response.headers
      )}`
    );
  }

  const { window } = new JSDOM(await response.body);
  const table = window.document.evaluate(
    `//th[contains(text(),'Days Until Expiry')]/ancestor::table`,
    window.document,
    null,
    window.XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
  if (!(table instanceof window.HTMLTableElement)) {
    throw new Error('renewable failed: table of domains not found');
  }

  return Array.from(table.querySelectorAll('tbody'))
    .map((b) => Array.from(b.querySelectorAll('tr')))
    .flat()
    .map(parseDomainRow);
}
