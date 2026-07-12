export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <span className="text-body-sm">{label}</span>
    </div>
  );
}

export function LoadingInline({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-block-inline">
      <div className="spinner" />
      <span className="text-body-sm">{label}</span>
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-block">
      <span className="text-body-md u-warning">{message}</span>
      {onRetry ? (
        <button className="btn btn-sm btn-outline-muted" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyBlock({ label }: { label: string }) {
  return (
    <div className="state-block">
      <span className="text-body-sm">{label}</span>
    </div>
  );
}

export function TableRowState({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="cell-muted" style={{ textAlign: "center", padding: "var(--space-md)" }}>
        {children}
      </td>
    </tr>
  );
}
