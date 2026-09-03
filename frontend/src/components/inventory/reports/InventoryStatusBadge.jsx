import { getInventoryStatusMeta } from "../../../utils/inventory-status";

export default function InventoryStatusBadge({ status, className = "" }) {
  const { label, tone } = getInventoryStatusMeta(status);

  return (
    <span
      className={`inventory-badge inventory-badge-${tone} ${className}`.trim()}
      title={label}
    >
      {label}
    </span>
  );
}
