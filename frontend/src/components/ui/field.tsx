"use client";

import { cloneElement, type ReactElement, type ReactNode } from "react";

/* ==========================================================================
   Form field primitives.

   One place decides how a required field is marked and how an error reads, so every form in the
   app says "this is required" the same way. The asterisk is decorative (aria-hidden) — screen
   readers get `aria-required` on the control instead of hearing "star", and the error is wired
   to the input with aria-describedby + role="alert" so it is announced when it appears.
   ========================================================================== */

type ControlProps = {
  id?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-required"?: boolean;
  "aria-describedby"?: string;
};

export function Field({
  id,
  label,
  children,
  required = false,
  error,
  hint,
  warning,
  span2 = false,
}: {
  id: string;
  label: string;
  /** The <input>/<select>/<textarea>. Its a11y + error styling is wired up here. */
  children: ReactElement<ControlProps>;
  required?: boolean;
  error?: string;
  /** Neutral helper text, e.g. "Auto-computed if left blank". */
  hint?: ReactNode;
  /** Amber advisory that does NOT block submission (e.g. an already-expired licence). */
  warning?: string | null;
  span2?: boolean;
}) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint || warning ? hintId : undefined;

  const control = cloneElement(children, {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
    "aria-describedby": describedBy,
    className: [children.props.className, error ? "is-invalid" : null].filter(Boolean).join(" "),
  });

  return (
    <div className={`field${span2 ? " span-2" : ""}`}>
      <label className="label" htmlFor={id}>
        {label}
        {required ? (
          <span className="label-required" aria-hidden="true" title="Required">
            *
          </span>
        ) : (
          <span className="label-optional"> (optional)</span>
        )}
      </label>

      {control}

      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : warning ? (
        <p className="field-warning" id={hintId}>
          {warning}
        </p>
      ) : hint ? (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Legend for the top of a form: tells the user what the asterisk means before they hit submit. */
export function RequiredLegend() {
  return (
    <p className="form-legend span-2">
      Fields marked <span className="label-required" aria-hidden="true">*</span> are required.
    </p>
  );
}

/**
 * Summary banner shown after a failed submit. Counts the invalid fields so the user knows what
 * happened even if the offending field is scrolled out of view inside the modal.
 */
export function FormAlert({ message, count }: { message: string; count?: number }) {
  return (
    <div className="form-alert span-2" role="alert">
      <strong>{message}</strong>
      {count && count > 0 ? (
        <span>
          {" "}
          Please correct {count} highlighted field{count === 1 ? "" : "s"} below.
        </span>
      ) : null}
    </div>
  );
}
