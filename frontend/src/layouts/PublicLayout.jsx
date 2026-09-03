import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import PublicFooter from "../components/public/PublicFooter";
import PublicHeader from "../components/public/PublicHeader";
import "../styles/public-site.css";
import "../styles/public-donation.css";
import "../styles/public-sponsorship.css";

export default function PublicLayout({ variant = "default" }) {
  const location = useLocation();
  const mainRef = useRef(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      mainRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (!location.hash) {
      return undefined;
    }

    let timeoutId = null;
    const frame = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => {
        const target = document.getElementById(location.hash.replace("#", ""));
        target?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 80);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [location.hash, location.pathname]);

  return (
    <div className={`public-site public-site--${variant}`}>
      <a href="#public-site-main" className="public-site__skip-link">
        Saltar al contenido
      </a>

      <PublicHeader variant={variant} />

      <main
        id="public-site-main"
        ref={mainRef}
        className="public-main"
        tabIndex={-1}
      >
        <div className="public-main__inner public-shell">
          <Outlet />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
