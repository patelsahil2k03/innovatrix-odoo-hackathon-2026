"use client";

import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-mark">
          <div className="sidebar-brand-mark">T</div>
          <div>
            <div className="sidebar-brand-name">TransitOps</div>
            <div className="sidebar-brand-sub">Fleet Intelligence Platform</div>
          </div>
        </div>

        <h1 className="text-display-md login-title">Super Admin Access</h1>
        <p className="text-body-md login-sub">
          Sign in to manage fleet operations, dispatch, and analytics.
        </p>

        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/");
          }}
        >
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              className="input"
              id="email"
              type="email"
              placeholder="you@transitops.io"
              defaultValue="gaurav.rathva@transitops.io"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              className="input"
              id="password"
              type="password"
              placeholder="••••••••••"
              defaultValue="superadmin"
              required
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
            <label className="text-body-sm u-body" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" defaultChecked /> Keep me signed in
            </label>
            <a href="#" className="text-body-sm u-primary">
              Forgot password?
            </a>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "var(--space-xs)" }}>
            Sign In
          </button>
        </form>

        <p className="text-caption login-footnote">TransitOps © 2026 · Authorized personnel only</p>
      </div>
    </div>
  );
}
