import logoLilaRE from "../assets/logoLilaRE.png";
import SidebarItem from "./SidebarItem";
import UserMenu from "./UserMenu";
import "../styles/sidebar.css";

export default function Sidebar({ items, user, onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img
          src={logoLilaRE}
          alt="Fundación Rescate Esponjosos"
          className="sidebar-logo"
        />
      </div>

      <nav className="sidebar-nav" aria-label="Navegación principal">
        {items.map((item) => (
          <SidebarItem key={item.id} item={item} />
        ))}

        {items.length === 0 && (
          <p className="sidebar-empty">No hay módulos disponibles para tu rol.</p>
        )}
      </nav>

      <UserMenu user={user} onLogout={onLogout} />
    </aside>
  );
}
