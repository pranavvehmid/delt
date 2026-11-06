// What the list shows while loading, or when nothing matches.
export function Skeleton() {
  return (
    <ul className="rows skeleton" aria-label="Loading mail">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="row">
          <div className="row-main">
            <span className="avatar sk" />
            <span className="row-text">
              <span className="sk" style={{ width: "40%" }} />
              <span className="sk" style={{ width: "85%" }} />
              <span className="sk" style={{ width: "65%" }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ title, hint, children }: { title: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="empty" role="status">
      <span className="empty-mark" aria-hidden="true" />
      <b>{title}</b>
      {hint && <span className="muted">{hint}</span>}
      {children && <span className="empty-acts">{children}</span>}
    </div>
  );
}
