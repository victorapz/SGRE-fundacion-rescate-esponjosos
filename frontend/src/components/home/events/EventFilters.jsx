import { EVENT_CATEGORY_OPTIONS } from "../../../constants/eventCategories";

export default function EventFilters({
  search,
  category,
  onSearchChange,
  onCategoryChange,
}) {
  return (
    <div className="event-filters">
      <label className="filter-item" htmlFor="event-search">
        <span>Buscar</span>
        <input
          id="event-search"
          type="search"
          placeholder="Buscar por título, lugar o descripción"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="search-input"
        />
      </label>

      <label className="filter-item" htmlFor="event-category-filter">
        <span>Categoría</span>
        <select
          id="event-category-filter"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
          className="filter-select"
        >
          <option value="">Todas las categorias</option>
          {EVENT_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
