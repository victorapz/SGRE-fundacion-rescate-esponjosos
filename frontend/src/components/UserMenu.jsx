import { LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import IconButton from "./common/IconButton";
import { buildUserMenuIdentity } from "./userMenu.shared";
import { APP_ROUTES } from "../config/publicSite.config";

export default function UserMenu({ user, onLogout }) {
  const { displayName, roleLabel, initial } = buildUserMenuIdentity(user);

  const handleLogoutClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onLogout?.(event);
  };

  return (
    <div className="profile-card">
      <Link
        to={APP_ROUTES.myProfile}
        className="profile-card-main"
        aria-label={`Abrir Mi Perfil de ${displayName}`}
      >
        <div className="avatar" aria-hidden="true">
          {initial}
        </div>

        <div className="profile-content">
          <p className="profile-name">{displayName}</p>
          <p className="profile-role" title={roleLabel}>
            {roleLabel}
          </p>
        </div>
      </Link>

      <IconButton
        icon={LogOut}
        label="Cerrar sesión"
        variant="secondary"
        type="button"
        className="logout-btn"
        onClick={handleLogoutClick}
      />
    </div>
  );
}
