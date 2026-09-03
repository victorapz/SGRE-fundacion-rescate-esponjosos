import { Link } from "react-router-dom";

export default function PageBreadcrumb({
  moduleLabel,
  moduleTo,
  currentLabel,
  className = "",
}) {
  return (
    <nav
      className={`page-breadcrumb ${className}`.trim()}
      aria-label="Breadcrumb"
    >
      {moduleTo ? (
        <Link className="page-breadcrumb-link" to={moduleTo}>
          {moduleLabel}
        </Link>
      ) : (
        <span className="page-breadcrumb-current">{moduleLabel}</span>
      )}
      <span className="page-breadcrumb-separator" aria-hidden="true">
        /
      </span>
      <span className="page-breadcrumb-current">{currentLabel}</span>
    </nav>
  );
}
