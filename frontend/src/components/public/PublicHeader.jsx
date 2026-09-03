import { useEffect, useMemo, useState } from "react";
import { HeartHandshake, Menu, X } from "lucide-react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  APP_ROUTES,
  publicSiteConfig,
} from "../../config/publicSite.config";

const DONATION_ACTIVE_ROUTES = new Set([
  APP_ROUTES.donate,
  APP_ROUTES.donationSuccess,
  APP_ROUTES.donationSuccessAlias,
  APP_ROUTES.donationCancel,
  APP_ROUTES.donationCancelAlias,
]);

function buildHeaderLinks({ showLoginLink = true } = {}) {
  const links = [...publicSiteConfig.navigation];

  if (showLoginLink && publicSiteConfig.routes?.login) {
    links.push({
      key: "login",
      label: "Acceso interno",
      to: publicSiteConfig.routes.login,
      emphasis: "ghost",
    });
  }

  return links;
}

export default function PublicHeader({
  variant = "default",
  showLoginLink = true,
}) {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const headerLinks = useMemo(
    () => buildHeaderLinks({ showLoginLink }),
    [showLoginLink]
  );

  const isDonateActive = DONATION_ACTIVE_ROUTES.has(location.pathname);
  const isHashLinkActive = (to) =>
    typeof to === "string"
    && to.includes("#")
    && `${location.pathname}${location.hash}` === to;
  const handleHashLinkClick = (event, to) => {
    setIsMenuOpen(false);

    if (!to.includes("#")) {
      return;
    }

    const [pathname, hash] = to.split("#");
    if (location.pathname === pathname && location.hash === `#${hash}`) {
      event.preventDefault();
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className={`public-header public-header--${variant}`}>
      <div className="public-header__inner public-shell">
        <Link
          to={publicSiteConfig.routes.home}
          className="public-header__brand"
          onClick={() => setIsMenuOpen(false)}
        >
          <img
            src={publicSiteConfig.assets.logo}
            alt={publicSiteConfig.name}
            className="public-header__logo"
          />

          <span className="public-header__brand-copy">
            <strong>{publicSiteConfig.name}</strong>
            <small>{publicSiteConfig.tagline}</small>
          </span>
        </Link>

        <button
          type="button"
          className="public-header__menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="public-site-navigation"
          aria-label={
            isMenuOpen
              ? "Cerrar menú de navegación"
              : "Abrir menú de navegación"
          }
          onClick={() => setIsMenuOpen((current) => !current)}
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav
          id="public-site-navigation"
          className={`public-header__nav ${
            isMenuOpen ? "is-open" : ""
          }`}
          aria-label="Navegación pública"
        >
          <div className="public-header__nav-links">
            {headerLinks.map((link) => (
              link.to.includes("#") ? (
                <Link
                  key={link.key}
                  to={link.to}
                  onClick={(event) => handleHashLinkClick(event, link.to)}
                  className={[
                    "public-header__link",
                    link.emphasis === "ghost" ? "is-ghost" : "",
                    isHashLinkActive(link.to) ? "is-active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {link.label}
                </Link>
              ) : (
                <NavLink
                  key={link.key}
                  to={link.to}
                  end
                  onClick={() => setIsMenuOpen(false)}
                  className={({ isActive }) =>
                    [
                      "public-header__link",
                      link.emphasis === "ghost" ? "is-ghost" : "",
                      isActive ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")
                  }
                >
                  {link.label}
                </NavLink>
              )
            ))}
          </div>

          <NavLink
            to={publicSiteConfig.routes.donate}
            end
            aria-current={isDonateActive ? "page" : undefined}
            className={`public-header__cta ${
              isDonateActive ? "is-active" : ""
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <HeartHandshake size={18} aria-hidden="true" />
            <span>Donar</span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
