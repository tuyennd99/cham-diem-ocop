import { STAFF_PERMISSION } from '@ocop/shared';
import { create } from 'zustand';
import type { SessionUser } from '@/types/auth';
import { ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY } from '@/constants/auth';
import { hasStaffPermission } from '@/lib/session-contract';
import { getSession, setSession } from './session-store';

export type AppState = {
  name: string;
  auth: { user: SessionUser | null };
  sidebarOpen: boolean;
  sidebarOpenMobile: boolean;
  year: number;
};

export type AppActions = {
  login: (user: SessionUser, accessToken?: string) => void;
  logout: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarOpenMobile: (open: boolean) => void;
};

const initialSession = getSession();

export const useAppStore = create<AppState & AppActions>((set) => ({
  name: 'OCOP Đánh Giá',
  auth: { user: initialSession?.user ?? null },
  sidebarOpen:
    typeof window !== 'undefined'
      ? localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) !== 'true'
      : true,
  sidebarOpenMobile: false,
  year: new Date().getFullYear(),

  login: (user: SessionUser, accessToken?: string) => {
    const current = getSession();
    const token = accessToken ?? current?.accessToken ?? '';
    if (token) {
      setSession({ accessToken: token, user });
    }
    set({ auth: { user } });
  },

  logout: () => {
    setSession(null);
    set({ auth: { user: null } });
  },

  setSidebarOpen: (open: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY, String(!open));
    }
    set({ sidebarOpen: open });
  },
  setSidebarOpenMobile: (open: boolean) => set({ sidebarOpenMobile: open }),
}));

// Selector hooks to prevent subscribing to the entire store
export const useAuth = () => useAppStore((state) => state.auth);
export const useIsAdmin = () =>
  useAppStore((state) => hasStaffPermission(state.auth.user, STAFF_PERMISSION.MANAGE));
export const useSidebarOpen = () => useAppStore((state) => state.sidebarOpen);
export const useSidebarOpenMobile = () => useAppStore((state) => state.sidebarOpenMobile);

export const useLogin = () => useAppStore((state) => state.login);
export const useLogout = () => useAppStore((state) => state.logout);
export const useSetSidebarOpen = () => useAppStore((state) => state.setSidebarOpen);
export const useSetSidebarOpenMobile = () => useAppStore((state) => state.setSidebarOpenMobile);
