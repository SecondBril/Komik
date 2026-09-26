import { createClient } from '@libsql/client';

let tursoClientInstance: ReturnType<typeof createClient> | null = null;

export function getTursoClient() {
  if (tursoClientInstance) return tursoClientInstance;

  const url = process.env.TURSO_DATABASE_URL || '';
  const authToken = process.env.TURSO_AUTH_TOKEN || '';

  if (!url || !authToken) {
    return null;
  }

  tursoClientInstance = createClient({
    url,
    authToken,
  });

  return tursoClientInstance;
}
