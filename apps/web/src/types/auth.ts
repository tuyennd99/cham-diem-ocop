export type AppRole = "REGISTRANT" | "JUDGE" | "ADMIN";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: AppRole;
  verified: boolean;
}

export interface Session {
  accessToken: string;
  user: SessionUser;
}

export interface LoginResponse {
  accessToken: string;
  user: SessionUser;
}
