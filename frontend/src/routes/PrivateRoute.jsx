import { Navigate, useLocation } from "react-router-dom";
import { APP_ROUTES } from "../config/publicSite.config";
import { useAuth } from "../hooks/useAuth";

export default function PrivateRoute({ children }) {
  const location = useLocation();
  const { user, isAuthResolved } = useAuth();

  if (!isAuthResolved) {
    return null;
  }

  if (!user) {
    return <Navigate to={APP_ROUTES.login} replace state={{ from: location }} />;
  }

  return children;
}
