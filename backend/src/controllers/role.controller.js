"use strict";

import {
  roleCreateValidation,
  roleQueryValidation,
  roleUpdateBodyValidation,
} from "../validations/role.validation.js";

import {
  createRoleService,
  deleteRoleService,
  getRoleService,
  getRolesService,
  updateRoleService,
} from "../services/role.service.js";

import {
  handleErrorClient,
  handleErrorServer,
  handleSuccess,
} from "../handlers/responseHandlers.js";

export const createRole = async (req, res) => {
    try {
        const { body } = req;

        const { error } = roleCreateValidation.validate(body);

        if (error) return handleErrorClient(res, 400, "Error de validación", error.message);

        const [role, errorRole] = await createRoleService(body);

        if (errorRole) return handleErrorClient(res, 400, errorRole);

        handleSuccess(res, 201, "Rol creado correctamente", role);
        }catch (error) {
        handleErrorServer(res, 500, error.message);
        } 
};


export async function getRole(req, res) {
  try {
    const { id } = req.query;

    const { error } = roleQueryValidation.validate({ id });

    if (error) return handleErrorClient(res, 400, "Error de validación", error.message);

    const [role, errorRole] = await getRoleService({ id });

    if (errorRole) return handleErrorClient(res, 404, errorRole);

    handleSuccess(res, 200, "Rol encontrado", role);
    } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function getRoles(req, res) {
  try {
    const [roles, errorRoles] = await getRolesService();

    if (errorRoles) return handleErrorClient(res, 404, errorRoles);

    roles.length === 0
      ? handleSuccess(res, 204)
      : handleSuccess(res, 200, "Roles encontrados", roles);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function updateRole(req, res) {
  try {
    const { id } = req.query;
    const { body } = req;

    const { error: queryError } = roleQueryValidation.validate({
      id,
    });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const { error: bodyError } = roleUpdateBodyValidation.validate(body);

    if (bodyError)
      return handleErrorClient(
        res,
        400,
        "Error de validación en los datos enviados",
        bodyError.message,
      );

    const [role, roleError] = await updateRoleService({ id }, body);

    if (roleError)
      return handleErrorClient(
        res,
        400,
        "Error modificando el rol",
        roleError,
      );

    handleSuccess(res, 200, "Rol modificado correctamente", role);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}

export async function deleteRole(req, res) {
  try {
    const { id } = req.query;

    const { error: queryError } = roleQueryValidation.validate({ id });

    if (queryError) {
      return handleErrorClient(
        res,
        400,
        "Error de validación en la consulta",
        queryError.message,
      );
    }

    const [roleDelete, errorRoleDelete] = await deleteRoleService({ id });


    if (errorRoleDelete)
      return handleErrorClient(
        res,
        404,
        "Error eliminando el rol",
        errorRoleDelete,
      );

    handleSuccess(res, 200, "Rol eliminado correctamente", roleDelete);
  } catch (error) {
    handleErrorServer(res, 500, error.message);
  }
}