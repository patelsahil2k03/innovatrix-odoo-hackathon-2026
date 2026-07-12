"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type UserOut } from "./api";

interface AuthState {
  user: UserOut | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  async function refresh() {
    try {
      const res = await api.auth.me();
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    // Inlined rather than calling `refresh()` — the setState calls must live inside this
    // .then() callback, not as a bare statement in the effect body (react-hooks/set-state-in-effect).
    api.auth.me().then(
      (res) => {
        if (alive) {
          setUser(res.user);
          setLoading(false);
        }
      },
      () => {
        if (alive) {
          setUser(null);
          setLoading(false);
        }
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user && pathname !== "/login") router.replace("/login");
    if (user && pathname === "/login") router.replace("/");
  }, [loading, user, pathname, router]);

  async function logout() {
    await api.auth.logout().catch(() => {});
    setUser(null);
    router.replace("/login");
  }

  if (loading) {
    return (
      <div className="app-boot">
        <div className="spinner" />
      </div>
    );
  }

  // Redirects are in flight for these two cases — render nothing rather than a flash of the
  // wrong screen (protected content with no user, or the login form for an authed user).
  if (!user && pathname !== "/login") return null;
  if (user && pathname === "/login") return null;

  return <AuthContext.Provider value={{ user, refresh, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
