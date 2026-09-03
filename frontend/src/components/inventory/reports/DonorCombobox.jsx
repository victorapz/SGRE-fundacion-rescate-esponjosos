import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  buildDonorSearchText,
  formatInstagramUsername,
  normalizeDonorPhone,
  normalizeInstagramUsername,
} from "../../../utils/donor";

function donorSecondaryText(donor) {
  return [
    donor.telefono || null,
    formatInstagramUsername(donor.usuarioInstagram) || null,
    donor.email || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function DonorCombobox({
  donors = [],
  value = "",
  onChange,
  disabled = false,
  allowInactiveSelected = false,
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef(null);

  const normalizedSearch = search.trim().toLowerCase();
  const normalizedPhoneSearch = normalizeDonorPhone(search);
  const normalizedInstagramSearch = normalizeInstagramUsername(search);

  const selectedDonor = useMemo(
    () => donors.find((donor) => String(donor.id) === String(value)) || null,
    [donors, value],
  );

  const selectedSecondaryText = selectedDonor
    ? donorSecondaryText(selectedDonor)
    : "";

  const filteredDonors = useMemo(() => {
    if (!normalizedSearch && !normalizedPhoneSearch && !normalizedInstagramSearch) {
      return donors;
    }

    return donors.filter((donor) => {
      const text = buildDonorSearchText(donor);
      return text.includes(normalizedSearch)
        || (
          normalizedPhoneSearch
          && normalizeDonorPhone(donor.telefono).includes(normalizedPhoneSearch)
        )
        || (
          normalizedInstagramSearch
          && normalizeInstagramUsername(donor.usuarioInstagram).includes(normalizedInstagramSearch)
        );
    });
  }, [donors, normalizedInstagramSearch, normalizedPhoneSearch, normalizedSearch]);

  useEffect(() => {
    if (isOpen) searchInputRef.current?.focus();
  }, [isOpen]);

  function toggleOptions() {
    setIsOpen((current) => {
      const next = !current;
      if (!next) setSearch("");
      return next;
    });
  }

  function selectDonor(nextValue) {
    onChange(nextValue);
    setSearch("");
    setIsOpen(false);
  }

  return (
    <div className={`donor-combobox ${isOpen ? "donor-combobox-open" : ""}`}>
      <button
        type="button"
        className="donor-combobox-trigger"
        onClick={toggleOptions}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="donor-combobox-trigger-copy" aria-live="polite">
          <strong>
            {selectedDonor?.nombreCompleto || selectedDonor?.nombre || "Donación anónima"}
          </strong>
          {selectedSecondaryText ? <small>{selectedSecondaryText}</small> : null}
        </span>
        <ChevronDown
          className="donor-combobox-chevron"
          size={18}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div className="donor-combobox-panel">
          <label className="donor-combobox-search">
            
            <Search size={17} aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearch("");
                  setIsOpen(false);
                }
              }}
              placeholder="Buscar donante"
              disabled={disabled}
            />
          </label>

          <div
            className="donor-combobox-options"
            role="listbox"
            aria-label="Donantes disponibles"
          >
            <button
              type="button"
              className={`donor-combobox-option ${!value ? "donor-combobox-option-selected" : ""}`}
              onClick={() => selectDonor("")}
              disabled={disabled}
              role="option"
              aria-selected={!value}
            >
              <span className="donor-combobox-option-copy">
                <strong>Donación anónima</strong>
              </span>
              {!value ? <Check size={17} aria-hidden="true" /> : null}
            </button>

            {filteredDonors.map((donor) => {
              const selected = String(donor.id) === String(value);
              const inactiveBlocked = !donor.activo && !(selected && allowInactiveSelected);
              const secondaryText = donorSecondaryText(donor);

              return (
                <button
                  key={donor.id}
                  type="button"
                  className={`donor-combobox-option ${selected ? "donor-combobox-option-selected" : ""}`}
                  onClick={() => selectDonor(String(donor.id))}
                  disabled={disabled || inactiveBlocked}
                  role="option"
                  aria-selected={selected}
                  title={inactiveBlocked
                    ? "El donante está inactivo y no puede usarse en una asociación nueva."
                    : undefined}
                >
                  <span className="donor-combobox-option-copy">
                    <strong>{donor.nombreCompleto || donor.nombre}</strong>
                  </span>

                  <span className="donor-combobox-option-meta">
                    {!donor.activo ? <em>Inactivo</em> : null}
                    {selected ? <Check size={17} aria-hidden="true" /> : null}
                  </span>
                </button>
              );
            })}

            {filteredDonors.length === 0 ? (
              <p className="donor-combobox-empty">Sin resultados</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
