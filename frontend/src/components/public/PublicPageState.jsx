import { AlertCircle, LoaderCircle, PawPrint, SearchX } from "lucide-react";

const STATE_ICONS = {
  loading: LoaderCircle,
  error: AlertCircle,
  empty: SearchX,
  neutral: PawPrint,
};

export default function PublicPageState({
  variant = "neutral",
  surface = "default",
  eyebrow = null,
  title,
  description,
  actions = null,
  live = "polite",
}) {
  const Icon = STATE_ICONS[variant] || STATE_ICONS.neutral;

  return (
    <section
      className={`public-page-state public-page-state--${variant} public-page-state--${surface}`}
      aria-live={live}
    >
      <div className="public-page-state__icon" aria-hidden="true">
        <Icon size={30} />
      </div>

      <div className="public-page-state__copy">
        {eyebrow ? <p className="public-page-state__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {actions ? <div className="public-page-state__actions">{actions}</div> : null}
    </section>
  );
}
