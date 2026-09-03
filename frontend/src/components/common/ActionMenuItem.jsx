import "../../styles/icon-actions.css";

export default function ActionMenuItem({
  icon: Icon,
  label,
  variant = "secondary",
  className = "",
  type = "button",
  children,
  ...props
}) {
  const resolvedLabel = children || label;

  return (
    <button
      type={type}
      className={[
        "action-menu-item",
        `action-menu-item--${variant}`,
        className,
      ].filter(Boolean).join(" ")}
      {...props}
    >
      {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : null}
      <span>{resolvedLabel}</span>
    </button>
  );
}
