export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  name?: string | null;
  picture?: string | null;
  isDemo?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
