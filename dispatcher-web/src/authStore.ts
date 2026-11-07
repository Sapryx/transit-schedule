export interface Session {
  token: string;
  expiresAt: string;
}

export interface AuthStore {
  session(): Session | null;
  signIn(session: Session): void;
  signOut(): void;
  subscribe(listener: () => void): () => void;
}

const key = "session";

function readSession(storage: Storage): Session | null {
  const stored = storage.getItem(key);
  const session: Session | null = stored ? JSON.parse(stored) : null;
  return session && new Date(session.expiresAt) > new Date() ? session : null;
}

export function createAuthStore({ storage }: { storage: Storage }): AuthStore {
  let current = readSession(storage);
  const listeners = new Set<() => void>();

  function change(session: Session | null) {
    current = session;
    listeners.forEach((listener) => listener());
  }

  return {
    session: () => current,
    signIn(session) {
      storage.setItem(key, JSON.stringify(session));
      change(session);
    },
    signOut() {
      storage.removeItem(key);
      change(null);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
