import "../styles/home.page.css";

export default function ModulePage({ title }) {
  return (
    <section className="main-content">
      <header className="main-header">
        <h1>{title}</h1>
        <p>Este módulo esta listo para conectar sus vistas y datos reales.</p>
      </header>

      <section className="content-grid">
        <article className="calendar-card">
          <div className="calendar-header">
            <h2>Próximo paso</h2>
          </div>
          <div className="calendar-placeholder">
            <p>Implementar componentes de este módulo.</p>
            <p>La navegacion ya esta integrada con el sidemenu.</p>
          </div>
        </article>

        <aside className="events-panel">
          <h3>Estado</h3>
          <div className="event-list">
            <article className="event-card">
              <h4>Integración base completada</h4>
              <p>Ruta protegida y menu activo por rol Administrador.</p>
            </article>
          </div>
        </aside>
      </section>
    </section>
  );
}
