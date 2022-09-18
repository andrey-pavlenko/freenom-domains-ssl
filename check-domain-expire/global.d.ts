declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOGLEVEL?: string;
      USER_AGENT?: string;
      FREENOM_LOGIN_URL?: string;
      FREENOM_LOGIN?: string;
      FREENOM_PASSWORD?: string;
      MIN_RENEWAL_DAYS?: string;
      NOTIFY_ALARMER_API_KEY?: string;
      NOTIFY_SMTP_HOST?: string;
      NOTIFY_SMTP_PORT?: string;
      NOTIFY_SMTP_USER?: string;
      NOTIFY_SMTP_PASS?: string;
    }
  }
}

export {};
