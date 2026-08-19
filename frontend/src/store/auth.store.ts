import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '../lib/api';
import type { UserCategory } from '../lib/parking';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'USER' | 'ADMIN';
  /** Decide en qué zonas puede estacionarse (independiente del rol). */
  category: UserCategory;
}

/**
 * El middleware de Next corre en el servidor y no puede leer localStorage,
 * así que espejamos únicamente el rol en una cookie para poder redirigir.
 * ponytail: la autorización real la aplican los Guards del backend; esta cookie
 * solo evita renderizar rutas que el usuario no puede usar.
 */
function setRoleCookie(role?: string) {
  if (typeof document === 'undefined') return;
  document.cookie = role
    ? `ujap-role=${role}; path=/; max-age=604800; samesite=lax`
    : 'ujap-role=; path=/; max-age=0';
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  /**
   * `false` hasta que zustand termina de leer localStorage. Sin esta bandera,
   * en el primer render `user` es null y los layouts redirigirían a /login en
   * cada carga directa o refresco de página, aunque la sesión sea válida.
   */
  hydrated: boolean;
  setHydrated: () => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          const { accessToken, refreshToken, user } = data.data;

          // Guardar en localStorage para el interceptor de axios
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          setRoleCookie(user.role);

          set({ user, accessToken, refreshToken, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          const { refreshToken } = get();
          await api.post('/auth/logout', { refreshToken });
        } catch {
          // Continuar con logout local aunque falle el request
        } finally {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setRoleCookie(undefined);
          set({ user: null, accessToken: null, refreshToken: null });
        }
      },

      loadMe: async () => {
        try {
          const { data } = await api.get('/auth/me');
          setRoleCookie(data.data.role);
          set({ user: data.data });
        } catch {
          setRoleCookie(undefined);
          set({ user: null, accessToken: null, refreshToken: null });
        }
      },

      isAdmin: () => get().user?.role === 'ADMIN',
    }),
    {
      name: 'ujap-auth',
      // `hydrated` nunca se persiste: describe esta carga de página, no la sesión
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);
