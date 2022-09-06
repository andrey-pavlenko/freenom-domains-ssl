declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOGLEVEL?: string;
      HOSTS?: string;
      NOTIFY_DAYS_LEFT?: string;
      ALARMER_API_KEY?: string;
    }
  }
}

export {};
