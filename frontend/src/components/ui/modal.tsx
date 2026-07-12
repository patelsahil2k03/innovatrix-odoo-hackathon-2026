"use client";

import type { ReactNode } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className={`modal-overlay ${isOpen ? "is-open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <h2 className="text-title-md" style={{ margin: 0 }}>
            {title}
          </h2>
          <button className="btn-text" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">{footer}</div>
      </div>
    </div>
  );
}
