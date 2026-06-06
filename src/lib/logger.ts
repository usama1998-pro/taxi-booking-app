const PREFIX = '[BarcelonaTaxi24]';

export const logger = {
  debug: (...args: unknown[]) => {
    if (__DEV__) {
      console.log(PREFIX, ...args);
    }
  },
  info: (...args: unknown[]) => {
    if (__DEV__) {
      console.info(PREFIX, ...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(PREFIX, ...args);
  },
  error: (...args: unknown[]) => {
    console.error(PREFIX, ...args);
  },
};
