"use strict";

import { In } from "typeorm";
import Role from "../entities/RolesConcept/role.entity.js";
import Permission from "../entities/RolesConcept/permission.entity.js";
import RolePermission from "../entities/RolesConcept/role_permission.entity.js";
import UserRole from "../entities/user_role.entity.js";
import { AppDataSource } from "../config/configDb.js";

const PROTECTED_ROLE_NAMES = ["ADMINISTRADOR", "ADMIN", "SUPER_ADMIN", "SUPERADMIN"];

function isProtectedRole(role) {
	const name = role?.nombre?.trim().toUpperCase();
	return Boolean(name && PROTECTED_ROLE_NAMES.includes(name));
}

function normalizePermissions(rolePermissions = []) {
	return rolePermissions
		.map((rolePermission) => rolePermission.permission)
		.filter(Boolean)
		.map((permission) => ({
			id_permiso: permission.id_permiso,
			nombre: permission.nombre,
		}));
}

function serializeRole(role) {
	if (!role) return null;

	const permisos = normalizePermissions(role.RolePermission || []);

	return {
		id_rol: role.id_rol,
		nombre: role.nombre,
		permisos,
		permisos_ids: permisos.map((permiso) => permiso.id_permiso),
	};
}

function getRoleId(query) {
	const roleId = query?.id ?? query?.id_rol;
	return Number(roleId);
}

function normalizePermissionIds(permisos) {
	if (!Array.isArray(permisos)) {
		return [null, "Los permisos deben ser un listado"];
	}

	const rawIds = permisos.map((permiso) => {
		if (typeof permiso === "number" || typeof permiso === "string") {
			return permiso;
		}

		if (permiso && typeof permiso === "object") {
			return permiso.id_permiso ?? permiso.id ?? null;
		}

		return null;
	});

	const parsedIds = rawIds.map((value) => Number(value));
	const hasInvalidId = parsedIds.some((value) => !Number.isInteger(value) || value <= 0);

	if (hasInvalidId) {
		return [null, "El listado de permisos contiene valores invalidos"];
	}

	const permissionIds = Array.from(new Set(parsedIds));

	if (permissionIds.length === 0) {
		return [null, "Debes seleccionar al menos un permiso"];
	}

	return [permissionIds, null];
}

async function loadRoleWithPermissions(manager, id_rol) {
	return manager.getRepository(Role).findOne({
		where: { id_rol },
		relations: {
			RolePermission: { permission: true },
		},
	});
}

async function replaceRolePermissions(manager, roleFound, permisos) {
	const rolePermissionRepository = manager.getRepository(RolePermission);
	const permissionRepository = manager.getRepository(Permission);

	const [permissionIds, permissionIdsError] = normalizePermissionIds(permisos);
	if (permissionIdsError) {
		throw new Error(permissionIdsError);
	}

	const permissionsFound = await permissionRepository.find({
		where: { id_permiso: In(permissionIds) },
	});

	if (permissionsFound.length !== permissionIds.length) {
		throw new Error("Algunos permisos no existen");
	}

	await rolePermissionRepository.delete({
		role: { id_rol: roleFound.id_rol },
	});

	const nextRolePermissions = permissionsFound.map((permission) =>
		rolePermissionRepository.create({
			role: roleFound,
			permission,
		}),
	);

	if (nextRolePermissions.length > 0) {
		await rolePermissionRepository.save(nextRolePermissions);
	}
}

export async function createRoleService(body) {
	try {
		const { nombre, permisos } = body;

		const createdRole = await AppDataSource.transaction(async (manager) => {
			const roleRepository = manager.getRepository(Role);

			const roleExists = await roleRepository.findOne({
				where: { nombre },
			});

			if (roleExists) {
				throw new Error("El rol ya existe");
			}

			const newRole = await roleRepository.save(roleRepository.create({ nombre }));
			await replaceRolePermissions(manager, newRole, permisos);

			return loadRoleWithPermissions(manager, newRole.id_rol);
		});

		return [serializeRole(createdRole), null];
	} catch (error) {
		console.error("Error al crear rol:", error);
		return [null, error?.message || "Error interno al crear rol"];
	}
}

export async function getRoleService(query) {
	try {
		const id_rol = getRoleId(query);
		const roleRepository = AppDataSource.getRepository(Role);

		if (!Number.isInteger(id_rol) || id_rol <= 0) {
			return [null, "Id de rol invÃ¡lido"];
		}

		const roleFound = await roleRepository.findOne({
			where: { id_rol },
			relations: {
				RolePermission: { permission: true },
			},
		});

		if (!roleFound) return [null, "Rol no encontrado"];

		return [serializeRole(roleFound), null];
	} catch (error) {
		console.error("Error al obtener rol:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function getRolesService() {
	try {
		const roleRepository = AppDataSource.getRepository(Role);
		const roles = await roleRepository.find({
			relations: {
				RolePermission: { permission: true },
			},
		});

		if (!roles || roles.length === 0) return [null, "No hay roles"];

		return [roles.map((role) => serializeRole(role)), null];
	} catch (error) {
		console.error("Error al obtener roles:", error);
		return [null, "Error interno del servidor"];
	}
}

export async function updateRoleService(query, body) {
	try {
		const id_rol = getRoleId(query);

		if (!Number.isInteger(id_rol) || id_rol <= 0) {
			return [null, "Id de rol invÃ¡lido"];
		}

		const updatedRole = await AppDataSource.transaction(async (manager) => {
			const roleRepository = manager.getRepository(Role);

			const roleFound = await roleRepository.findOne({
				where: { id_rol },
			});

			if (!roleFound) {
				throw new Error("Rol no encontrado");
			}

			if (body.nombre && body.nombre !== roleFound.nombre) {
				const roleWithSameName = await roleRepository.findOne({
					where: { nombre: body.nombre },
				});

				if (roleWithSameName && Number(roleWithSameName.id_rol) !== Number(roleFound.id_rol)) {
					throw new Error("Ya existe un rol con ese nombre");
				}

				roleFound.nombre = body.nombre;
			}

			await roleRepository.save(roleFound);

			if (Array.isArray(body.permisos)) {
				if (isProtectedRole(roleFound)) {
					throw new Error("No puedes modificar permisos de un rol protegido");
				}

				await replaceRolePermissions(manager, roleFound, body.permisos);
			}

			return loadRoleWithPermissions(manager, roleFound.id_rol);
		});

		return [serializeRole(updatedRole), null];
	} catch (error) {
		console.error("Error al actualizar rol:", error);
		return [null, error?.message || "Error interno del servidor"];
	}
}

export async function deleteRoleService(query) {
	try {
		const id_rol = getRoleId(query);
		const roleRepository = AppDataSource.getRepository(Role);
		const userRoleRepository = AppDataSource.getRepository(UserRole);

		if (!Number.isInteger(id_rol) || id_rol <= 0) {
			return [null, "Id de rol invÃ¡lido"];
		}

		const roleFound = await roleRepository.findOne({
			where: { id_rol },
		});

		if (!roleFound) return [null, "Rol no encontrado"];

		if (isProtectedRole(roleFound)) {
			return [null, "No se puede eliminar un rol protegido"];
		}

		const assignedUsers = await userRoleRepository.count({
			where: { role: { id_rol: roleFound.id_rol } },
		});

		if (assignedUsers > 0) {
			return [null, "No se puede eliminar este rol porque tiene usuarios asignados"];
		}

		const deletedRole = await roleRepository.remove(roleFound);
		return [deletedRole, null];
	} catch (error) {
		console.error("Error al eliminar rol:", error);
		return [null, "Error interno del servidor"];
	}
}
