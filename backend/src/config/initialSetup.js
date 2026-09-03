"use strict";

import { AppDataSource } from "./configDb.js";
import {
  SEED_ADMIN_PASSWORD,
  SEED_AREA_MANAGER_PASSWORD,
  SEED_DEMO_DATA,
  SEED_INVENTORY_LOCAL_PASSWORD,
  SEED_VOLUNTEER_PASSWORD,
} from "./configEnv.js";
import { seedDemoData } from "./initialSetup.demo.js";
import { encryptPassword } from "../helpers/bcrypt.helper.js";
import Area from "../entities/area.entity.js";
import VetClinic from "../entities/animalConcept/vet_clinic.entity.js";
import Veterinarian from "../entities/animalConcept/veterinarian.entity.js";
import VeterinarianClinic from "../entities/animalConcept/veterinarian_clinic.entity.js";
import Comuna from "../entities/comuna.entity.js";
import PaymentProvider from "../entities/financialConcept/payment_provider.entity.js";
import TransactionCategory from "../entities/financialConcept/transaction_category.entity.js";
import Donation from "../entities/inventoryConcept/donation.entity.js";
import DonationItem from "../entities/inventoryConcept/donation_item.entity.js";
import InventoryItem from "../entities/inventoryConcept/item.entity.js";
import ItemCategory from "../entities/inventoryConcept/item_category.entity.js";
import Purchase from "../entities/inventoryConcept/purchase.entity.js";
import PurchaseDetail from "../entities/inventoryConcept/purchase_detail.entity.js";
import Supplier from "../entities/inventoryConcept/supplier.entity.js";
import UnitOfMeasure from "../entities/inventoryConcept/unit_of_measure.entity.js";
import Location, { LOCATION_TYPES } from "../entities/inventoryConcept/location.entity.js";
import Permission from "../entities/RolesConcept/permission.entity.js";
import Role from "../entities/RolesConcept/role.entity.js";
import RolePermission from "../entities/RolesConcept/role_permission.entity.js";
import Region from "../entities/region.entity.js";
import User from "../entities/user.entity.js";
import UserArea from "../entities/user_area.entity.js";
import UserRole from "../entities/user_role.entity.js";
import {
  buildUserLocationName,
  createManagedLocation,
  locationRelations,
  updateManagedLocation,
} from "../services/location.shared.js";
import {
  createMovementRecord,
  createOrIncreaseExistence,
} from "../services/inventoryConcept/inventory.shared.js";
import { CHILE_COMMUNES, CHILE_REGIONS } from "./chileTerritorialData.js";

const PASSWORD_FIELD = "contrase\u00f1a";

const DEFAULT_ADMIN = {
  rut: "10.101.010-1",
  nombre: "Administrador",
  apellido: "General",
  email: "admin@example.com",
  telefono: "+56912345678",
  passwordEnvKey: "SEED_ADMIN_PASSWORD",
  passwordFromEnv: SEED_ADMIN_PASSWORD,
  roleName: "Administrador",
  areaKey: "ADM",
  updatePasswordIfExists: false,
  location: {
    direccion: "Av. Principal 100",
    regionKey: "RM",
    comunaName: "Santiago",
    observaciones: "Administrador principal",
  },
};

const DEFAULT_REGION_KEY = "RM";

const DEFAULT_AREAS = [
  {
    nombre: "Administracion",
    clave: "ADM",
    descripcion: "Area administrativa principal",
    activo: true,
  },
  {
    nombre: "Contenido",
    clave: "CON",
    descripcion: "Area de contenido y coordinacion operativa",
    activo: true,
  },
];

const DEFAULT_MANUAL_LOCATIONS = [
  {
    tipo: LOCATION_TYPES.BODEGA,
    nombre_ubicacion: "Bodega Central",
    direccion: "Av. Bodega 123",
    regionKey: "RM",
    comunaName: "Santiago",
    observaciones: "Ubicacion base de inventario",
    activo: true,
  },
];

const DEFAULT_VET_CLINIC = {
  nombre: "Clinica Veterinaria Prueba",
  activo: true,
  location: {
    direccion: "Av. Clinica 321",
    regionKey: "RM",
    comunaName: "Providencia",
    observaciones: "Clinica semilla",
  },
};

const DEFAULT_VETERINARIAN = {
  nombre: "Veterinario",
  apellido: "Prueba",
  email: "veterinario.prueba@example.com",
  telefono: "+56944444444",
  activo: true,
};

const DEFAULT_SUPPLIER = {
  nombre: "Proveedor Inventario Demo",
  telefono: "+56988888888",
  email: "proveedor.inventario@example.com",
  observaciones: "Proveedor demo para QA de inventario",
  activo: true,
  location: null,
};

const DEFAULT_ROLES = {
  ADMIN: "Administrador",
  VOLUNTEER: "Voluntario",
  AREA_MANAGER: "Encargado de Area",
  INVENTORY_LOCAL: "Inventario Local",
};

const INVENTORY_LOCAL_PERMISSIONS = [
  "inventory:read:location",
  "inventory:movement:create:location",
  "inventory:location:read",
];

const COMMON_VOLUNTEER_READ_PERMISSIONS = [
  "home:notice:read",
  "home:event:read",
  "animals:animal:read",
  "animals:animal_profile:read",
  "animals:animal_diets:read",
  "animals:intake_record:read",
  "animals:exam:read",
  "animals:procedure:read",
  "animals:vet_checkup:read",
  "animals:vet_clinic:read",
  "animals:veterinarian:read",
  "animals:hospitalization:read",
  "animals:foster_home:read",
  "animals:foster_assignment:read",
  "home:shift:read",
  "home:shift:register",
  "home:shift:cancel",
  "home:shift:registrations:self:read",
];

const ROLE_PERMISSION_MAP = {
  [DEFAULT_ROLES.ADMIN]: null,
  [DEFAULT_ROLES.VOLUNTEER]: [
    ...COMMON_VOLUNTEER_READ_PERMISSIONS,
    "home:task:read:mine",
    "home:task:update:status:mine",
    "home:task:history:read:mine",
    "home:task:comment:mine",
  ],
  [DEFAULT_ROLES.AREA_MANAGER]: [
    ...COMMON_VOLUNTEER_READ_PERMISSIONS,
    "home:task:read:mine",
    "home:task:read:area",
    "home:task:create:area",
    "home:task:update:area",
    "home:task:update:status:mine",
    "home:task:assign:area",
    "home:task:history:read:area",
    "home:task:history:read:mine",
    "home:task:comment:area",
    "home:task:comment:mine",
  ],
  [DEFAULT_ROLES.INVENTORY_LOCAL]: INVENTORY_LOCAL_PERMISSIONS,
};

