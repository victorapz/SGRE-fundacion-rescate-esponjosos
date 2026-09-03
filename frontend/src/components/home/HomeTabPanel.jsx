export default function HomeTabPanel({ id, children }) {
  return (
    <section className="home-tab-panel" id={`panel-${id}`} role="tabpanel" aria-live="polite">
      {children}
    </section>
  );
}