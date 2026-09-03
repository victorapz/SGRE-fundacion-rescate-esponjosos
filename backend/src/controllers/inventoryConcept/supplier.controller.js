"use strict";

import {
  supplierCreateValidation,
  supplierQueryValidation,
  supplierUpdateBodyValidation,
} from "../../validations/supplier.validation.js";
import {
  createSupplierService,
  deleteSupplierService,
  getSupplierService,
  getSuppliersService,
  updateSupplierService,
} from "../../services/inventoryConcept/supplier.service.js";
import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../../handlers/responseHandlers.js";

export async function createSupplier(req, res) {
  try {
    const { error } = supplierCreateValidation.validate(req.body);

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [supplier, supplierError] = await createSupplierService(req.body);

    if (supplierError) {
      return handleErrorClient(res, 400, supplierError);
    }

    return handleSuccess(res, 201, "Proveedor creado correctamente", supplier);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSupplier(req, res) {
  try {
    const { proveedor_id } = req.query;
    const { error } = supplierQueryValidation.validate({ proveedor_id });

    if (error) {
      return handleErrorClient(res, 400, "Error de validacion", error.message);
    }

    const [supplier, supplierError] = await getSupplierService({ proveedor_id });

    if (supplierError) {
      return handleErrorClient(res, 404, supplierError);
    }

    return handleSuccess(res, 200, "Proveedor encontrado", supplier);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function getSuppliers(req, res) {
  try {
    const [suppliers, supplierError] = await getSuppliersService();

    if (supplierError) {
      return handleErrorClient(res, 404, supplierError);
    }

    return suppliers.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Proveedores encontrados", suppliers);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function updateSupplier(req, res) {
  try {
    const { proveedor_id } = req.query;
    const { error: queryError } = supplierQueryValidation.validate({ proveedor_id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = supplierUpdateBodyValidation.validate(req.body);

    if (bodyError) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en los datos enviados",
        bodyError.message,
      );
    }

    const [supplier, supplierError] = await updateSupplierService(
      { proveedor_id },
      req.body,
    );

    if (supplierError) {
      return handleErrorClient(
        res,
        400,
        "Error modificando el proveedor",
        supplierError,
      );
    }

    return handleSuccess(res, 200, "Proveedor modificado correctamente", supplier);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}

export async function deleteSupplier(req, res) {
  try {
    const { proveedor_id } = req.query;
    const { error } = supplierQueryValidation.validate({ proveedor_id });

    if (error) {
      return handleErrorClient(
        res,
        400,
        "Error de validacion en la consulta",
        error.message,
      );
    }

    const [supplier, supplierError] = await deleteSupplierService({ proveedor_id });

    if (supplierError) {
      return handleErrorClient(
        res,
        400,
        "Error desactivando el proveedor",
        supplierError,
      );
    }

    return handleSuccess(res, 200, "Proveedor desactivado correctamente", supplier);
  } catch (error) {
    return handleErrorServer(res, 500, error.message);
  }
}