const SEEDED_USERS = [
  DEFAULT_ADMIN,
  {
    rut: "11.111.111-1",
    nombre: "Voluntario",
    apellido: "Prueba",
    email: "voluntario.prueba@example.com",
    telefono: "+56911111111",
    passwordEnvKey: "SEED_VOLUNTEER_PASSWORD",
    passwordFromEnv: SEED_VOLUNTEER_PASSWORD,
    roleName: DEFAULT_ROLES.VOLUNTEER,
    areaKey: "CON",
    updatePasswordIfExists: true,
    location: {
      direccion: "Pasaje Foster 123",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Voluntario semilla",
    },
  },
  {
    rut: "22.222.222-2",
    nombre: "Encargado",
    apellido: "Area",
    email: "encargado.area@example.com",
    telefono: "+56922222222",
    passwordEnvKey: "SEED_AREA_MANAGER_PASSWORD",
    passwordFromEnv: SEED_AREA_MANAGER_PASSWORD,
    roleName: DEFAULT_ROLES.AREA_MANAGER,
    areaKey: "CON",
    updatePasswordIfExists: true,
    location: {
      direccion: "Oficina Central 50",
      regionKey: "RM",
      comunaName: "Providencia",
      observaciones: "Encargado de area",
    },
  },
  {
    rut: "23.333.333-3",
    nombre: "Voluntario",
    apellido: "Prueba2",
    email: "voluntario.prueba2@example.com",
    telefono: "+56933333331",
    passwordEnvKey: "SEED_VOLUNTEER_PASSWORD",
    passwordFromEnv: SEED_VOLUNTEER_PASSWORD,
    roleName: DEFAULT_ROLES.VOLUNTEER,
    areaKey: "CON",
    updatePasswordIfExists: true,
    location: {
      direccion: "Casa Compartida 45",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Comparte ubicacion con otro voluntario para pruebas de hogar temporal",
    },
  },
  {
    rut: "33.333.333-3",
    nombre: "Voluntario",
    apellido: "Prueba3",
    email: "voluntario.prueba3@example.com",
    telefono: "+56933333333",
    passwordEnvKey: "SEED_VOLUNTEER_PASSWORD",
    passwordFromEnv: SEED_VOLUNTEER_PASSWORD,
    roleName: DEFAULT_ROLES.VOLUNTEER,
    areaKey: "CON",
    updatePasswordIfExists: true,
    location: {
      direccion: "Casa Compartida 45",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Comparte ubicacion con otro voluntario para pruebas de hogar temporal",
    },
  },
  {
    rut: "44.444.444-4",
    nombre: "Inventario",
    apellido: "Local",
    email: "inventario.local@example.com",
    telefono: "+56944444445",
    passwordEnvKey: "SEED_INVENTORY_LOCAL_PASSWORD",
    passwordFromEnv: SEED_INVENTORY_LOCAL_PASSWORD,
    roleName: DEFAULT_ROLES.INVENTORY_LOCAL,
    areaKey: "ADM",
    updatePasswordIfExists: true,
    location: {
      direccion: "Bodega Local QA 12",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Usuario semilla para validar scope local de inventario",
    },
  },
];

const DEFAULT_ITEM_CATEGORIES = [
  { nombre_categoria: "Alimento", activo: true },
  { nombre_categoria: "Medicamento", activo: true },
  { nombre_categoria: "Higiene", activo: true },
  { nombre_categoria: "Equipamiento", activo: true },
  { nombre_categoria: "Accesorios", activo: true },
  { nombre_categoria: "Limpieza", activo: true },
  { nombre_categoria: "Otro", activo: true },
];

const DEFAULT_UNITS_OF_MEASURE = [
  { nombre: "kg", descripcion: "Kilogramo", activo: true },
  { nombre: "unidad", descripcion: "Unidad individual", activo: true },
  { nombre: "litro", descripcion: "Litro", activo: true },
  { nombre: "bolsa", descripcion: "Bolsa", activo: true },
  { nombre: "caja", descripcion: "Caja", activo: true },
  { nombre: "frasco", descripcion: "Frasco", activo: true },
  { nombre: "sobre", descripcion: "Sobre", activo: true },
];

const DEFAULT_TRANSACTION_CATEGORIES = [
  { clave: "DONACION_UNICA", nombre: "Donacion unica", tipo: "INGRESO" },
  { clave: "APADRINAMIENTO", nombre: "Apadrinamiento", tipo: "INGRESO" },
  { clave: "OTRO_INGRESO", nombre: "Otro ingreso", tipo: "INGRESO" },
  { clave: "DEVOLUCION_DONACION", nombre: "Devolucion donacion", tipo: "EGRESO" },
  { clave: "REVERSA_PAYPAL", nombre: "Reversa PayPal", tipo: "EGRESO" },
  { clave: "GASTO_VETERINARIO", nombre: "Gasto veterinario", tipo: "EGRESO" },
  { clave: "COMPRA_ALIMENTO", nombre: "Compra alimento", tipo: "EGRESO" },
  { clave: "COMPRA_MEDICAMENTO", nombre: "Compra medicamento", tipo: "EGRESO" },
  { clave: "COMPRA_INSUMOS", nombre: "Compra insumos", tipo: "EGRESO" },
  { clave: "TRANSPORTE", nombre: "Transporte", tipo: "EGRESO" },
  { clave: "SERVICIOS", nombre: "Servicios", tipo: "EGRESO" },
  { clave: "OTRO_EGRESO", nombre: "Otro egreso", tipo: "EGRESO" },
].map((item) => ({
  ...item,
  descripcion: null,
  activo: true,
  es_sistema: true,
}));

const DEFAULT_PAYMENT_PROVIDERS = [
  { clave: "MANUAL", nombre: "Manual", tipo: "MANUAL" },
  { clave: "TRANSFERENCIA", nombre: "Transferencia", tipo: "TRANSFERENCIA" },
  { clave: "EFECTIVO", nombre: "Efectivo", tipo: "EFECTIVO" },
  { clave: "PAYPAL", nombre: "PayPal", tipo: "PAYPAL" },
].map((item) => ({
  ...item,
  activo: true,
  metadata_publica: null,
}));

const FORBIDDEN_PROVIDER_METADATA_KEYS = new Set([
  "client_secret",
  "access_token",
  "password",
  "signature",
]);

const DEFAULT_INVENTORY_ITEMS = [
  {
    nombre: "Pellet de conejo",
    descripcion: "Alimento base para conejos en stock demo",
    stock_minimo: 5,
    categoria: "Alimento",
    unidad: "kg",
    activo: true,
  },
  {
    nombre: "Pellet de hámster",
    descripcion: "Alimento base para hámster en hogares temporales",
    stock_minimo: 2,
    categoria: "Alimento",
    unidad: "kg",
    activo: true,
  },
  {
    nombre: "Viruta sanitaria",
    descripcion: "Insumo higiénico absorbente para pequeños mamíferos",
    stock_minimo: 3,
    categoria: "Higiene",
    unidad: "bolsa",
    activo: true,
  },
  {
    nombre: "Heno",
    descripcion: "Forraje seco de apoyo para conejos y cobayas",
    stock_minimo: 4,
    categoria: "Alimento",
    unidad: "kg",
    activo: true,
  },
  {
    nombre: "Jaula transportadora",
    descripcion: "Jaula para traslados y derivaciones seguras",
    stock_minimo: 1,
    categoria: "Equipamiento",
    unidad: "unidad",
    activo: true,
  },
  {
    nombre: "Bebedero",
    descripcion: "Accesorio para suministro de agua",
    stock_minimo: 2,
    categoria: "Accesorios",
    unidad: "unidad",
    activo: true,
  },
  {
    nombre: "Comedero",
    descripcion: "Accesorio para suministro de alimento",
    stock_minimo: 2,
    categoria: "Accesorios",
    unidad: "unidad",
    activo: true,
  },
  {
    nombre: "Medicamento antiparasitario",
    descripcion: "Tratamiento antiparasitario de uso frecuente",
    stock_minimo: 2,
    categoria: "Medicamento",
    unidad: "frasco",
    activo: true,
  },
  {
    nombre: "Suero fisiológico",
    descripcion: "Solución estéril para limpieza y apoyo clínico",
    stock_minimo: 1,
    categoria: "Medicamento",
    unidad: "litro",
    activo: true,
  },
  {
    nombre: "Desinfectante",
    descripcion: "Insumo de limpieza para sanitización de espacios y accesorios",
    stock_minimo: 2,
    categoria: "Limpieza",
    unidad: "litro",
    activo: true,
  },
];

const DEFAULT_INITIAL_LOADS = [
  {
    itemName: "Pellet de conejo",
    manualLocationName: "Bodega Central",
    cantidad: 12.5,
    condicion: "NUEVO",
    observaciones: "Seed QA: Carga inicial Bodega Central",
  },
  {
    itemName: "Viruta sanitaria",
    userEmail: "inventario.local@example.com",
    cantidad: 4,
    condicion: "NUEVO",
    observaciones: "Seed QA: Carga inicial Inventario Local",
  },
];

