const requiredEnv = [
  "IMGBASE_UPLOAD_URL",
  "IMGBASE_UPLOAD_COMPLETE_URL",
  "ADMIN_BASIC_AUTH_USER",
  "ADMIN_BASIC_AUTH_PASS"
] as const;

type RequiredEnv = (typeof requiredEnv)[number];

type Config = Record<RequiredEnv, string>;

export function readConfig(): Config {
  const missing: string[] = [];
  const values = {} as Config;

  for (const key of requiredEnv) {
    const value = process.env[key];
    if (!value) {
      missing.push(key);
    } else {
      values[key] = value;
    }
  }

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  return values;
}
