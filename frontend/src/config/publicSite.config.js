import HOME_HERO_IMAGE from "../assets/IMG_1207_jpg.jpg";
import LOGO_IMAGE from "../assets/logoLilaRE.png";

function readPublicConfigValue(key) {
  const value = import.meta.env?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export const PUBLIC_SITE_ROUTES = Object.freeze({
  home: "/fundacion",
  notices: "/avisos",
  accountingReports: "/informes",
  donate: "/donar",
  sponsorshipList: "/apadrinamiento",
  sponsorshipSuccess: "/apadrinamiento/success",
  sponsorshipCancel: "/apadrinamiento/cancel",
  sponsorshipDetail: "/apadrinamiento/:animalId",
  login: "/login",
  donationSuccess: "/donacion/exito",
  donationSuccessAlias: "/donacion/success",
  donationCancel: "/donacion/cancelada",
  donationCancelAlias: "/donacion/cancel",
});

export const APP_ROUTES = Object.freeze({
  root: "/",
  login: PUBLIC_SITE_ROUTES.login,
  publicHome: PUBLIC_SITE_ROUTES.home,
  publicNotices: PUBLIC_SITE_ROUTES.notices,
  publicAccountingReports: PUBLIC_SITE_ROUTES.accountingReports,
  publicSponsorships: PUBLIC_SITE_ROUTES.sponsorshipList,
  adminHome: "/inicio",
  myProfile: "/mi-perfil",
  donate: PUBLIC_SITE_ROUTES.donate,
  donationSuccess: PUBLIC_SITE_ROUTES.donationSuccess,
  donationSuccessAlias: PUBLIC_SITE_ROUTES.donationSuccessAlias,
  donationCancel: PUBLIC_SITE_ROUTES.donationCancel,
  donationCancelAlias: PUBLIC_SITE_ROUTES.donationCancelAlias,
});

const FOUNDATION = Object.freeze({
  officialName: "Fundación Rescate Esponjosos",
  shortName: "Rescate Esponjosos",
  description:
    "Acompañamos el rescate, la recuperación y el cuidado responsable de animales exóticos que necesitan atención, estabilidad y una nueva oportunidad.",
  mission:
    "Proteger y rehabilitar animales rescatados mediante cuidado veterinario, apoyo temporal, educación y redes de colaboración comprometidas con su bienestar.",
  vision:
    "Construir una comunidad informada y solidaria donde cada animal rescatado pueda acceder a cuidado digno, seguimiento y oportunidades reales de recuperación.",
  history:
    "Desde septiembre de 2019, Fundación Rescate Esponjosos trabaja por el rescate, rehabilitación y reubicación de animales exóticos en situación de abandono o vulnerabilidad. Nuestra labor nace del compromiso por proteger a aquellos animales que muchas veces son invisibilizados, como aves, roedores, reptiles, peces y otras especies no convencionales.\n\nA lo largo de estos años, hemos rescatado 729 animales, de los cuales aproximadamente 500 han encontrado una nueva familia mediante procesos de adopción responsable. Este trabajo ha sido posible gracias al esfuerzo de voluntarias, voluntarios, hogares temporales, padrinos, madrinas y personas que apoyan nuestra causa a través de donaciones.\n\nEl 24 de octubre de 2024 nos constituimos formalmente como persona jurídica sin fines de lucro, consolidando nuestra misión de entregar una segunda oportunidad a animales exóticos y promover una tenencia responsable.\n\nHoy seguimos creciendo para mejorar nuestra gestión, fortalecer nuestra presencia digital y acercar nuestra labor a la comunidad. Cada rescate, adopción y aporte nos permite avanzar hacia un futuro más seguro y digno para los animales que más lo necesitan.",
  servedRegions: ["Valparaíso", "Metropolitana"],
  contactEmail: "contacto@example.com",
  instagramUrl: "https://www.instagram.com/rescateesponjosos/",
  // These values are intentionally public presentation data. VITE_* values are
  // bundled into the browser, so no private credentials belong in this object.
  transferData: Object.freeze({
    holder: readPublicConfigValue("VITE_TRANSFER_HOLDER"),
    rut: readPublicConfigValue("VITE_TRANSFER_RUT"),
    bank: readPublicConfigValue("VITE_TRANSFER_BANK"),
    accountType: readPublicConfigValue("VITE_TRANSFER_ACCOUNT_TYPE"),
    accountNumber: readPublicConfigValue("VITE_TRANSFER_ACCOUNT_NUMBER"),
    email: readPublicConfigValue("VITE_TRANSFER_EMAIL"),
  }),
});

export const publicSiteConfig = Object.freeze({
  name: FOUNDATION.officialName,
  shortName: FOUNDATION.shortName,
  tagline: "rescate, cuidado y segundas oportunidades.",
  description: FOUNDATION.description,
  institutionalText:
    "Cada aporte ayuda a sostener rescates, recuperación clínica, alimentación y seguimiento para animales que necesitan apoyo constante.",
  mission: FOUNDATION.mission,
  vision: FOUNDATION.vision,
  whoWeAre: FOUNDATION.history,
  foundation: FOUNDATION,
  contact: {
    email: FOUNDATION.contactEmail,
    phone: null,
  },
  social: {
    instagram: FOUNDATION.instagramUrl,
    facebook: null,
    tiktok: null,
  },
  routes: PUBLIC_SITE_ROUTES,
  navigation: [
    {
      key: "home",
      label: "Inicio",
      to: PUBLIC_SITE_ROUTES.home,
    },
    {
      key: "about",
      label: "Sobre nosotros",
      to: `${PUBLIC_SITE_ROUTES.home}#sobre-nosotros`,
    },
    {
      key: "notices",
      label: "Avisos",
      to: PUBLIC_SITE_ROUTES.notices,
    },
    {
      key: "sponsorships",
      label: "Apadrinamiento",
      to: PUBLIC_SITE_ROUTES.sponsorshipList,
    },
    {
      key: "accountingReports",
      label: "Informes",
      to: PUBLIC_SITE_ROUTES.accountingReports,
    },
  ],
  assets: {
    logo: LOGO_IMAGE,
    homeHero: HOME_HERO_IMAGE,
    donationBackground: "/gonHamster.png",
  },
});
