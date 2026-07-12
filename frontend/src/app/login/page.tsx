"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Field, FormAlert } from "@/components/ui/field";
import {
  fieldErrorsFrom,
  formMessageFrom,
  hasErrors,
  validateLogin,
  type FieldErrors,
} from "@/lib/validation";

export default function LoginPage() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function clearError(field: string) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const found = validateLogin(email, password);
    if (hasErrors(found)) {
      setErrors(found);
      return;
    }
    setErrors({});
    setSubmitting(true);

    try {
      await api.auth.login(email, password);
      await refresh();
    } catch (err) {
      setErrors(fieldErrorsFrom(err));
      setError(formMessageFrom(err, "Unable to sign in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

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

        <h1 className="text-display-md login-title">Sign In</h1>
        <p className="text-body-md login-sub">
          Sign in to manage fleet operations, dispatch, and analytics.
        </p>

        <form className="stack" onSubmit={handleSubmit} noValidate>
          {error ? <FormAlert message={error} /> : null}

          <Field id="email" label="Email" required error={errors.email}>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@transitops.in"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
            />
          </Field>

          <Field id="password" label="Password" required error={errors.password}>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
            />
          </Field>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: "100%", marginTop: "var(--space-xs)" }}
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
