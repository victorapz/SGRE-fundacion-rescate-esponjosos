import { useState } from "react";
import IMG from "../assets/IMG_1207_jpg.jpg";
import LOGO from "../assets/logoLilaRE.png";
import PublicHeader from "../components/public/PublicHeader";
import { useLogin } from "../hooks/useLogin";
import "../styles/login.page.css";

const LoginPage = () => {
  const { handleLogin, error, loading } = useLogin();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    await handleLogin({
      email: formData.email.trim(),
      password: formData.password,
    });
  };

  return (
    <div className="public-site login-page-shell">
    <PublicHeader variant="login" />

      <main className="login-page">
        <section
          className="login-visual"
          aria-label="Presentación de Fundación Rescate Esponjosos"
        >
          <div
            className="login-visual-bg"
            style={{ backgroundImage: `url(${IMG})` }}
            aria-hidden="true"
          >
            <div className="login-visual-overlay" />
          </div>


          <div className="login-copy">
            <h1>
              Cambiando vidas,
              <br />

              <span className="login-copy-accent">
                una patita a la vez.
              </span>
            </h1>

            <p>
              Gracias por ser parte de nuestra misión. Tu apoyo ayuda a
              rescatar, rehabilitar y encontrar hogares para animales en
              necesidad.
            </p>
          </div>
        </section>

        <section
          className="login-form-panel"
          aria-labelledby="login-title"
        >
          <form
            onSubmit={onSubmit}
            className="login-form"
          >
            <header className="login-form-header">
              <span className="login-form-eyebrow">
                Sistema de gestión
              </span>

              <h2 id="login-title">
                Iniciar sesión
              </h2>

              <p>
                Ingresa tus credenciales para acceder al sistema interno.
              </p>
            </header>

            <div className="login-field">
              <label htmlFor="login-email">
                Correo electrónico
              </label>

              <input
                id="login-email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="usuario@example.com"
                disabled={loading}
              />
            </div>

            <div className="login-field">
              <label htmlFor="login-password">
                Contraseña
              </label>

              <input
                id="login-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                disabled={loading}
              />
            </div>

            {error ? (
              <p
                className="login-error"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="login-submit"
            >
              {loading ? "Accediendo..." : "Acceder"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default LoginPage;
