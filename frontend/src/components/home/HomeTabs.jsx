export default function HomeTabs({ tabs = [], activeTab, onChange }) {
  return (
    <nav className="home-tabs" role="tablist" aria-label="Tabs de inicio">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`panel-${tab.id}`}
            className={`home-tab-button ${isActive ? "home-tab-button-active" : ""}`.trim()}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}