export function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
