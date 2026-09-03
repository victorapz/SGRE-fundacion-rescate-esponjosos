import { Copy, Landmark } from "lucide-react";
import { useMemo, useState } from "react";
import { publicSiteConfig } from "../../config/publicSite.config";
import { buildPublicTransferFields, buildTransferCopyText } from "../../utils/publicSite";

export default function PublicTransferCard() {
  const [copyState, setCopyState] = useState("idle");
  const transferFields = useMemo(
    () => buildPublicTransferFields(publicSiteConfig.foundation.transferData),
    [],
  );

  async function handleCopy() {
    const text = buildTransferCopyText(publicSiteConfig.foundation.transferData);

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 1800);
      }
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  return (
    <section className="public-glass-card public-transfer-card" aria-labelledby="transferencia-title">
      <div className="public-transfer-card__heading">
        <div className="public-transfer-card__icon" aria-hidden="true">
          <Landmark size={22} />
        </div>
        <div>
          <p className="public-section-kicker">Transferencia</p>
          <h3 id="transferencia-title">También puedes colaborar por transferencia</h3>
        </div>
      </div>

      <div className="public-transfer-card__grid">
        {transferFields.map((field) => (
          <div key={field.key} className="public-transfer-card__item">
            <span>{field.label}</span>
            <strong>{field.value}</strong>
          </div>
        ))}
      </div>

      <div className="public-transfer-card__actions">
        <button type="button" className="public-button public-button--secondary" onClick={handleCopy}>
          <Copy size={18} aria-hidden="true" />
          <span>Copiar datos</span>
        </button>
        <p aria-live="polite">
          {copyState === "copied" ? "Datos copiados." : ""}
          {copyState === "error" ? "No fue posible copiar automáticamente." : ""}
        </p>
      </div>
    </section>
  );
}
