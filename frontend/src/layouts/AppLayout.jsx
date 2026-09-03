import { useEffect, useRef } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../hooks/useAuth";
import { usePermissions } from "../hooks/usePermissions";
import { DEFAULT_MENU_PATH } from "../config/navigation";
import { APP_ROUTES } from "../config/publicSite.config";
import { logout } from "../services/auth.service";
import "../styles/app-layout.css";

export default function AppLayout() {
  const { user, isAuthResolved, logoutUser } = useAuth();
  const { visibleNavigationItems } = usePermissions();
  const navigate = useNavigate();
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    if (isAuthResolved && !user) {
      navigate(APP_ROUTES.login, { replace: true });
    }
  }, [isAuthResolved, navigate, user]);

  const handleLogout = () => {
    if (isLoggingOutRef.current) {
      return;
    }

    isLoggingOutRef.current = true;

    logoutUser();
    navigate(APP_ROUTES.login, { replace: true });

    void logout()
      .catch(() => {})
      .finally(() => {
        isLoggingOutRef.current = false;
      });
  };

  const menuItems = visibleNavigationItems.length
    ? visibleNavigationItems
    : [
        {
          id: "fallback-home",
          label: "Inicio",
          path: DEFAULT_MENU_PATH,
        },
      ];

  return (
    <div className="app-layout">
      <Sidebar items={menuItems} user={user} onLogout={handleLogout} />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
