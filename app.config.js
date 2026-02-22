// Dynamic Expo config – extends app.json with optional baseUrl for subpath hosting (e.g. GitHub Pages).
// Set EXPO_BASE_URL=<subpath> when running `expo export` to enable it.
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (baseUrl) {
    config.experiments = {
      ...config.experiments,
      baseUrl: `/${baseUrl.replace(/^\/+/, '')}`,
    };
  }
  return config;
};
