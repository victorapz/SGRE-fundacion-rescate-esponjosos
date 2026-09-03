import { useId } from "react";
import "../../styles/icon-actions.css";

function handleKeyboardOpen(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.currentTarget.click();
  }
}

export default function FileTriggerButton({
  icon: Icon,
  label,
  accept,
  multiple = false,
  disabled = false,
  variant = "secondary",
  className = "",
  inputClassName = "",
  inputRef = null,
  onChange,
}) {
  const inputId = useId();

  return (
    <div className={["file-trigger-button", className].filter(Boolean).join(" ")}>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={disabled}
        className={["file-trigger-button__input", inputClassName].filter(Boolean).join(" ")}
      />
      <label
        htmlFor={inputId}
        className={[
          "icon-button",
          "file-trigger-button__label",
          `icon-button--${variant}`,
          disabled ? "is-disabled" : "",
        ].filter(Boolean).join(" ")}
        aria-label={label}
        title={label}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyboardOpen}
      >
        {Icon ? <Icon size={18} strokeWidth={2} aria-hidden="true" /> : null}
        <span className="icon-button__sr-only">{label}</span>
      </label>
    </div>
  );
}
