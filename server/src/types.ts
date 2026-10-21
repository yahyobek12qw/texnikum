import type { Permission, Role } from '@uchkoprik/shared';

export interface AuthContext {
  userId: string;
  email: string;
  name: string;
  role: Role;
  permissions: readonly Permission[];
  sessionId: string;
  csrfToken: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
