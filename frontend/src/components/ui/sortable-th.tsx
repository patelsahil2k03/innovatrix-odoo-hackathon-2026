/** `sort` is the raw sort string ("field" ascending, "-field" descending) and `onSort` receives
 * the bare field name — callers decide how to flip asc/desc (see toggleSort in use-paged-rows.ts,
 * or replicate the same toggle for server-side pages). */
export function SortableTh({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: string;
  sort: string;
  onSort: (field: string) => void;
}) {
  const isDesc = sort === `-${field}`;
  const isActive = sort === field || isDesc;

  return (
    <th>
      <button type="button" className="th-sort" onClick={() => onSort(field)}>
        {label}
        <span className={`sort-arrow ${isActive ? "is-active" : ""}`}>
          {isActive ? (isDesc ? "▼" : "▲") : "↕"}
        </span>
      </button>
    </th>
  );
}
