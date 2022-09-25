declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOGLEVEL?: string;
      HOSTS?: string;
      NOTIFY_DAYS_LEFT?: string;
      NOTIFY_ALARMER_API_KEY?: string;
      NOTIFY_SMTP_HOST?: string;
      NOTIFY_SMTP_PORT?: string;
      NOTIFY_SMTP_USER?: string;
      NOTIFY_SMTP_PASS?: string;
    }
  }
}

export {};
