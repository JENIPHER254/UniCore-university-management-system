import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setToken, getToken } from "./api";

export interface User {
  id: number;
  email: string;
  fullName: string;
  roleCode: string;
  roleName: string;
}

export type Module =
  | "dashboard"
  | "students"
  | "programmes"
  | "finance"
  | "hr"
  | "users"
  | "settings"
  | "import";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  can: (module: Module) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<User>("/auth/me");
        if (!cancelled) setUser(me);
      } catch {
        setToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    setToken(res.token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  /** Mirrors the backend permission map; the API always re-checks server-side. */
  const can = useCallback(
    (module: Module): boolean => {
      if (!user) return false;
      if (user.roleCode === "administrator") return true;
      switch (module) {
        case "dashboard":
          return true;
        case "import":
          return true;
        case "students":
        case "programmes":
          return user.roleCode === "student_affairs_officer";
        case "finance":
          return user.roleCode === "finance_officer";
        case "hr":
          return user.roleCode === "hr_officer";
        default:
          return false;
      }
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, login, logout, can }),
    [user, loading, login, logout, can]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