const DEFAULT_DEMO_DONATION = {
  motivo_donacion: "Donacion demo inventario QA",
  punto_encuentro: "Recepcion fundacion",
  fecha_registro: "2026-06-05",
  observaciones: "Seed QA: Donacion pendiente para recepcion manual",
  itemName: "Medicamento de prueba",
  cantidad: 3,
  condicion: "NUEVO",
  condiciones_almacenamiento: "Mantener en lugar fresco y seco",
  receivingUserEmail: DEFAULT_ADMIN.email,
};

const DEFAULT_DEMO_PURCHASE = {
  fecha_compra: "2026-06-05",
  monto_total: 25000,
  descripcion: "Compra demo inventario QA",
  observaciones: "Seed QA: Compra pendiente para recepcion manual",
  supplierName: DEFAULT_SUPPLIER.nombre,
  registeredByEmail: DEFAULT_ADMIN.email,
  itemName: "Jaula transportadora",
  cantidad: 1,
  precio_unitario: 25000,
  subtotal: 25000,
  condicion: "NUEVO",
  condiciones_almacenamiento: "Mantener en lugar seco",
};

const DEFAULT_PERMISSIONS = [
  "settings:read",
  "configuration:region:read",
  "configuration:region:create",
  "configuration:region:update",
  "configuration:region:deactivate",
  "configuration:commune:read",
  "configuration:commune:create",
  "configuration:commune:update",
  "configuration:commune:deactivate",
  "configuration:area:read",
  "configuration:area:create",
  "configuration:area:update",
  "configuration:area:deactivate",
  "users:user:read",
  "users:user:create",
  "users:user:update",
  "users:user:delete",
  "users:user_password:reset",
  "users:user_role:assign",
  "users:user_area:assign",
  "role:read",
  "role:create",
  "role:update",
  "role:delete",
  "home:notice:read",
  "home:notice:create",
  "home:notice:update",
  "home:notice:delete",
  "home:event:read",
  "home:event:create",
  "home:event:update",
  "home:event:delete",
  "home:shift:read",
  "home:shift:create",
  "home:shift:update",
  "home:shift:delete",
  "home:shift:register",
  "home:shift:cancel",
  "home:shift:registrations:read",
  "home:shift:registrations:self:read",
  "home:task:read:any",
  "home:task:read:area",
  "home:task:read:mine",
  "home:task:create:any",
  "home:task:create:area",
  "home:task:update:any",
  "home:task:update:area",
  "home:task:update:status:mine",
  "home:task:assign:any",
  "home:task:assign:area",
  "home:task:delete:any",
  "home:task:delete:area",
  "home:task:delete:mine",
  "home:task:history:read:any",
  "home:task:history:read:area",
  "home:task:history:read:mine",
  "home:task:comment:any",
  "home:task:comment:area",
  "home:task:comment:mine",
  "animals:animal:read",
  "animals:animal:create",
  "animals:animal:update",
  "animals:animal:delete",
  "animals:animal_diets:read",
  "animals:animal_diets:create",
  "animals:animal_diets:update",
  "animals:animal_diets:delete",
  "animals:animal_profile:read",
  "animals:animal_profile:create",
  "animals:animal_profile:update",
  "animals:animal_profile:delete",
  "animals:exam:read",
  "animals:exam:create",
  "animals:exam:update",
  "animals:exam:delete",
  "animals:foster_assignment:read",
  "animals:foster_assignment:create",
  "animals:foster_assignment:update",
  "animals:foster_assignment:delete",
  "animals:foster_home:read",
  "animals:foster_home:create",
  "animals:foster_home:update",
  "animals:foster_home:delete",
  "animals:foster_home_observation:read",
  "animals:hospitalization:read",
  "animals:hospitalization:create",
  "animals:hospitalization:update",
  "animals:hospitalization:delete",
  "animals:intake_record:read",
  "animals:intake_record:create",
  "animals:intake_record:update",
  "animals:intake_record:delete",
  "animals:procedure:read",
  "animals:procedure:create",
  "animals:procedure:update",
  "animals:procedure:delete",
  "animals:vet_checkup:read",
  "animals:vet_checkup:create",
  "animals:vet_checkup:update",
  "animals:vet_checkup:delete",
  "animals:vet_clinic:read",
  "animals:vet_clinic:create",
  "animals:vet_clinic:update",
  "animals:vet_clinic:delete",
  "animals:veterinarian:read",
  "animals:veterinarian:create",
  "animals:veterinarian:update",
  "animals:veterinarian:delete",
  "inventory:donation:read",
  "inventory:donation:create",
  "inventory:donation:update",
  "inventory:donation:delete",
  "inventory:donation_item:read",
  "inventory:donation_item:create",
  "inventory:donation_item:update",
  "inventory:donation_item:delete",
  "inventory:inventory_adjustment:read",
  "inventory:inventory_adjustment:create",
  "inventory:inventory_adjustment:update",
  "inventory:inventory_adjustment:delete",
  "inventory:inventory_adjustment_detail:read",
  "inventory:inventory_adjustment_detail:create",
  "inventory:inventory_adjustment_detail:update",
  "inventory:inventory_adjustment_detail:delete",
  "inventory:inventory_existence:read",
  "inventory:inventory_movement:read",
  "inventory:inventory_movement:create",
  "inventory:inventory_movement:update",
  "inventory:inventory_movement:delete",
  "inventory:purchase:read",
  "inventory:purchase:create",
  "inventory:purchase:update",
  "inventory:purchase:delete",
  "inventory:purchase_detail:read",
  "inventory:purchase_detail:create",
  "inventory:purchase_detail:update",
  "inventory:purchase_detail:delete",
  "inventory:read:any",
  "inventory:read:location",
  "inventory:movement:create:any",
  "inventory:movement:create:location",
  "inventory:adjustment:create:any",
  "inventory:adjustment:create:location",
  "inventory:adjustment:apply:any",
  "inventory:initial_load:create",
  "inventory:catalog:read",
  "inventory:catalog:create",
  "inventory:catalog:update",
  "inventory:catalog:delete",
  "inventory:item_category:read",
  "inventory:item_category:create",
  "inventory:item_category:update",
  "inventory:item_category:delete",
  "inventory:item:read",
  "inventory:item:create",
  "inventory:item:update",
  "inventory:item:delete",
  "inventory:location:read",
  "inventory:location:create",
  "inventory:location:update",
  "inventory:location:delete",
  "inventory:stock_count:read",
  "inventory:stock_count:create",
  "inventory:stock_count:create:location",
  "inventory:stock_count:update",
  "inventory:stock_count:delete",
  "inventory:stock_count_detail:read",
  "inventory:stock_count_detail:create",
  "inventory:stock_count_detail:update",
  "inventory:stock_count_detail:delete",
  "inventory:supplier:read",
  "inventory:supplier:create",
  "inventory:supplier:update",
  "inventory:supplier:delete",
  "inventory:report:export",
  "inventory:unit_of_measure:read",
  "inventory:unit_of_measure:create",
  "inventory:unit_of_measure:update",
  "inventory:unit_of_measure:delete",
  "accounting:dashboard:read",
  "accounting:transaction:read",
  "accounting:transaction:create",
  "accounting:transaction:update",
  "accounting:transaction:cancel",
  "accounting:payable:read",
  "accounting:payable:create",
  "accounting:payable:update",
  "accounting:payable:pay",
  "accounting:payable:cancel",
  "accounting:donor:read",
  "accounting:donor:create",
  "accounting:donor:update",
  "accounting:sponsor:read",
  "accounting:sponsor:create",
  "accounting:sponsor:update",
  "accounting:sponsorship:read",
  "accounting:sponsorship:create",
  "accounting:sponsorship:update",
  "accounting:sponsorship:cancel",
  "accounting:sponsorship_plan:read",
  "accounting:sponsorship_plan:create",
  "accounting:sponsorship_plan:update",
  "accounting:sponsorship_plan:delete",
  "accounting:subscription:read",
  "accounting:subscription:cancel",
  "accounting:subscription:sync",
  "accounting:subscription_payment:read",
  "accounting:subscription_payment:create",
  "accounting:category:read",
  "accounting:category:create",
  "accounting:category:update",
  "accounting:category:delete",
  "accounting:payment_provider:read",
  "accounting:payment_provider:create",
  "accounting:payment_provider:update",
  "accounting:payment_provider:delete",
  "accounting:payment_order:read",
  "accounting:payment_order:create",
  "accounting:payment_order:update",
  "accounting:payment_order:cancel",
  "accounting:report:export",
  "accounting:public_report:read",
  "accounting:public_report:create",
  "accounting:public_report:publish",
  "accounting:public_report:archive",
  "accounting:donation_refund:create",
  "accounting:webhook:read",
  "accounting:webhook:retry",
  "files:file:read",
  "files:file:upload",
  "files:file:download",
  "files:file:delete",
  "files:file:update",
  "files:file:manage_visibility",
  "files:animal:read",
  "files:animal:upload",
  "files:animal:delete",
  "files:animal_clinical:read",
  "files:animal_clinical:upload",
  "files:animal_clinical:delete",
  "files:user_document:read",
  "files:user_document:upload",
  "files:user_document:delete",
  "files:accounting:read",
  "files:accounting:upload",
  "files:accounting:delete",
];

