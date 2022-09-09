import axios from 'axios';
import { JSDOM } from 'jsdom';
import { USER_AGENT } from './options';

export async function getContent(url: string, setCookie: string[]): Promise<string> {
  const cookie = setCookie
    .map((c) => c.split(';')[0])
    .filter((s) => !!s)
    .map((s) => s.trim())
    .join(';');

  const response = await axios.get(url, {
    maxRedirects: 0,
    headers: {
      cookie,
      'user-agent': USER_AGENT
    }
  });

  return response.data;
}

export interface RenewableDomain {
  id: number;
  name: string;
  isActive: boolean;
  daysLeft: number;
  minRenewalDays: number;
  renewUrl: string;
}

export async function renewable(
  url: string,
  setCookie: string[]
): Promise<{ domains?: RenewableDomain[]; errors?: string[] }> {
  const dom = new JSDOM(await getContent(url, setCookie));
  const table = dom.window.document.evaluate(
    `//h1[contains(text(),'Domain Renewals')]/parent::section/following-sibling::section//table`,
    dom.window.document,
    null,
    dom.window.XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
  if (table instanceof dom.window.HTMLTableElement) {
    const { origin } = new URL(url);
    const tableRows = Array.from(table.querySelectorAll('tbody'))
      .map((tbody) => Array.from(tbody.querySelectorAll('tr')))
      .flat();
    const domains: RenewableDomain[] = [];
    const errors: string[] = [];
    for (const [index, tr] of tableRows.entries()) {
      if (tr.cells.length < 5) {
        errors.push(
          `row #${index} has ${
            tr.cells.length
          } cells, expected 5. Row content: ${tr.innerHTML.trim()}`
        );
      } else {
        const rowErrors: string[] = [];
        const name = tr.cells.item(0)?.textContent?.trim() ?? '';
        if (!name) {
          rowErrors.push(`"name" property not detected in cell: "${tr.cells.item(0)?.innerHTML}"`);
        }
        const isActiveText = tr.cells.item(1)?.textContent?.trim();
        const isActive = isActiveText
          ? isActiveText.toLowerCase() === 'active'
          : (() => {
              rowErrors.push(
                `"isActive" property not detected in cell: "${tr.cells.item(1)?.innerHTML.trim()}"`
              );
              return false;
            })();
        const daysLeft = +(
          tr.cells
            .item(2)
            ?.textContent?.match(/(\d+)\s*days?/i)
            ?.at(1) ?? 'NaN'
        );
        const minRenewalDays = +(
          tr.cells
            .item(3)
            ?.textContent?.match(/(\d+)\s*days?/i)
            ?.at(1) ?? 'NaN'
        );
        const aHref = tr.cells.item(4)?.querySelector('a')?.href.trim() ?? undefined;
        const [id, renewUrl] = aHref
          ? (() => {
              const url = new URL(aHref, origin);
              return [+(url.searchParams.get('domain') ?? 'NaN'), url.toString()];
            })()
          : (() => {
              rowErrors.push(
                `"id" and "renewUrl" properties not detected in cell: "${tr.cells
                  .item(4)
                  ?.innerHTML.trim()}"`
              );
              return [NaN, ''];
            })();
        if (rowErrors.length) {
          errors.push(`row #${index} has errors: ${rowErrors.join('; ')}`);
        } else {
          domains.push({
            id,
            name,
            isActive,
            daysLeft,
            minRenewalDays,
            renewUrl
          });
        }
      }
    }

    const result: { domains?: RenewableDomain[]; errors?: string[] } = {};

    if (domains.length) {
      result.domains = domains;
    }

    if (errors.length) {
      result.errors = errors;
    }

    return result;
  }
  throw new Error('table of domains not found');
}
