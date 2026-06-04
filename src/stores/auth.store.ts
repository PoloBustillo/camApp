import { create } from "zustand";

// Auth.js handles the actual session via HttpOnly cookies.
// This store is only for UI state that needs to be tracked client-side.
interface AuthState {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoading: false,
  setLoading: (isLoading) => set({ isLoading }),
}));
