export function Meter({
  value,
  className = "",
  fillClassName = "",
}: {
  value: number;
  className?: string;
  fillClassName?: string;
}) {
  return (
    <div className={`meter ${className}`}>
      <div className={`meter-fill ${fillClassName}`} style={{ width: `${value}%` }} />
    </div>
  );
}
