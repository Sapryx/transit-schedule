export interface Config {
  port: number;
  databaseUrl: string;
  dispatcherLogin: string;
  dispatcherPassword: string;
  jwtSecret: string;
}

function required(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

export function readConfig(env: Record<string, string | undefined>): Config {
  return {
    port: Number(env.PORT ?? 3000),
    databaseUrl: required(env, "DATABASE_URL"),
    dispatcherLogin: required(env, "DISPATCHER_LOGIN"),
    dispatcherPassword: required(env, "DISPATCHER_PASSWORD"),
    jwtSecret: required(env, "JWT_SECRET"),
  };
}
