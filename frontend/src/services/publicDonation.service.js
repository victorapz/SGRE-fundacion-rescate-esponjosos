import api from "../api/axios";
import { getPublicDonationErrorMessage } from "../utils/publicDonation";
import { buildPublicRequestConfig } from "../utils/publicSite";

const CREATE_ORDER_PATH = "/paypal/donations/create-order";
const CAPTURE_ORDER_PATH = "/paypal/donations/capture-order";
const DEFAULT_CURRENCY = "USD";

function buildPublicDonationError(error, fallbackMessage) {
  return new Error(getPublicDonationErrorMessage(error, fallbackMessage));
}

export async function createPayPalDonationOrder({
  monto_bruto,
  anonymous = false,
  descripcion = "Donacion unica",
  moneda = DEFAULT_CURRENCY,
}) {
  try {
    const response = await api.post(
      CREATE_ORDER_PATH,
      {
        monto_bruto,
        moneda,
        descripcion,
        anonymous: Boolean(anonymous),
      },
      buildPublicRequestConfig(),
    );

    return response?.data?.data || null;
  } catch (error) {
    throw buildPublicDonationError(error, "No pudimos crear la orden PayPal.");
  }
}

export async function capturePayPalDonationOrder(paypalOrderId) {
  try {
    const response = await api.post(
      CAPTURE_ORDER_PATH,
      {
        paypal_order_id: paypalOrderId,
      },
      buildPublicRequestConfig(),
    );

    return response?.data?.data || null;
  } catch (error) {
    throw buildPublicDonationError(error, "No pudimos confirmar la donacion en este momento.");
  }
}