async function ensureRegion(regionRepository, regionData) {
  let region = await regionRepository.findOne({
    where: { clave: regionData.clave },
  });

  if (!region) {
    return regionRepository.save(
      regionRepository.create({
        ...regionData,
        activo: regionData.activo !== undefined ? Boolean(regionData.activo) : true,
        orden: Number(regionData.orden || 0),
      }),
    );
  }

  let changed = false;
  if (region.nombre !== regionData.nombre) {
    region.nombre = regionData.nombre;
    changed = true;
  }
  if (region.activo !== (regionData.activo !== undefined ? Boolean(regionData.activo) : true)) {
    region.activo = regionData.activo !== undefined ? Boolean(regionData.activo) : true;
    changed = true;
  }
  if (Number(region.orden || 0) !== Number(regionData.orden || 0)) {
    region.orden = Number(regionData.orden || 0);
    changed = true;
  }

  return changed ? regionRepository.save(region) : region;
}

async function ensureComuna(comunaRepository, region, comunaData) {
  let comuna = await comunaRepository.findOne({
    where: {
      nombre: comunaData.nombre,
      region: { id_region: region.id_region },
    },
    relations: {
      region: true,
    },
  });

  if (!comuna) {
    comuna = await comunaRepository.save(
      comunaRepository.create({
        nombre: comunaData.nombre,
        codigo: comunaData.codigo || null,
        activo: true,
        region: { id_region: region.id_region },
      }),
    );
    return comuna;
  }

  let changed = false;
  if ((comuna.codigo || null) !== (comunaData.codigo || null)) {
    comuna.codigo = comunaData.codigo || null;
    changed = true;
  }
  if (!comuna.activo) {
    comuna.activo = true;
    changed = true;
  }

  return changed ? comunaRepository.save(comuna) : comuna;
}

async function ensureArea(areaRepository, areaData) {
  let area = await areaRepository.findOne({
    where: { clave: areaData.clave },
  });

  if (!area) {
    return areaRepository.save(areaRepository.create(areaData));
  }

  let changed = false;
  if (area.nombre !== areaData.nombre) {
    area.nombre = areaData.nombre;
    changed = true;
  }
  if (area.descripcion !== areaData.descripcion) {
    area.descripcion = areaData.descripcion;
    changed = true;
  }
  if (area.activo !== Boolean(areaData.activo ?? true)) {
    area.activo = Boolean(areaData.activo ?? true);
    changed = true;
  }

  return changed ? areaRepository.save(area) : area;
}

async function ensureItemCategory(itemCategoryRepository, categoryData) {
  let category = await itemCategoryRepository.findOne({
    where: { nombre_categoria: categoryData.nombre_categoria },
  });

  if (!category) {
    return itemCategoryRepository.save(itemCategoryRepository.create(categoryData));
  }

  let changed = false;
  if (category.activo !== Boolean(categoryData.activo)) {
    category.activo = Boolean(categoryData.activo);
    changed = true;
  }

  return changed ? itemCategoryRepository.save(category) : category;
}

async function ensureUnitOfMeasure(unitRepository, unitData) {
  let unit = await unitRepository.findOne({
    where: { nombre: unitData.nombre },
  });

  if (!unit) {
    return unitRepository.save(unitRepository.create(unitData));
  }

  let changed = false;
  if (unit.descripcion !== unitData.descripcion) {
    unit.descripcion = unitData.descripcion;
    changed = true;
  }
  if (unit.activo !== Boolean(unitData.activo)) {
    unit.activo = Boolean(unitData.activo);
    changed = true;
  }

  return changed ? unitRepository.save(unit) : unit;
}

async function ensureTransactionCategory(transactionCategoryRepository, categoryData) {
  let category = await transactionCategoryRepository.findOne({
    where: { clave: categoryData.clave },
    relations: {
      categoria_padre: true,
    },
  });

  if (!category) {
    return transactionCategoryRepository.save(
      transactionCategoryRepository.create({
        clave: categoryData.clave,
        nombre: categoryData.nombre,
        tipo: categoryData.tipo,
        descripcion: categoryData.descripcion ?? null,
        activo: Boolean(categoryData.activo),
        es_sistema: Boolean(categoryData.es_sistema),
        categoria_padre: null,
      }),
    );
  }

  let changed = false;
  for (const field of ["nombre", "tipo", "descripcion"]) {
    if ((category[field] ?? null) !== (categoryData[field] ?? null)) {
      category[field] = categoryData[field] ?? null;
      changed = true;
    }
  }
  if (category.activo !== Boolean(categoryData.activo)) {
    category.activo = Boolean(categoryData.activo);
    changed = true;
  }
  if (category.es_sistema !== Boolean(categoryData.es_sistema)) {
    category.es_sistema = Boolean(categoryData.es_sistema);
    changed = true;
  }

  return changed ? transactionCategoryRepository.save(category) : category;
}

