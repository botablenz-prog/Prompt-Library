export type Role = "admin" | "guest";

export interface AuthState {
  isLoggedIn: boolean;
  role: Role;
  email: string | null;
}
