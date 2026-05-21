/**
 * Extends `app.json`. Expo loads `.env` so `process.env.BASE_API_URL` is available when this runs.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    BASE_API_URL: (process.env.BASE_API_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    BOOKING_TIME_ZONE: process.env.BOOKING_TIME_ZONE ?? 'Europe/Madrid',
  },
});