async function ensurePaymentProvider(paymentProviderRepository, providerData) {
  const stack = [providerData.metadata_publica ?? null];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") continue;

    for (const [key, value] of Object.entries(current)) {
      if (FORBIDDEN_PROVIDER_METADATA_KEYS.has(String(key).trim().toLowerCase())) {
        throw new Error(
          "Los seeds de proveedores de pago no pueden incluir client_secret, access_token, password ni signature.",
        );
      }

      if (Array.isArray(value)) {
        stack.push(...value);
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  let provider = await paymentProviderRepository.findOne({
    where: { clave: providerData.clave },
  });

  if (!provider) {
    return paymentProviderRepository.save(
      paymentProviderRepository.create({
        clave: providerData.clave,
        nombre: providerData.nombre,
        tipo: providerData.tipo,
        activo: Boolean(providerData.activo),
        metadata_publica: providerData.metadata_publica ?? null,
      }),
    );
  }

  let changed = false;
  for (const field of ["nombre", "tipo"]) {
    if ((provider[field] ?? null) !== (providerData[field] ?? null)) {
      provider[field] = providerData[field] ?? null;
      changed = true;
    }
  }
  if (provider.activo !== Boolean(providerData.activo)) {
    provider.activo = Boolean(providerData.activo);
    changed = true;
  }
  const nextMetadata = providerData.metadata_publica ?? null;
  if (JSON.stringify(provider.metadata_publica ?? null) !== JSON.stringify(nextMetadata)) {
    provider.metadata_publica = nextMetadata;
    changed = true;
  }

  return changed ? paymentProviderRepository.save(provider) : provider;
}

async function ensureInventoryItem({
  itemRepository,
  category,
  unit,
  itemData,
}) {
  let item = await itemRepository.findOne({
    where: { nombre: itemData.nombre },
    relations: {
      categoria: true,
      unidad_medida: true,
    },
  });

  if (!item) {
    return itemRepository.save(
      itemRepository.create({
        nombre: itemData.nombre,
        descripcion: itemData.descripcion,
        stock_minimo: itemData.stock_minimo,
        activo: itemData.activo,
        categoria: { categoria_item_id: category.categoria_item_id },
        unidad_medida: { unidad_medida_id: unit.unidad_medida_id },
      }),
    );
  }

  let changed = false;
  for (const field of ["nombre", "descripcion"]) {
    if (item[field] !== itemData[field]) {
      item[field] = itemData[field];
      changed = true;
    }
  }
  if (Number(item.stock_minimo ?? 0) !== Number(itemData.stock_minimo ?? 0)) {
    item.stock_minimo = itemData.stock_minimo;
    changed = true;
  }
  if (item.activo !== Boolean(itemData.activo)) {
    item.activo = Boolean(itemData.activo);
    changed = true;
  }
  if (Number(item.categoria?.categoria_item_id) !== Number(category.categoria_item_id)) {
    item.categoria = { categoria_item_id: category.categoria_item_id };
    changed = true;
  }
  if (Number(item.unidad_medida?.unidad_medida_id) !== Number(unit.unidad_medida_id)) {
    item.unidad_medida = { unidad_medida_id: unit.unidad_medida_id };
    changed = true;
  }

  return changed ? itemRepository.save(item) : item;
}

async function ensurePermissions(permissionRepository, permissionNames = []) {
  const permissionsByName = new Map();

  for (const permissionName of permissionNames) {
    let permission = await permissionRepository.findOne({
      where: { nombre: permissionName },
    });

    if (!permission) {
      permission = await permissionRepository.save(
        permissionRepository.create({ nombre: permissionName }),
      );
    }

    permissionsByName.set(permissionName, permission);
  }

  return permissionsByName;
}

async function ensureRole(roleRepository, roleName) {
  let role = await roleRepository.findOne({
    where: { nombre: roleName },
  });

  if (!role) {
    role = await roleRepository.save(roleRepository.create({ nombre: roleName }));
  }

  return role;
}

async function syncRolePermissions({
  role,
  permissionNames,
  permissionsByName,
  rolePermissionRepository,
}) {
  const effectivePermissionNames = permissionNames ?? Array.from(permissionsByName.keys());
  const currentLinks = await rolePermissionRepository.find({
    where: { role: { id_rol: role.id_rol } },
    relations: { permission: true },
  });

  const currentNames = new Set(
    currentLinks.map((rolePermission) => rolePermission.permission?.nombre).filter(Boolean),
  );
  const targetNames = new Set(effectivePermissionNames);

  for (const link of currentLinks) {
    const permissionName = link.permission?.nombre;
    if (permissionName && !targetNames.has(permissionName)) {
      await rolePermissionRepository.remove(link);
    }
  }

  for (const permissionName of targetNames) {
    if (currentNames.has(permissionName)) continue;

    const permission = permissionsByName.get(permissionName);
    if (!permission) {
      throw new Error(`No se encontro el permiso requerido: ${permissionName}`);
    }

    await rolePermissionRepository.save(
      rolePermissionRepository.create({
        role: { id_rol: role.id_rol },
        permission: { id_permiso: permission.id_permiso },
      }),
    );
  }
}

async function ensureLocation({
  manager,
  tipo,
  nombre_ubicacion,
  direccion,
  regionId,
  comunaId,
  observaciones = null,
  activo = true,
  existingLocationId = null,
}) {
  if (existingLocationId) {
    return updateManagedLocation(manager, existingLocationId, {
      tipo,
      nombre_ubicacion,
      direccion,
      region_id: regionId,
      comuna_id: comunaId,
      observaciones,
      activo,
    });
  }

  return createManagedLocation(manager, {
    tipo,
    nombre_ubicacion,
    direccion,
    region_id: regionId,
    comuna_id: comunaId,
    observaciones,
    activo,
  });
}

async function ensureManualLocation({
  manager,
  locationRepository,
  region,
  comuna,
  data,
}) {
  let location = await locationRepository.findOne({
    where: {
      tipo: data.tipo,
      nombre_ubicacion: data.nombre_ubicacion,
    },
    relations: locationRelations,
  });

  location = await ensureLocation({
    manager,
    tipo: data.tipo,
    nombre_ubicacion: data.nombre_ubicacion,
    direccion: data.direccion,
    regionId: region.id_region,
    comunaId: comuna.id_comuna,
    observaciones: data.observaciones,
    activo: data.activo,
    existingLocationId: location?.ubicacion_id || null,
  });

  return location;
}

async function ensureVetClinic({
  manager,
  vetClinicRepository,
  region,
  comuna,
  clinicData,
}) {
  let clinic = await vetClinicRepository.findOne({
    where: { nombre: clinicData.nombre },
    relations: {
      location: locationRelations,
    },
  });

  const location = await ensureLocation({
    manager,
    tipo: LOCATION_TYPES.CLINICA,
    nombre_ubicacion: clinicData.nombre,
    direccion: clinicData.location.direccion,
    regionId: region.id_region,
    comunaId: comuna.id_comuna,
    observaciones: clinicData.location.observaciones,
    activo: clinicData.activo,
    existingLocationId: clinic?.location?.ubicacion_id || null,
  });

  if (!clinic) {
    clinic = await vetClinicRepository.save(
      vetClinicRepository.create({
        nombre: clinicData.nombre,
        activo: clinicData.activo,
        location: { ubicacion_id: location.ubicacion_id },
      }),
    );
    return clinic;
  }

  let changed = false;
  if (clinic.nombre !== clinicData.nombre) {
    clinic.nombre = clinicData.nombre;
    changed = true;
  }
  if (clinic.activo !== clinicData.activo) {
    clinic.activo = clinicData.activo;
    changed = true;
  }
  if (Number(clinic.location?.ubicacion_id) !== Number(location.ubicacion_id)) {
    clinic.location = { ubicacion_id: location.ubicacion_id };
    changed = true;
  }

  return changed ? vetClinicRepository.save(clinic) : clinic;
}

async function ensureVeterinarian({
  veterinarianRepository,
  veterinarianData,
  clinic,
}) {
  let veterinarian = await veterinarianRepository.findOne({
    where: { email: veterinarianData.email },
    relations: { clinic: true },
  });

  if (!veterinarian) {
    return veterinarianRepository.save(
      veterinarianRepository.create({
        nombre: veterinarianData.nombre,
        apellido: veterinarianData.apellido,
        email: veterinarianData.email,
        telefono: veterinarianData.telefono,
        activo: veterinarianData.activo,
        clinic: { id_clinica: clinic.id_clinica },
      }),
    );
  }

  let changed = false;
  for (const field of ["nombre", "apellido", "email", "telefono"]) {
    if (veterinarian[field] !== veterinarianData[field]) {
      veterinarian[field] = veterinarianData[field];
      changed = true;
    }
  }
  if (veterinarian.activo !== veterinarianData.activo) {
    veterinarian.activo = veterinarianData.activo;
    changed = true;
  }
  if (Number(veterinarian.clinic?.id_clinica) !== Number(clinic.id_clinica)) {
    veterinarian.clinic = { id_clinica: clinic.id_clinica };
    changed = true;
  }

  return changed ? veterinarianRepository.save(veterinarian) : veterinarian;
}

async function backfillVeterinarianClinicMemberships({
  manager,
  veterinarianRepository,
  veterinarianClinicRepository,
}) {
  const veterinarians = await veterinarianRepository.find({
    relations: {
      clinic: true,
    },
  });

  for (const veterinarian of veterinarians) {
    const legacyClinicId = Number(veterinarian?.clinic?.id_clinica || 0);

    if (!legacyClinicId) {
      continue;
    }

    const existingRelation = await veterinarianClinicRepository.findOne({
      where: {
        veterinarian: { id_veterinario: Number(veterinarian.id_veterinario) },
        clinic: { id_clinica: legacyClinicId },
      },
    });

    if (!existingRelation) {
      await veterinarianClinicRepository.save(
        veterinarianClinicRepository.create({
          veterinarian: { id_veterinario: Number(veterinarian.id_veterinario) },
          clinic: { id_clinica: legacyClinicId },
        }),
      );
    }
  }
}

async function ensureSupplier({
  manager,
  supplierRepository,
  region,
  comuna,
  supplierData,
}) {
  let supplier = await supplierRepository.findOne({
    where: { nombre: supplierData.nombre },
    relations: {
      location: locationRelations,
    },
  });

  const location = supplierData.location
    ? await ensureLocation({
        manager,
        tipo: LOCATION_TYPES.PROVEEDOR,
        nombre_ubicacion: supplierData.nombre,
        direccion: supplierData.location.direccion,
        regionId: region.id_region,
        comunaId: comuna.id_comuna,
        observaciones: supplierData.location.observaciones,
        activo: supplierData.activo,
        existingLocationId: supplier?.location?.ubicacion_id || null,
      })
    : null;

  if (!supplier) {
    return supplierRepository.save(
      supplierRepository.create({
        nombre: supplierData.nombre,
        telefono: supplierData.telefono,
        email: supplierData.email,
        observaciones: supplierData.observaciones,
        activo: supplierData.activo,
        location: location ? { ubicacion_id: location.ubicacion_id } : null,
      }),
    );
  }

  let changed = false;
  for (const field of ["nombre", "telefono", "email", "observaciones"]) {
    if (supplier[field] !== supplierData[field]) {
      supplier[field] = supplierData[field];
      changed = true;
    }
  }
  if (supplier.activo !== supplierData.activo) {
    supplier.activo = supplierData.activo;
    changed = true;
  }
  if (location && Number(supplier.location?.ubicacion_id) !== Number(location.ubicacion_id)) {
    supplier.location = { ubicacion_id: location.ubicacion_id };
    changed = true;
  }
  if (!location && supplier.location) {
    supplier.location = null;
    changed = true;
  }

  return changed ? supplierRepository.save(supplier) : supplier;
}

function resolveSeedUserPassword(userData) {
  const envPassword = String(userData.passwordFromEnv || "").trim();
  if (envPassword) return envPassword;

  const directPassword = String(userData.password || "").trim();
  if (directPassword) return directPassword;

  const missingUserLabel = userData.email || userData.rut || userData.telefono || "sin-identificador";
  throw new Error(
    `Falta configurar ${userData.passwordEnvKey || "SEED_USER_PASSWORD"} para el usuario semilla ${missingUserLabel}.`,
  );
}

async function ensureUser({
  manager,
  userRepository,
  userAreaRepository,
  userRoleRepository,
  role,
  area,
  region,
  comuna,
  userData,
}) {
  let user = await userRepository.findOne({
    where: [
      { email: userData.email },
      { rut: userData.rut },
      { telefono: userData.telefono },
    ],
    relations: {
      UserRole: { role: true },
      UserArea: { area: true },
      area: true,
      location: locationRelations,
    },
  });

  const hashedPassword = user && !userData.updatePasswordIfExists
    ? null
    : await encryptPassword(resolveSeedUserPassword(userData));

  const location = await ensureLocation({
    manager,
    tipo: LOCATION_TYPES.PERSONA,
    nombre_ubicacion: buildUserLocationName(userData),
    direccion: userData.location.direccion,
    regionId: region.id_region,
    comunaId: comuna.id_comuna,
    observaciones: userData.location.observaciones,
    activo: true,
    existingLocationId: user?.location?.ubicacion_id || null,
  });

  if (!user) {
    user = await userRepository.save(
      userRepository.create({
        rut: userData.rut,
        nombre: userData.nombre,
        apellido: userData.apellido,
        email: userData.email,
        telefono: userData.telefono,
        [PASSWORD_FIELD]: hashedPassword,
        activo: true,
        location: { ubicacion_id: location.ubicacion_id },
        area: { id_area: area.id_area },
      }),
    );
  } else {
    let changed = false;
    for (const field of ["nombre", "apellido", "email", "rut", "telefono"]) {
      if (user[field] !== userData[field]) {
        user[field] = userData[field];
        changed = true;
      }
    }
    if (!user.activo) {
      user.activo = true;
      changed = true;
    }
    if (hashedPassword) {
      user[PASSWORD_FIELD] = hashedPassword;
      changed = true;
    }
    if (Number(user.area?.id_area) !== Number(area.id_area)) {
      user.area = { id_area: area.id_area };
      changed = true;
    }
    if (Number(user.location?.ubicacion_id) !== Number(location.ubicacion_id)) {
      user.location = { ubicacion_id: location.ubicacion_id };
      changed = true;
    }

    if (changed) {
      user = await userRepository.save(user);
    }
  }

  const roleAlreadyAssigned = (user.UserRole || []).some(
    (userRole) => Number(userRole.role?.id_rol) === Number(role.id_rol),
  );

  if (!roleAlreadyAssigned) {
    await userRoleRepository.save(
      userRoleRepository.create({
        user: { id_usuario: user.id_usuario },
        role: { id_rol: role.id_rol },
      }),
    );
  }

  const areaAlreadyAssigned = (user.UserArea || []).some(
    (userArea) => Number(userArea.area?.id_area) === Number(area.id_area),
  );

  if (!areaAlreadyAssigned) {
    await userAreaRepository.save(
      userAreaRepository.create({
        user: { id_usuario: user.id_usuario },
        area: { id_area: area.id_area },
      }),
    );
  }

  user.location = location;
  user.area = area;

  return user;
}

async function ensureSeedInitialLoad({
  manager,
  movementRepository,
  item,
  location,
  performedBy,
  seedData,
}) {
  const existingMovement = await movementRepository.findOne({
    where: {
      tipo_movimiento: "ENTRADA",
      referencia_tipo: "CARGA_INICIAL",
      observaciones: seedData.observaciones,
      item: { item_id: item.item_id },
      destination_location: { ubicacion_id: location.ubicacion_id },
    },
    relations: {
      item: true,
      destination_location: true,
    },
  });

  if (existingMovement) {
    return existingMovement;
  }

  const existence = await createOrIncreaseExistence(manager, {
    item_id: item.item_id,
    location_id: location.ubicacion_id,
    cantidad_actual: seedData.cantidad,
    fecha_vencimiento: null,
    fecha_apertura: null,
    condicion: seedData.condicion,
    origen_tipo: "CARGA_INICIAL",
    origen_id: null,
    observaciones: seedData.observaciones,
  });

  return createMovementRecord(manager, {
    tipo_movimiento: "ENTRADA",
    cantidad: seedData.cantidad,
    fecha_movimiento: DEFAULT_DEMO_DONATION.fecha_registro,
    referencia_tipo: "CARGA_INICIAL",
    referencia_id: existence.existencia_id,
    observaciones: seedData.observaciones,
    item_id: item.item_id,
    source_location_id: null,
    destination_location_id: location.ubicacion_id,
    performed_by_id: performedBy.id_usuario,
  });
}

async function ensureDemoDonation({
  donationRepository,
  donationItemRepository,
  region,
  receivingUser,
  item,
}) {
  let donation = await donationRepository.findOne({
    where: { motivo_donacion: DEFAULT_DEMO_DONATION.motivo_donacion },
    relations: {
      donation_item: {
        item: true,
      },
    },
  });

  if (!donation) {
    donation = await donationRepository.save(
      donationRepository.create({
        motivo_donacion: DEFAULT_DEMO_DONATION.motivo_donacion,
        punto_encuentro: DEFAULT_DEMO_DONATION.punto_encuentro,
        fecha_registro: DEFAULT_DEMO_DONATION.fecha_registro,
        estado: "PENDIENTE",
        observaciones: DEFAULT_DEMO_DONATION.observaciones,
        region: { id_region: region.id_region },
        receiving_user: { id_usuario: receivingUser.id_usuario },
      }),
    );
  }

  const existingLine = await donationItemRepository.findOne({
    where: {
      donation: { donacion_id: donation.donacion_id },
      item: { item_id: item.item_id },
    },
    relations: {
      donation: true,
      item: true,
    },
  });

  if (!existingLine) {
    await donationItemRepository.save(
      donationItemRepository.create({
        donation: { donacion_id: donation.donacion_id },
        item: { item_id: item.item_id },
        cantidad: DEFAULT_DEMO_DONATION.cantidad,
        cantidad_recepcionada: 0,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condiciones_almacenamiento: DEFAULT_DEMO_DONATION.condiciones_almacenamiento,
        condicion: DEFAULT_DEMO_DONATION.condicion,
        estado: "PENDIENTE",
        observaciones: DEFAULT_DEMO_DONATION.observaciones,
        recepcion_parcial_definitiva: false,
      }),
    );
  }

  return donationRepository.findOne({
    where: { donacion_id: donation.donacion_id },
    relations: {
      donation_item: {
        item: true,
      },
      region: true,
      receiving_user: true,
    },
  });
}

async function ensureDemoPurchase({
  purchaseRepository,
  purchaseDetailRepository,
  supplier,
  registeredBy,
  item,
}) {
  let purchase = await purchaseRepository.findOne({
    where: { descripcion: DEFAULT_DEMO_PURCHASE.descripcion },
    relations: {
      purchase_details: {
        item: true,
      },
      supplier: true,
    },
  });

  if (!purchase) {
      purchase = await purchaseRepository.save(
        purchaseRepository.create({
          fecha_compra: DEFAULT_DEMO_PURCHASE.fecha_compra,
          fecha_recepcion: null,
          estado: "CONFIRMADA",
          monto_total: DEFAULT_DEMO_PURCHASE.monto_total,
          descripcion: DEFAULT_DEMO_PURCHASE.descripcion,
          observaciones: DEFAULT_DEMO_PURCHASE.observaciones,
          supplier: { proveedor_id: supplier.proveedor_id },
          registered_by: { id_usuario: registeredBy.id_usuario },
        transaction: null,
      }),
    );
  }

  const existingDetail = await purchaseDetailRepository.findOne({
    where: {
      purchase: { compra_id: purchase.compra_id },
      item: { item_id: item.item_id },
    },
    relations: {
      purchase: true,
      item: true,
    },
  });

  if (!existingDetail) {
    await purchaseDetailRepository.save(
      purchaseDetailRepository.create({
        purchase: { compra_id: purchase.compra_id },
        item: { item_id: item.item_id },
        cantidad: DEFAULT_DEMO_PURCHASE.cantidad,
        cantidad_recepcionada: 0,
        precio_unitario: DEFAULT_DEMO_PURCHASE.precio_unitario,
        subtotal: DEFAULT_DEMO_PURCHASE.subtotal,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condiciones_almacenamiento: DEFAULT_DEMO_PURCHASE.condiciones_almacenamiento,
        condicion: DEFAULT_DEMO_PURCHASE.condicion,
        estado: "PENDIENTE",
        observaciones: DEFAULT_DEMO_PURCHASE.observaciones,
        recepcion_parcial_definitiva: false,
      }),
    );
  }

  return purchaseRepository.findOne({
    where: { compra_id: purchase.compra_id },
    relations: {
      purchase_details: {
        item: true,
      },
      supplier: {
        location: locationRelations,
      },
      registered_by: true,
      transaction: true,
    },
  });
}

export async function initialSetup() {
  if (!AppDataSource.isInitialized) {
    throw new Error("AppDataSource no esta inicializado. Debes ejecutar connectDB() antes de initialSetup().");
  }

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const manager = queryRunner.manager;
    const regionRepository = manager.getRepository(Region);
    const comunaRepository = manager.getRepository(Comuna);
    const areaRepository = manager.getRepository(Area);
    const roleRepository = manager.getRepository(Role);
    const permissionRepository = manager.getRepository(Permission);
    const rolePermissionRepository = manager.getRepository(RolePermission);
    const userRepository = manager.getRepository(User);
    const userAreaRepository = manager.getRepository(UserArea);
    const userRoleRepository = manager.getRepository(UserRole);
    const transactionCategoryRepository = manager.getRepository(TransactionCategory);
    const paymentProviderRepository = manager.getRepository(PaymentProvider);
    const locationRepository = manager.getRepository(Location);
    const vetClinicRepository = manager.getRepository(VetClinic);
    const veterinarianRepository = manager.getRepository(Veterinarian);
    const veterinarianClinicRepository = manager.getRepository(VeterinarianClinic);
    const supplierRepository = manager.getRepository(Supplier);
    const itemCategoryRepository = manager.getRepository(ItemCategory);
    const unitRepository = manager.getRepository(UnitOfMeasure);
    const itemRepository = manager.getRepository(InventoryItem);
    const movementRepository = manager.getRepository("InventoryMovement");
    const donationRepository = manager.getRepository(Donation);
    const donationItemRepository = manager.getRepository(DonationItem);
    const purchaseRepository = manager.getRepository(Purchase);
    const purchaseDetailRepository = manager.getRepository(PurchaseDetail);

    const regionsByKey = new Map();
    for (const regionData of CHILE_REGIONS) {
      const seededRegion = await ensureRegion(regionRepository, regionData);
      regionsByKey.set(seededRegion.clave, seededRegion);
    }

    const region = regionsByKey.get(DEFAULT_REGION_KEY);

    const comunasByKey = new Map();
    for (const comunaData of CHILE_COMMUNES) {
      const regionForComuna = regionsByKey.get(comunaData.regionKey);
      const comuna = await ensureComuna(comunaRepository, regionForComuna, comunaData);
      comunasByKey.set(`${comunaData.regionKey}:${comunaData.nombre}`, comuna);
    }

    const areasByKey = new Map();
    for (const areaData of DEFAULT_AREAS) {
      const area = await ensureArea(areaRepository, areaData);
      areasByKey.set(areaData.clave, area);
    }

    const manualLocationsByName = new Map();
    for (const manualLocation of DEFAULT_MANUAL_LOCATIONS) {
      const locationRegion = regionsByKey.get(manualLocation.regionKey);
      const locationComuna = comunasByKey.get(
        `${manualLocation.regionKey}:${manualLocation.comunaName}`,
      );
      const location = await ensureManualLocation({
        manager,
        locationRepository,
        region: locationRegion,
        comuna: locationComuna,
        data: manualLocation,
      });
      manualLocationsByName.set(location.nombre_ubicacion, location);
    }

    const permissionsByName = await ensurePermissions(permissionRepository, DEFAULT_PERMISSIONS);
    const rolesByName = new Map();

    const transactionCategoriesByKey = new Map();
    for (const transactionCategoryData of DEFAULT_TRANSACTION_CATEGORIES) {
      const transactionCategory = await ensureTransactionCategory(
        transactionCategoryRepository,
        transactionCategoryData,
      );
      transactionCategoriesByKey.set(transactionCategory.clave, transactionCategory);
    }

    const paymentProvidersByKey = new Map();
    for (const paymentProviderData of DEFAULT_PAYMENT_PROVIDERS) {
      const paymentProvider = await ensurePaymentProvider(
        paymentProviderRepository,
        paymentProviderData,
      );
      paymentProvidersByKey.set(paymentProvider.clave, paymentProvider);
    }

    for (const roleName of Object.values(DEFAULT_ROLES)) {
      const role = await ensureRole(roleRepository, roleName);
      rolesByName.set(roleName, role);

      await syncRolePermissions({
        role,
        permissionNames: ROLE_PERMISSION_MAP[roleName],
        permissionsByName,
        rolePermissionRepository,
      });
    }

    const seededUsers = [];
    const usersByEmail = new Map();
    for (const userData of SEEDED_USERS) {
      const role = rolesByName.get(userData.roleName);
      const area = areasByKey.get(userData.areaKey);
      const userRegion = regionsByKey.get(userData.location.regionKey);
      const userComuna = comunasByKey.get(
        `${userData.location.regionKey}:${userData.location.comunaName}`,
      );

      if (!role) {
        throw new Error(`No se encontro el rol configurado para el usuario ${userData.email}`);
      }
      if (!area) {
        throw new Error(`No se encontro el area configurada para el usuario ${userData.email}`);
      }

      const user = await ensureUser({
        manager,
        userRepository,
        userAreaRepository,
        userRoleRepository,
        role,
        area,
        region: userRegion,
        comuna: userComuna,
        userData,
      });

      seededUsers.push({
        id: user.id_usuario,
        email: user.email,
        role: role.nombre,
        area: area.nombre,
        locationId: user.location?.ubicacion_id || null,
      });
      usersByEmail.set(user.email, user);
    }

    const vetClinicRegion = regionsByKey.get(DEFAULT_VET_CLINIC.location.regionKey);
    const vetClinicComuna = comunasByKey.get(
      `${DEFAULT_VET_CLINIC.location.regionKey}:${DEFAULT_VET_CLINIC.location.comunaName}`,
    );
    const vetClinic = await ensureVetClinic({
      manager,
      vetClinicRepository,
      region: vetClinicRegion,
      comuna: vetClinicComuna,
      clinicData: DEFAULT_VET_CLINIC,
    });

    const veterinarian = await ensureVeterinarian({
      veterinarianRepository,
      veterinarianData: DEFAULT_VETERINARIAN,
      clinic: vetClinic,
    });

    await backfillVeterinarianClinicMemberships({
      manager,
      veterinarianRepository,
      veterinarianClinicRepository,
    });

    const supplier = await ensureSupplier({
      manager,
      supplierRepository,
      region: DEFAULT_SUPPLIER.location
        ? regionsByKey.get(DEFAULT_SUPPLIER.location.regionKey)
        : region,
      comuna: DEFAULT_SUPPLIER.location
        ? comunasByKey.get(
            `${DEFAULT_SUPPLIER.location.regionKey}:${DEFAULT_SUPPLIER.location.comunaName}`,
          )
        : Array.from(comunasByKey.values())[0],
      supplierData: DEFAULT_SUPPLIER,
    });

    const categoriesByName = new Map();
    for (const categoryData of DEFAULT_ITEM_CATEGORIES) {
      const category = await ensureItemCategory(itemCategoryRepository, categoryData);
      categoriesByName.set(category.nombre_categoria, category);
    }

    const unitsByName = new Map();
    for (const unitData of DEFAULT_UNITS_OF_MEASURE) {
      const unit = await ensureUnitOfMeasure(unitRepository, unitData);
      unitsByName.set(unit.nombre, unit);
    }

    const itemsByName = new Map();
    for (const itemData of DEFAULT_INVENTORY_ITEMS) {
      const category = categoriesByName.get(itemData.categoria);
      const unit = unitsByName.get(itemData.unidad);
      if (!category || !unit) {
        throw new Error(`No se pudo resolver categoria/unidad para el item ${itemData.nombre}`);
      }
      const item = await ensureInventoryItem({
        itemRepository,
        category,
        unit,
        itemData,
      });
      itemsByName.set(item.nombre, item);
    }

    const adminUser = usersByEmail.get(DEFAULT_ADMIN.email);
    const localInventoryUser = usersByEmail.get("inventario.local@example.com");
    if (!adminUser || !localInventoryUser) {
      throw new Error("No se pudieron resolver los usuarios semilla de inventario.");
    }

    let seededInitialLoads = [];
    let demoDonation = null;
    let demoPurchase = null;
    let demoSeedSummary = null;

    if (SEED_DEMO_DATA) {
      demoSeedSummary = await seedDemoData({
        manager,
        helpers: {
          ensureRegion,
          ensureComuna,
          ensureRole,
          syncRolePermissions,
          ensureLocation,
          ensureManualLocation,
          ensureSupplier,
          ensureUser,
          ensureSeedInitialLoad,
        },
        maps: {
          regionsByKey,
          comunasByKey,
          areasByKey,
          rolesByName,
          usersByEmail,
          manualLocationsByName,
          categoriesByName,
          unitsByName,
          itemsByName,
        },
        defaults: {
          LOCATION_TYPES,
          DEFAULT_ROLES,
        },
        permissionsByName,
        rolePermissionRepository,
        roleRepository,
      });

      seededInitialLoads = Array.isArray(demoSeedSummary?.inventoryInitialLoads)
        ? demoSeedSummary.inventoryInitialLoads
        : [];

      const donationId = demoSeedSummary?.donations?.[0]?.id || null;
      if (donationId) {
        demoDonation = await donationRepository.findOne({
          where: { donacion_id: donationId },
        });
      }

      const purchaseId = demoSeedSummary?.purchases?.[0]?.id || null;
      if (purchaseId) {
        demoPurchase = await purchaseRepository.findOne({
          where: { compra_id: purchaseId },
        });
      }
    }

    await queryRunner.commitTransaction();

    console.log("Initial setup completado correctamente");

    return {
      regionId: region.id_region,
      comunas: Array.from(comunasByKey.values()).map((item) => ({
        id: item.id_comuna,
        nombre: item.nombre,
      })),
      areas: Array.from(areasByKey.values()).map((area) => ({
        id: area.id_area,
        clave: area.clave,
        nombre: area.nombre,
      })),
      roles: Array.from(rolesByName.values()).map((role) => ({
        id: role.id_rol,
        nombre: role.nombre,
      })),
      permissions: permissionsByName.size,
      users: seededUsers,
      vetClinic: {
        id: vetClinic.id_clinica,
        nombre: vetClinic.nombre,
      },
      veterinarian: {
        id: veterinarian.id_veterinario,
        nombre: veterinarian.nombre,
        apellido: veterinarian.apellido,
        email: veterinarian.email,
        clinicId: vetClinic.id_clinica,
      },
      supplier: {
        id: supplier.proveedor_id,
        nombre: supplier.nombre,
      },
      inventoryCategories: Array.from(categoriesByName.values()).map((categoryItem) => ({
        id: categoryItem.categoria_item_id,
        nombre: categoryItem.nombre_categoria,
      })),
      inventoryUnits: Array.from(unitsByName.values()).map((unitItem) => ({
        id: unitItem.unidad_medida_id,
        nombre: unitItem.nombre,
      })),
      accountingCategories: Array.from(transactionCategoriesByKey.values()).map((categoryItem) => ({
        id: categoryItem.categoria_transaccion_id,
        clave: categoryItem.clave,
        nombre: categoryItem.nombre,
        tipo: categoryItem.tipo,
      })),
      accountingPaymentProviders: Array.from(paymentProvidersByKey.values()).map((providerItem) => ({
        id: providerItem.proveedor_pago_id,
        clave: providerItem.clave,
        nombre: providerItem.nombre,
        tipo: providerItem.tipo,
      })),
      inventoryItems: Array.from(itemsByName.values()).map((itemData) => ({
        id: itemData.item_id,
        nombre: itemData.nombre,
      })),
      inventoryInitialLoads: seededInitialLoads,
      demoSeedEnabled: SEED_DEMO_DATA,
      demoDonation: demoDonation
        ? {
            id: demoDonation.donacion_id,
            motivo: demoDonation.motivo_donacion,
          }
        : null,
      demoPurchase: demoPurchase
        ? {
            id: demoPurchase.compra_id,
            descripcion: demoPurchase.descripcion,
          }
        : null,
      inventoryLocalUser: {
        id: localInventoryUser.id_usuario,
        email: localInventoryUser.email,
        role: DEFAULT_ROLES.INVENTORY_LOCAL,
        locationId: localInventoryUser.location?.ubicacion_id || null,
      },
      demoData: demoSeedSummary,
    };
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Error en initialSetup():", error);
    throw error;
  } finally {
    await queryRunner.release();
  }
}
