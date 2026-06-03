import { create } from "zustand";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "operator" | "viewer";
}

interface AuthState {
  user: AuthUser | null;
  // El access token se guarda solo en memoria (no localStorage)
  accessToken: string | null;
  isLoading: boolean;

  setAuth: (user: AuthUser, accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,

  setAuth: (user, accessToken) => set({ user, accessToken, isLoading: false }),
  clearAuth: () => set({ user: null, accessToken: null, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
