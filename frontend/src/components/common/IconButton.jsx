import "../../styles/icon-actions.css";

export default function IconButton({
  as: Component = "button",
  icon: Icon,
  label,
  variant = "secondary",
  size = "md",
  type = "button",
  className = "",
  disabled = false,
  loading = false,
  title,
  children,
  ...props
}) {
  const resolvedLabel = String(label || "").trim();
  const resolvedTitle = title || resolvedLabel;

  return (
    <Component
      {...(Component === "button" ? { type } : {})}
      className={[
        "icon-button",
        `icon-button--${variant}`,
        `icon-button--${size}`,
        className,
      ].filter(Boolean).join(" ")}
      aria-label={resolvedLabel}
      title={resolvedTitle}
      disabled={disabled || loading}
      {...props}
    >
      {Icon ? (
        <Icon
          size={18}
          strokeWidth={2}
          aria-hidden="true"
          className={loading ? "icon-button__icon is-spinning" : "icon-button__icon"}
        />
      ) : null}
      {children ? <span className="icon-button__sr-only">{children}</span> : null}
    </Component>
  );
}
