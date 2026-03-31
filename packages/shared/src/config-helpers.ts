function exitWithConfigError(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    exitWithConfigError(`[config] Required environment variable "${name}" is not set. Exiting.`);
  }
  return value;
}

export function requireInt(name: string, defaultValue?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (defaultValue !== undefined) {
      return defaultValue;
    }

    exitWithConfigError(`[config] Required environment variable "${name}" is not set. Exiting.`);
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    exitWithConfigError(`[config] Environment variable "${name}" must be an integer, got: "${raw}". Exiting.`);
  }

  return parsed;
}
