import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import { login } from "../services/auth.service";

export function useLogin() {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const handleLogin = async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const data = await login(credentials);
      loginUser(data);
      navigate("/inicio");
    } catch (errorCaught) {
      setError(
        errorCaught?.response?.data?.details?.message
        || errorCaught?.response?.data?.message
        || "Error al iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  };

  return { handleLogin, error, loading };
}
