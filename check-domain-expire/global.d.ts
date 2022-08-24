declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOGLEVEL?: string;
      FREENOM_LOGIN?: string;
      FREENOM_PASSWORD?: string;
      SMTP_HOST?: string;
      SMTP_PORT?: string;
      SMTP_USER?: string;
      SMTP_PASS?: string;
      NOTIFY_MAIL_FROM?: string;
      NOTIFY_MAIL_TO?: string;
    }
  }
}

export {};
