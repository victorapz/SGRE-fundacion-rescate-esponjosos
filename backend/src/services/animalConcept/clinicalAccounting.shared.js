"use strict";

import {
  cancelPayableForSourceIfNoPayments,
  mapPayableIntegrationSummary,
  syncPayableFromSource,
} from "../financialConcept/payableIntegration.service.js";
import {
  mapUserSummary,
  toNumericNumber,
} from "../financialConcept/accounting.shared.js";

const CLINICAL_CATEGORY_KEYS = ["GASTO_VETERINARIO", "OTRO_EGRESO"];

export function ensureClinicalPayableConsistency({
  generaCuentaPorPagar,
  montoTotal,
}) {
  if (Boolean(generaCuentaPorPagar) && !(toNumericNumber(montoTotal, 0) > 0)) {
    throw new Error(
      "Si genera_cuenta_por_pagar es true, monto_total debe ser mayor a 0.",
    );
  }
}

function buildClinicalPayableDescription(record, { eventLabel, idField }) {
  const eventId = Number(record?.[idField]);
  const animalName = record?.animal?.nombre
    ? ` - ${record.animal.nombre}`
    : "";
  const clinicName = record?.clinic?.nombre
    ? ` - ${record.clinic.nombre}`
    : "";

  return `${eventLabel} #${eventId}${animalName}${clinicName}`;
}

export function attachClinicalPayableSummary(record, syncResult) {
  return {
    ...record,
    payable_account: mapPayableIntegrationSummary(syncResult),
  };
}

function sanitizeClinicalUser(user) {
  return mapUserSummary(user);
}

export function sanitizeClinicalRecord(record) {
  if (!record) return null;

  return {
    ...record,
    user: sanitizeClinicalUser(record.user),
  };
}

export function sanitizeClinicalCollection(records = []) {
  return Array.isArray(records) ? records.map(sanitizeClinicalRecord) : [];
}

export async function syncClinicalPayable(
  manager,
  record,
  {
    originType,
    idField,
    eventLabel,
    fechaEmisionField,
  },
  authContext = {},
) {
  ensureClinicalPayableConsistency({
    generaCuentaPorPagar: record?.genera_cuenta_por_pagar,
    montoTotal: record?.monto_total,
  });

  if (!Boolean(record?.genera_cuenta_por_pagar)) {
    const payable = await cancelPayableForSourceIfNoPayments(manager, {
      originType,
      originId: record?.[idField],
      sourceLabel: eventLabel,
      reason: `El evento clinico ${String(eventLabel).toLowerCase()} ya no genera cuenta por pagar.`,
      metadata: {
        source_type: originType,
        source_id: Number(record?.[idField]),
      },
    });

    return {
      payable,
      payment: null,
      transaction: null,
      message: payable
        ? "Cuenta por pagar anulada por sincronizacion con el origen."
        : "No se genero cuenta por pagar para este origen.",
    };
  }

  return syncPayableFromSource(
    manager,
    {
      originType,
      originId: record?.[idField],
      providerType: "VET_CLINIC",
      providerId: record?.clinic?.id_clinica || null,
      categoryKeys: CLINICAL_CATEGORY_KEYS,
      description: buildClinicalPayableDescription(record, {
        eventLabel,
        idField,
      }),
      moneda: record?.moneda || "CLP",
      montoTotal: record?.monto_total,
      fechaEmision: record?.[fechaEmisionField],
      fechaVencimiento: record?.fecha_vencimiento_pago || null,
      metadata: {
        clinical_event: {
          tipo: originType,
          id: Number(record?.[idField]),
          animal_id: record?.animal?.id_animal || null,
          clinic_id: record?.clinic?.id_clinica || null,
          observacion_financiera: record?.observacion_financiera || null,
        },
      },
    },
    authContext,
  );
}
