export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const clampedPage = Math.min(Math.max(1, page), totalPages);
  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to = Math.min(clampedPage * pageSize, total);

  return (
    <div className="pagination">
      <span className="text-body-sm u-muted-soft">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="btn btn-sm btn-outline-muted"
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(clampedPage - 1)}
        >
          Prev
        </button>
        <span className="text-body-sm">
          Page {clampedPage} of {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-sm btn-outline-muted"
          disabled={clampedPage >= totalPages}
          onClick={() => onPageChange(clampedPage + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
