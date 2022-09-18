import log4js from 'log4js';
import type { ConfigureFn, Logger } from './types';

export let logger: Logger = log4js.getLogger();

export const configure: ConfigureFn = (level) => {
  log4js.configure({
    appenders: {
      out: {
        type: 'stdout',
        layout: { type: 'pattern', pattern: '%d{yyyy-MM-dd hh:mm:ss,SSS} [%-5p] -- %m' }
      }
    },
    categories: {
      default: { appenders: ['out'], level }
    }
  });
  logger = log4js.getLogger();
  return Promise.resolve();
};
