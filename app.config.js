/**
 * Extends `app.json`. Expo loads `.env` so `EXPO_PUBLIC_*` vars are available when this runs.
 */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    BASE_API_URL: (
      process.env.EXPO_PUBLIC_BASE_API_URL ?? 'http://localhost:8000'
    ).replace(/\/$/, ''),
    BOOKING_TIME_ZONE:
      process.env.EXPO_PUBLIC_BOOKING_TIME_ZONE?.trim() ||
      process.env.TZ?.trim() ||
      'Europe/Madrid',
  },
});
