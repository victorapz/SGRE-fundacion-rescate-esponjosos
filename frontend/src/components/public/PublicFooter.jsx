import { Link } from "react-router-dom";
import { publicSiteConfig } from "../../config/publicSite.config";
import { sanitizePublicExternalUrl } from "../../utils/publicSite";

function buildFooterLinks() {
  const links = [
    {
      key: "home",
      label: "Inicio",
      to: publicSiteConfig.routes.home,
      internal: true,
    },
    {
      key: "about",
      label: "Sobre nosotros",
      to: `${publicSiteConfig.routes.home}#sobre-nosotros`,
      internal: true,
    },
    {
      key: "notices",
      label: "Avisos",
      to: publicSiteConfig.routes.notices,
      internal: true,
    },
    {
      key: "sponsorships",
      label: "Apadrinamiento",
      to: publicSiteConfig.routes.sponsorshipList,
      internal: true,
    },
    {
      key: "accountingReports",
      label: "Informes",
      to: publicSiteConfig.routes.accountingReports,
      internal: true,
    },
    {
      key: "donate",
      label: "Donar",
      to: publicSiteConfig.routes.donate,
      internal: true,
    },
  ];

  if (publicSiteConfig.routes?.login) {
    links.push({
      key: "login",
      label: "Acceso interno",
      to: publicSiteConfig.routes.login,
      internal: true,
    });
  }

  return links;
}

function buildContactLinks() {
  const items = [];
  const emailHref = sanitizePublicExternalUrl(
    publicSiteConfig.contact?.email ? `mailto:${publicSiteConfig.contact.email}` : null,
  );
  const phoneHref = sanitizePublicExternalUrl(
    publicSiteConfig.contact?.phone ? `tel:${publicSiteConfig.contact.phone}` : null,
  );

  if (emailHref) {
    items.push({
      key: "email",
      label: publicSiteConfig.contact.email,
      href: emailHref,
    });
  }

  if (phoneHref) {
    items.push({
      key: "phone",
      label: publicSiteConfig.contact.phone,
      href: phoneHref,
    });
  }

  return items;
}

function buildSocialLinks() {
  return Object.entries(publicSiteConfig.social || {})
    .map(([key, value]) => ({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      href: sanitizePublicExternalUrl(value),
    }))
    .filter((item) => item.href);
}

export default function PublicFooter() {
  const currentYear = new Date().getFullYear();
  const footerLinks = buildFooterLinks();
  const contactLinks = buildContactLinks();
  const socialLinks = buildSocialLinks();

  return (
    <footer className="public-footer">
      <div className="public-footer__inner public-shell">
        <div className="public-footer__brand">
          <strong>{publicSiteConfig.name}</strong>
          <p>{publicSiteConfig.description}</p>
          <p className="public-footer__foundation-meta">
            {publicSiteConfig.foundation.servedRegions.join(" · ")}
          </p>
        </div>

        <div className="public-footer__links">
          {footerLinks.map((link) => (
            <Link key={link.key} to={link.to} className="public-footer__link">
              {link.label}
            </Link>
          ))}
        </div>

        {contactLinks.length > 0 ? (
          <div className="public-footer__meta">
            {contactLinks.map((item) => (
              <a key={item.key} href={item.href} className="public-footer__external-link">
                {item.label}
              </a>
            ))}
          </div>
        ) : null}

        {socialLinks.length > 0 ? (
          <div className="public-footer__meta">
            {socialLinks.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="public-footer__external-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.label}
              </a>
            ))}
          </div>
        ) : null}

        <p className="public-footer__legal">
          {currentYear} {publicSiteConfig.shortName}. {publicSiteConfig.tagline}
        </p>
      </div>
    </footer>
  );
}
