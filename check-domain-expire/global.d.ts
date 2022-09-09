declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOGLEVEL?: string;
      FREENOM_LOGIN?: string;
      FREENOM_PASSWORD?: string;
      ALARMER_API_KEY?: string;
      MIN_RENEWAL_DAYS?: string;
    }
  }
}

export {};
