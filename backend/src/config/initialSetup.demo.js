"use strict";

import {
  DEMO_SEED_PASSWORD,
  NODE_ENV,
} from "./configEnv.js";
import Animal, {
  EstadoAdopcion,
  EstadoSalud,
  Especies,
  TipoFechaNacimiento,
} from "../entities/animalConcept/animal.entity.js";
import Event from "../entities/event.entity.js";
import Transaction from "../entities/financialConcept/transaction.entity.js";
import FosterAssignment, {
  Estado as FosterAssignmentEstado,
} from "../entities/foster_assignment.entity.js";
import FosterHome from "../entities/foster_home.entity.js";
import FosterHomeAllowedAnimal from "../entities/foster_home_allowed_animals.js";
import FosterHomeMember, {
  FosterHomeMemberRole,
} from "../entities/foster_home_member.entity.js";
import Notice from "../entities/notice.entity.js";
import RegistrationShift from "../entities/registration_shift.js";
import Shift from "../entities/shift.entity.js";
import Task from "../entities/task.entity.js";
import TaskAssignment from "../entities/task_assignment.entity.js";
import Donation from "../entities/inventoryConcept/donation.entity.js";
import DonationItem from "../entities/inventoryConcept/donation_item.entity.js";
import Purchase from "../entities/inventoryConcept/purchase.entity.js";
import PurchaseDetail from "../entities/inventoryConcept/purchase_detail.entity.js";
import { locationRelations } from "../services/location.shared.js";
import {
  createMovementRecord,
  createOrIncreaseExistence,
  recalculateDonationState,
  recalculatePurchaseState,
} from "../services/inventoryConcept/inventory.shared.js";

const DEMO_ROLES = {
  ADMIN_GENERAL: "Administrador General",
  DIRECTIVA: "Directiva",
  FOSTER_HOME: "Hogar Temporal",
  VOLUNTEER: "Voluntario",
};

const DEMO_REGIONS = [
  { clave: "VAL", nombre: "Región de Valparaíso" },
  { clave: "RM", nombre: "Región Metropolitana" },
];

const DEMO_COMUNAS = [
  { regionKey: "VAL", nombre: "Valparaíso" },
  { regionKey: "VAL", nombre: "Viña del Mar" },
  { regionKey: "RM", nombre: "Puente Alto" },
  { regionKey: "RM", nombre: "Maipú" },
  { regionKey: "RM", nombre: "Santiago" },
  { regionKey: "RM", nombre: "La Florida" },
  { regionKey: "RM", nombre: "San Bernardo" },
  { regionKey: "RM", nombre: "Las Condes" },
  { regionKey: "RM", nombre: "Peñalolén" },
  { regionKey: "RM", nombre: "Pudahuel" },
  { regionKey: "RM", nombre: "Quilicura" },
  { regionKey: "RM", nombre: "Ñuñoa" },
  { regionKey: "RM", nombre: "Recoleta" },
  { regionKey: "RM", nombre: "Renca" },
  { regionKey: "RM", nombre: "Providencia" },
  { regionKey: "RM", nombre: "La Pintana" },
  { regionKey: "RM", nombre: "Cerro Navia" },
  { regionKey: "RM", nombre: "Estación Central" },
  { regionKey: "RM", nombre: "El Bosque" },
  { regionKey: "RM", nombre: "Conchalí" },
  { regionKey: "RM", nombre: "La Granja" },
];

const DEMO_USERS = [
  // All identities and addresses below are intentionally fictitious. Built-in
  // passwords are accepted only outside production; production requires
  // DEMO_SEED_PASSWORD when SEED_DEMO_DATA=true.
  {
    key: "adminDemo",
    rut: "55.555.555-5",
    nombre: "Admin",
    apellido: "Demo",
    email: "admin.demo@example.com",
    telefono: "+56955555551",
    password: "Admin1234",
    roleName: DEMO_ROLES.ADMIN_GENERAL,
    areaKey: "ADM",
    location: {
      direccion: "Av. Demo 100",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Administrador demo global",
    },
  },
  {
    key: "directivaDemo",
    rut: "56.666.666-6",
    nombre: "Paula",
    apellido: "Directiva",
    email: "directiva.demo@example.com",
    telefono: "+56955555552",
    password: "Directiva1234",
    roleName: DEMO_ROLES.DIRECTIVA,
    areaKey: "ADM",
    location: {
      direccion: "Avenida Demo 200",
      regionKey: "RM",
      comunaName: "Providencia",
      observaciones: "Usuario demo de directiva",
    },
  },
  {
    key: "htValparaiso",
    rut: "57.777.777-7",
    nombre: "Camila",
    apellido: "Valparaíso",
    email: "ht.valparaiso.demo@example.com",
    telefono: "+56955555553",
    password: "Hogar1234",
    roleName: DEMO_ROLES.FOSTER_HOME,
    areaKey: "CON",
    location: {
      direccion: "Calle Demo 145",
      regionKey: "VAL",
      comunaName: "Valparaíso",
      observaciones: "Hogar temporal demo Valparaíso",
    },
  },
  {
    key: "htVina",
    rut: "58.888.888-8",
    nombre: "Javiera",
    apellido: "Viña",
    email: "ht.vina.demo@example.com",
    telefono: "+56955555554",
    password: "Hogar1234",
    roleName: DEMO_ROLES.FOSTER_HOME,
    areaKey: "CON",
    location: {
      direccion: "Calle Demo 330",
      regionKey: "VAL",
      comunaName: "Viña del Mar",
      observaciones: "Hogar temporal demo Viña del Mar",
    },
  },
  {
    key: "htPuenteAlto",
    rut: "59.999.999-9",
    nombre: "Valentina",
    apellido: "Puente Alto",
    email: "ht.puentealto.demo@example.com",
    telefono: "+56955555555",
    password: "Hogar1234",
    roleName: DEMO_ROLES.FOSTER_HOME,
    areaKey: "CON",
    location: {
      direccion: "Avenida Demo 501",
      regionKey: "RM",
      comunaName: "Puente Alto",
      observaciones: "Hogar temporal demo Puente Alto",
    },
  },
  {
    key: "htSantiago",
    rut: "60.101.010-1",
    nombre: "María",
    apellido: "Santiago",
    email: "ht.santiago.demo@example.com",
    telefono: "+56955555556",
    password: "Hogar1234",
    roleName: DEMO_ROLES.FOSTER_HOME,
    areaKey: "CON",
    location: {
      direccion: "Avenida Demo 777",
      regionKey: "RM",
      comunaName: "Santiago",
      observaciones: "Hogar temporal demo Santiago",
    },
  },
  {
    key: "htLaFlorida",
    rut: "61.202.020-2",
    nombre: "Daniela",
    apellido: "La Florida",
    email: "ht.laflorida.demo@example.com",
    telefono: "+56955555557",
    password: "Hogar1234",
    roleName: DEMO_ROLES.FOSTER_HOME,
    areaKey: "CON",
    location: {
      direccion: "Avenida Demo 1560",
      regionKey: "RM",
      comunaName: "La Florida",
      observaciones: "Hogar temporal demo La Florida",
    },
  },
  {
    key: "volunteerOne",
    rut: "62.303.030-3",
    nombre: "Marcelo",
    apellido: "Voluntario",
    email: "voluntario1.demo@example.com",
    telefono: "+56955555558",
    password: "Voluntario1234",
    roleName: DEMO_ROLES.VOLUNTEER,
    areaKey: "CON",
    location: {
      direccion: "Calle Demo 222",
      regionKey: "RM",
      comunaName: "Providencia",
      observaciones: "Voluntario demo 1",
    },
  },
  {
    key: "volunteerTwo",
    rut: "63.404.040-4",
    nombre: "Sofía",
    apellido: "Voluntaria",
    email: "voluntario2.demo@example.com",
    telefono: "+56955555559",
    password: "Voluntario1234",
    roleName: DEMO_ROLES.VOLUNTEER,
    areaKey: "CON",
    location: {
      direccion: "Avenida Demo 9000",
      regionKey: "RM",
      comunaName: "San Bernardo",
      observaciones: "Voluntario demo 2",
    },
  },
  {
    key: "volunteerThree",
    rut: "64.505.050-5",
    nombre: "Tomás",
    apellido: "Ayuda",
    email: "voluntario3.demo@example.com",
    telefono: "+56955555560",
    password: "Voluntario1234",
    roleName: DEMO_ROLES.VOLUNTEER,
    areaKey: "CON",
    location: {
      direccion: "Avenida Demo 10010",
      regionKey: "RM",
      comunaName: "Las Condes",
      observaciones: "Voluntario demo 3",
    },
  },
];

function resolveDemoPasswordConfig(userData) {
  const envPassword = String(DEMO_SEED_PASSWORD || "").trim();

  if (envPassword) {
    return {
      passwordEnvKey: "DEMO_SEED_PASSWORD",
      passwordFromEnv: envPassword,
    };
  }

  if (NODE_ENV !== "production") {
    return {
      passwordEnvKey: "DEMO_SEED_PASSWORD",
      password: String(userData.password || "").trim(),
      passwordFromEnv: "",
    };
  }

  return {
    passwordEnvKey: "DEMO_SEED_PASSWORD",
    password: "",
    passwordFromEnv: "",
  };
}

const DEMO_FOSTER_HOMES = [
  {
    userKey: "htValparaiso",
    species: Especies.CONEJO,
    capacity: 3,
    observations: "Hogar Temporal Valparaíso - Demo",
  },
  {
    userKey: "htVina",
    species: Especies.HURON,
    capacity: 2,
    observations: "Hogar Temporal Viña del Mar - Demo",
  },
  {
    userKey: "htPuenteAlto",
    species: Especies.COBAYA,
    capacity: 4,
    observations: "Hogar Temporal Puente Alto - Demo",
  },
  {
    userKey: "htSantiago",
    species: Especies.CATITA_AUSTRALIANA,
    capacity: 3,
    observations: "Hogar Temporal Santiago - Demo",
  },
  {
    userKey: "htLaFlorida",
    species: Especies.CHINCHILLA,
    capacity: 2,
    observations: "Hogar Temporal La Florida - Demo",
  },
];

const DEMO_ANIMALS = [
  {
    name: "Benito",
    especie: Especies.CONEJO,
    sexo: "Macho",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "VAL",
    fechaNacimiento: "2024-01-15",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
    fosterUserKey: "htValparaiso",
  },
  {
    name: "Luna",
    especie: Especies.HURON,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.EN_TRATAMIENTO,
    estadoAdopcion: EstadoAdopcion.EN_PROCESO,
    regionKey: "VAL",
    fechaNacimiento: "2023-08-21",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
    fosterUserKey: "htVina",
  },
  {
    name: "Miel",
    especie: Especies.COBAYA,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "RM",
    fechaNacimiento: "2024-04-02",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
    fosterUserKey: "htPuenteAlto",
  },
  {
    name: "Kiwi",
    especie: Especies.CATITA_AUSTRALIANA,
    sexo: "Macho",
    estadoSalud: EstadoSalud.EN_TRATAMIENTO,
    estadoAdopcion: EstadoAdopcion.NO_APTO,
    regionKey: "RM",
    fechaNacimiento: null,
    tipoFechaNacimiento: TipoFechaNacimiento.DESCONOCIDA,
    fosterUserKey: "htSantiago",
  },
  {
    name: "Nube",
    especie: Especies.CHINCHILLA,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "RM",
    fechaNacimiento: "2023-10-18",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
    fosterUserKey: "htLaFlorida",
  },
  {
    name: "Toto",
    especie: Especies.HAMSTER_RUSO,
    sexo: "Macho",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "RM",
    fechaNacimiento: "2025-01-03",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
  },
  {
    name: "Olivia",
    especie: Especies.ERIZO,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.CRITICO,
    estadoAdopcion: EstadoAdopcion.NO_APTO,
    regionKey: "RM",
    fechaNacimiento: null,
    tipoFechaNacimiento: TipoFechaNacimiento.DESCONOCIDA,
  },
  {
    name: "Rocky",
    especie: Especies.TORTUGA,
    sexo: "Macho",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "RM",
    fechaNacimiento: "2020-09-10",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
  },
  {
    name: "Chispa",
    especie: Especies.RATON,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.EN_TRATAMIENTO,
    estadoAdopcion: EstadoAdopcion.EN_PROCESO,
    regionKey: "RM",
    fechaNacimiento: "2025-02-14",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
  },
  {
    name: "Mora",
    especie: Especies.CONEJO,
    sexo: "Hembra",
    estadoSalud: EstadoSalud.SANO,
    estadoAdopcion: EstadoAdopcion.DISPONIBLE,
    regionKey: "RM",
    fechaNacimiento: "2024-11-11",
    tipoFechaNacimiento: TipoFechaNacimiento.ESTIMADA,
  },
];

const DEMO_SHIFT_WEEK_START = "2026-06-01";
const DEMO_SHIFT_TEMPLATES = [
  { title: "Turno mañana", start: "09:00", end: "13:00", capacity: 5 },
  { title: "Turno tarde", start: "14:00", end: "18:00", capacity: 5 },
  { title: "Turno noche", start: "18:00", end: "22:00", capacity: 3 },
];

const DEMO_SHIFT_REGISTRATIONS = [
  { userKey: "volunteerOne", dayOffset: 0, shiftTitle: "Turno mañana", estado: "INSCRITO" },
  { userKey: "volunteerTwo", dayOffset: 2, shiftTitle: "Turno tarde", estado: "PRESENTE" },
  { userKey: "volunteerThree", dayOffset: 4, shiftTitle: "Turno noche", estado: "CANCELADO" },
];

const DEMO_EVENTS = [
  {
    titulo: "Jornada de adopción",
    fecha_inicio: "2026-06-13T10:00:00.000Z",
    fecha_fin: "2026-06-13T17:00:00.000Z",
    todo_el_dia: false,
    categoria: "COMUNITARIO",
    lugar: "Centro comunitario Providencia",
    descripcion: "Recepción de pellet, heno, viruta sanitaria y accesorios para hogares temporales.",
  },
  {
    titulo: "Capacitación de hogares temporales",
    fecha_inicio: "2026-06-18T13:00:00.000Z",
    fecha_fin: "2026-06-20T21:00:00.000Z",
    todo_el_dia: false,
    categoria: "EDUCATIVO",
    lugar: "Sala virtual Fundación",
    descripcion: "Buenas prácticas de cuarentena, administración de medicamentos y control de inventario local.",
  },
  {
    titulo: "Campana de difusion",
    fecha_inicio: "2026-06-22T04:00:00.000Z",
    fecha_fin: "2026-06-26T04:00:00.000Z",
    todo_el_dia: true,
    categoria: "RECAUDACION_FONDOS",
    lugar: "Redes y puntos de informacion",
    descripcion: "Acciones coordinadas de redes sociales, puntos de informacion y seguimiento de postulaciones.",
  },
  {
    titulo: "Reunion institucional mensual",
    fecha_inicio: "2026-06-24T15:00:00.000Z",
    fecha_fin: "2026-06-24T17:00:00.000Z",
    todo_el_dia: false,
    categoria: "INSTITUCIONAL",
    lugar: "Oficina central",
    descripcion: "Revision de avances, coordinacion de areas y definicion de prioridades del mes.",
  },
  {
    titulo: "Feria cultural animalista",
    fecha_inicio: "2026-06-28T14:00:00.000Z",
    fecha_fin: "2026-06-28T21:00:00.000Z",
    todo_el_dia: false,
    categoria: "CULTURAL",
    lugar: "Parque ciudadano",
    descripcion: "Encuentro cultural con stands, talleres y actividades artisticas en torno al bienestar animal.",
  },
];

const DEMO_TASKS = [
  {
    titulo: "Revisar stock de pellet",
    descripcion: "Confirmar stock disponible y programar reposición si baja de mínimo.",
    estado: "pendiente",
    prioridad: "alta",
    fecha_limite: "2026-06-08T18:00:00.000Z",
    areaKey: "ADM",
    createdByKey: "adminDemo",
    assignedToKey: "directivaDemo",
    assignmentState: "pendiente",
  },
  {
    titulo: "Contactar proveedor de heno",
    descripcion: "Confirmar precio actualizado y ventana de despacho para la próxima compra.",
    estado: "en_progreso",
    prioridad: "media",
    fecha_limite: "2026-06-09T19:00:00.000Z",
    areaKey: "ADM",
    createdByKey: "adminDemo",
    assignedToKey: "volunteerOne",
    assignmentState: "en_progreso",
  },
  {
    titulo: "Actualizar planilla de hogares",
    descripcion: "Revisar hogares activos y su capacidad máxima por especie.",
    estado: "pendiente",
    prioridad: "media",
    fecha_limite: "2026-06-10T21:00:00.000Z",
    areaKey: "CON",
    createdByKey: "directivaDemo",
    assignedToKey: "volunteerTwo",
    assignmentState: "pendiente",
  },
  {
    titulo: "Preparar kit de traslado",
    descripcion: "Armar jaula, comedero y bebedero para traslado programado del fin de semana.",
    estado: "completada",
    prioridad: "baja",
    fecha_limite: "2026-06-06T16:00:00.000Z",
    areaKey: "CON",
    createdByKey: "adminDemo",
    assignedToKey: "volunteerThree",
    assignmentState: "completada",
  },
  {
    titulo: "Verificar medicamentos vigentes",
    descripcion: "Revisar vencimientos reales y separar productos próximos a expirar.",
    estado: "pendiente",
    prioridad: "alta",
    fecha_limite: "2026-06-11T17:00:00.000Z",
    areaKey: "ADM",
    createdByKey: "adminDemo",
    assignedToKey: "directivaDemo",
    assignmentState: "pendiente",
  },
];

const DEMO_INITIAL_LOADS = [
  { itemName: "Pellet de conejo", locationRef: { type: "manual", name: "Bodega Central" }, cantidad: 20.5, condicion: "NUEVO", observaciones: "Seed Demo: Bodega Central - Pellet de conejo" },
  { itemName: "Viruta sanitaria", locationRef: { type: "manual", name: "Bodega Central" }, cantidad: 10, condicion: "NUEVO", observaciones: "Seed Demo: Bodega Central - Viruta sanitaria" },
  { itemName: "Heno", locationRef: { type: "manual", name: "Bodega Central" }, cantidad: 15, condicion: "NUEVO", observaciones: "Seed Demo: Bodega Central - Heno" },
  { itemName: "Medicamento antiparasitario", locationRef: { type: "manual", name: "Bodega Central" }, cantidad: 5, condicion: "NUEVO", observaciones: "Seed Demo: Bodega Central - Medicamento antiparasitario" },
  { itemName: "Jaula transportadora", locationRef: { type: "manual", name: "Bodega Central" }, cantidad: 3, condicion: "NUEVO", observaciones: "Seed Demo: Bodega Central - Jaula transportadora" },
  { itemName: "Pellet de conejo", locationRef: { type: "user", key: "htValparaiso" }, cantidad: 5, condicion: "NUEVO", observaciones: "Seed Demo: HT Valparaíso - Pellet de conejo" },
  { itemName: "Viruta sanitaria", locationRef: { type: "user", key: "htValparaiso" }, cantidad: 2, condicion: "NUEVO", observaciones: "Seed Demo: HT Valparaíso - Viruta sanitaria" },
  { itemName: "Heno", locationRef: { type: "user", key: "htSantiago" }, cantidad: 3, condicion: "NUEVO", observaciones: "Seed Demo: HT Santiago - Heno" },
  { itemName: "Bebedero", locationRef: { type: "user", key: "htSantiago" }, cantidad: 1, condicion: "NUEVO", observaciones: "Seed Demo: HT Santiago - Bebedero" },
  { itemName: "Comedero", locationRef: { type: "user", key: "htSantiago" }, cantidad: 1, condicion: "NUEVO", observaciones: "Seed Demo: HT Santiago - Comedero" },
  { itemName: "Pellet de hámster", locationRef: { type: "user", key: "htLaFlorida" }, cantidad: 2.5, condicion: "NUEVO", observaciones: "Seed Demo: HT La Florida - Pellet de hámster" },
  { itemName: "Desinfectante", locationRef: { type: "user", key: "htLaFlorida" }, cantidad: 1, condicion: "NUEVO", observaciones: "Seed Demo: HT La Florida - Desinfectante" },
];

const DEMO_DONATIONS = [
  {
    key: "pendingDonation",
    motivo: "Donación demo pendiente",
    punto_encuentro: "Recepción Fundación",
    fecha_registro: "2026-06-05",
    observaciones: "Seed demo pendiente para pruebas de recepción manual",
    regionKey: "RM",
    receivingUserKey: "adminDemo",
    itemName: "Suero fisiológico",
    cantidad: 6,
    cantidadRecepcionada: 0,
    condicion: "NUEVO",
    condiciones_almacenamiento: "Mantener cerrado y a temperatura ambiente",
    estadoLinea: "PENDIENTE",
    recepcionParcialDefinitiva: false,
  },
  {
    key: "partialDonation",
    motivo: "Donación demo parcial",
    punto_encuentro: "Bodega Central",
    fecha_registro: "2026-06-04",
    observaciones: "Seed demo con recepción parcial para trazabilidad",
    regionKey: "RM",
    receivingUserKey: "adminDemo",
    itemName: "Viruta sanitaria",
    cantidad: 8,
    cantidadRecepcionada: 3,
    condicion: "NUEVO",
    condiciones_almacenamiento: "Mantener en lugar seco y ventilado",
    estadoLinea: "PARCIAL",
    recepcionParcialDefinitiva: false,
    destinationLocationName: "Bodega Central",
    movementObservation: "Seed Demo: Recepción parcial donación Viruta sanitaria",
  },
];

const DEMO_PURCHASES = [
  {
    key: "pendingPurchase",
    descripcion: "Compra demo pendiente",
    fecha_compra: "2026-06-05",
    monto_total: 18000,
    observaciones: "Seed demo pendiente para recepción manual",
    supplierName: "Proveedor Inventario Demo",
    registeredByKey: "adminDemo",
    isPaid: false,
    itemName: "Comedero",
    cantidad: 4,
    cantidadRecepcionada: 0,
    precio_unitario: 4500,
    subtotal: 18000,
    condicion: "NUEVO",
    condiciones_almacenamiento: "Mantener embalaje original",
    estadoLinea: "PENDIENTE",
    recepcionParcialDefinitiva: false,
  },
  {
    key: "partialPurchase",
    descripcion: "Compra demo parcial pagada",
    fecha_compra: "2026-06-03",
    monto_total: 36000,
    observaciones: "Seed demo con pago asociado y recepción parcial",
    supplierName: "Proveedor Inventario Demo",
    registeredByKey: "adminDemo",
    isPaid: true,
    transactionKey: "purchase-demo-partial",
    itemName: "Medicamento antiparasitario",
    cantidad: 6,
    cantidadRecepcionada: 2,
    precio_unitario: 6000,
    subtotal: 36000,
    condicion: "NUEVO",
    condiciones_almacenamiento: "Mantener protegido de la luz solar",
    estadoLinea: "PARCIAL",
    recepcionParcialDefinitiva: false,
    destinationLocationName: "Bodega Central",
    movementObservation: "Seed Demo: Recepción parcial compra Medicamento antiparasitario",
  },
];

function addDaysToDateOnly(dateString, offset) {
  const base = new Date(`${dateString}T12:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

async function ensureRolePermissions({
  roleName,
  permissionNames,
  ensureRole,
  roleRepository,
  syncRolePermissions,
  permissionsByName,
  rolePermissionRepository,
  rolesByName,
}) {
  const role = await ensureRole(roleRepository, roleName);
  rolesByName.set(roleName, role);
  await syncRolePermissions({
    role,
    permissionNames,
    permissionsByName,
    rolePermissionRepository,
  });
  return role;
}

async function ensureFosterHome({
  manager,
  ensureLocation,
  locationType,
  fosterHomeRepository,
  fosterHomeMemberRepository,
  fosterHomeAllowedAnimalRepository,
  user,
  config,
}) {
  const location = await ensureLocation({
    manager,
    tipo: locationType,
    nombre_ubicacion: user.location.nombre_ubicacion,
    direccion: user.location.direccion,
    regionId: user.location.region.id_region,
    comunaId: user.location.comuna.id_comuna,
    observaciones: user.location.observaciones || config.observations,
    activo: true,
    existingLocationId: user.location.ubicacion_id,
  });

  let fosterHome = await fosterHomeRepository.findOne({
    where: {
      responsable_usuario: { id_usuario: user.id_usuario },
    },
    relations: {
      responsable_usuario: true,
    },
  });

  if (!fosterHome) {
    fosterHome = await fosterHomeRepository.save(
      fosterHomeRepository.create({
        observaciones: config.observations,
        activo: true,
        responsable_usuario: { id_usuario: user.id_usuario },
      }),
    );
  } else {
    let changed = false;
    if (fosterHome.observaciones !== config.observations) {
      fosterHome.observaciones = config.observations;
      changed = true;
    }
    if (!fosterHome.activo) {
      fosterHome.activo = true;
      changed = true;
    }
    if (Number(fosterHome.responsable_usuario?.id_usuario) !== Number(user.id_usuario)) {
      fosterHome.responsable_usuario = { id_usuario: user.id_usuario };
      changed = true;
    }
    if (changed) {
      fosterHome = await fosterHomeRepository.save(fosterHome);
    }
  }

  let member = await fosterHomeMemberRepository.findOne({
    where: {
      foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
      user: { id_usuario: user.id_usuario },
    },
    relations: {
      foster_home: true,
      user: true,
    },
  });

  if (!member) {
    member = await fosterHomeMemberRepository.save(
      fosterHomeMemberRepository.create({
        foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
        user: { id_usuario: user.id_usuario },
        rol: FosterHomeMemberRole.RESPONSABLE,
        activo: true,
      }),
    );
  } else if (member.rol !== FosterHomeMemberRole.RESPONSABLE || !member.activo) {
    member.rol = FosterHomeMemberRole.RESPONSABLE;
    member.activo = true;
    await fosterHomeMemberRepository.save(member);
  }

  let allowedAnimal = await fosterHomeAllowedAnimalRepository.findOne({
    where: {
      foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
      especie: config.species,
    },
    relations: {
      foster_home: true,
    },
  });

  if (!allowedAnimal) {
    allowedAnimal = await fosterHomeAllowedAnimalRepository.save(
      fosterHomeAllowedAnimalRepository.create({
        foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
        especie: config.species,
        estado_permitido: "CUALQUIERA",
        capacidad_maxima: config.capacity,
        observaciones: "Seed demo de hogar temporal",
        activo: true,
      }),
    );
  } else {
    let changed = false;
    if (Number(allowedAnimal.capacidad_maxima ?? 0) !== Number(config.capacity)) {
      allowedAnimal.capacidad_maxima = config.capacity;
      changed = true;
    }
    if (!allowedAnimal.activo) {
      allowedAnimal.activo = true;
      changed = true;
    }
    if (allowedAnimal.estado_permitido !== "CUALQUIERA") {
      allowedAnimal.estado_permitido = "CUALQUIERA";
      changed = true;
    }
    if (changed) {
      await fosterHomeAllowedAnimalRepository.save(allowedAnimal);
    }
  }

  return {
    fosterHome,
    location,
  };
}

async function ensureAnimalRecord(animalRepository, animalData, region) {
  let animal = await animalRepository.findOne({
    where: { nombre: animalData.name },
    relations: {
      region: true,
    },
  });

  const payload = {
    nombre: animalData.name,
    sexo: animalData.sexo,
    especie: animalData.especie,
    fecha_nacimiento: animalData.fechaNacimiento,
    tipo_fecha_nacimiento: animalData.tipoFechaNacimiento,
    estado_salud_actual: animalData.estadoSalud,
    estado_adopcion: animalData.estadoAdopcion,
    fallecido: false,
    region: { id_region: region.id_region },
  };

  if (!animal) {
    return animalRepository.save(animalRepository.create(payload));
  }

  let changed = false;
  for (const [field, value] of Object.entries(payload)) {
    if (field === "region") {
      if (Number(animal.region?.id_region) !== Number(region.id_region)) {
        animal.region = { id_region: region.id_region };
        changed = true;
      }
      continue;
    }
    if ((animal[field] ?? null) !== (value ?? null)) {
      animal[field] = value;
      changed = true;
    }
  }

  return changed ? animalRepository.save(animal) : animal;
}

async function ensureFosterAssignmentRecord(fosterAssignmentRepository, fosterHome, animal) {
  let assignment = await fosterAssignmentRepository.findOne({
    where: {
      foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
      animal: { id_animal: animal.id_animal },
    },
    relations: {
      foster_home: true,
      animal: true,
    },
  });

  if (!assignment) {
    return fosterAssignmentRepository.save(
      fosterAssignmentRepository.create({
        foster_home: { id_hogar_temporal: fosterHome.id_hogar_temporal },
        animal: { id_animal: animal.id_animal },
        fecha_inicio: "2026-06-01",
        estado: FosterAssignmentEstado.ACTIVO,
        observaciones: "Asignación demo activa",
      }),
    );
  }

  let changed = false;
  if (assignment.fecha_inicio !== "2026-06-01") {
    assignment.fecha_inicio = "2026-06-01";
    changed = true;
  }
  if (assignment.estado !== FosterAssignmentEstado.ACTIVO) {
    assignment.estado = FosterAssignmentEstado.ACTIVO;
    assignment.fecha_fin = null;
    assignment.motivo_termino = null;
    changed = true;
  }
  if (assignment.observaciones !== "Asignación demo activa") {
    assignment.observaciones = "Asignación demo activa";
    changed = true;
  }

  return changed ? fosterAssignmentRepository.save(assignment) : assignment;
}

async function ensureShiftRecord(shiftRepository, shiftData) {
  let shift = await shiftRepository.findOne({
    where: {
      fecha: shiftData.fecha,
      titulo: shiftData.titulo,
      hora_inicio: shiftData.hora_inicio,
    },
  });

  if (!shift) {
    return shiftRepository.save(shiftRepository.create(shiftData));
  }

  let changed = false;
  for (const field of ["hora_fin", "cantidad_maxima", "estado"]) {
    if ((shift[field] ?? null) !== (shiftData[field] ?? null)) {
      shift[field] = shiftData[field];
      changed = true;
    }
  }
  if (shift.titulo !== shiftData.titulo) {
    shift.titulo = shiftData.titulo;
    changed = true;
  }

  return changed ? shiftRepository.save(shift) : shift;
}

async function ensureRegistrationShift(registrationRepository, shift, user, estado) {
  let registration = await registrationRepository.findOne({
    where: {
      shift: { id_turno: shift.id_turno },
      user: { id_usuario: user.id_usuario },
    },
    relations: {
      shift: true,
      user: true,
    },
  });

  if (!registration) {
    return registrationRepository.save(
      registrationRepository.create({
        shift: { id_turno: shift.id_turno },
        user: { id_usuario: user.id_usuario },
        estado,
        bitacora: "Seed demo",
      }),
    );
  }

  if (registration.estado !== estado || registration.bitacora !== "Seed demo") {
    registration.estado = estado;
    registration.bitacora = "Seed demo";
    registration = await registrationRepository.save(registration);
  }

  return registration;
}

async function ensureNoticeRecord(noticeRepository, noticeData, user) {
  let notice = await noticeRepository.findOne({
    where: { titulo: noticeData.titulo },
  });

  const payload = {
    ...noticeData,
    user: { id_usuario: user.id_usuario },
  };

  if (!notice) {
    return noticeRepository.save(noticeRepository.create(payload));
  }

  let changed = false;
  for (const field of ["estado", "descripcion", "fecha_publicacion", "publico"]) {
    if ((notice[field] ?? null) !== (noticeData[field] ?? null)) {
      notice[field] = noticeData[field];
      changed = true;
    }
  }
  if (changed) {
    notice = await noticeRepository.save({
      ...notice,
      user: { id_usuario: user.id_usuario },
    });
  }
  return notice;
}

async function ensureEventRecord(eventRepository, eventData) {
  let event = await eventRepository.findOne({
    where: {
      titulo: eventData.titulo,
    },
  });

  if (!event) {
    return eventRepository.save(eventRepository.create(eventData));
  }

  let changed = false;
  for (const field of ["fecha_inicio", "fecha_fin", "todo_el_dia", "categoria", "lugar", "descripcion", "activo"]) {
    const currentValue = field.startsWith("fecha_")
      ? event[field]?.toISOString?.() ?? event[field] ?? null
      : event[field] ?? null;
    const nextValue = eventData[field] ?? null;

    if (currentValue !== nextValue) {
      event[field] = eventData[field];
      changed = true;
    }
  }

  return changed ? eventRepository.save(event) : event;
}

async function ensureTaskRecord(taskRepository, taskData, createdByUser, area) {
  let task = await taskRepository.findOne({
    where: { titulo: taskData.titulo },
    relations: {
      creado_por: true,
      area: true,
    },
  });

  const payload = {
    titulo: taskData.titulo,
    descripcion: taskData.descripcion,
    estado: taskData.estado,
    prioridad: taskData.prioridad,
    fecha_limite: taskData.fecha_limite,
    creado_por: { id_usuario: createdByUser.id_usuario },
    area: { id_area: area.id_area },
  };

  if (!task) {
    return taskRepository.save(taskRepository.create(payload));
  }

  let changed = false;
  for (const field of ["descripcion", "estado", "prioridad", "fecha_limite"]) {
    if ((task[field] ?? null) !== (taskData[field] ?? null)) {
      task[field] = taskData[field];
      changed = true;
    }
  }
  if (Number(task.creado_por?.id_usuario) !== Number(createdByUser.id_usuario)) {
    task.creado_por = { id_usuario: createdByUser.id_usuario };
    changed = true;
  }
  if (Number(task.area?.id_area) !== Number(area.id_area)) {
    task.area = { id_area: area.id_area };
    changed = true;
  }

  return changed ? taskRepository.save(task) : task;
}

async function ensureTaskAssignmentRecord(taskAssignmentRepository, task, user, assignedBy, estado) {
  let assignment = await taskAssignmentRepository.findOne({
    where: {
      task: { id_tarea: task.id_tarea },
      user: { id_usuario: user.id_usuario },
    },
    relations: {
      task: true,
      user: true,
      asignado_por: true,
    },
  });

  if (!assignment) {
    return taskAssignmentRepository.save(
      taskAssignmentRepository.create({
        task: { id_tarea: task.id_tarea },
        user: { id_usuario: user.id_usuario },
        asignado_por: { id_usuario: assignedBy.id_usuario },
        estado,
        completed_at: estado === "completada" ? "2026-06-05T12:00:00.000Z" : null,
        nota_final: estado === "completada" ? "Completada como parte del seed demo." : null,
      }),
    );
  }

  let changed = false;
  if (assignment.estado !== estado) {
    assignment.estado = estado;
    changed = true;
  }
  const targetCompletedAt = estado === "completada" ? "2026-06-05T12:00:00.000Z" : null;
  const targetNote = estado === "completada" ? "Completada como parte del seed demo." : null;
  if ((assignment.completed_at ?? null) !== targetCompletedAt) {
    assignment.completed_at = targetCompletedAt;
    changed = true;
  }
  if ((assignment.nota_final ?? null) !== targetNote) {
    assignment.nota_final = targetNote;
    changed = true;
  }
  if (Number(assignment.asignado_por?.id_usuario) !== Number(assignedBy.id_usuario)) {
    assignment.asignado_por = { id_usuario: assignedBy.id_usuario };
    changed = true;
  }

  return changed ? taskAssignmentRepository.save(assignment) : assignment;
}

async function ensureTransactionRecord(transactionRepository, transactionKey, amount, createdByUser) {
  let transaction = await transactionRepository.findOne({
    where: { idempotencia_key: transactionKey },
  });

  const payload = {
    tipo: "EGRESO",
    descripcion: `Seed demo ${transactionKey}`,
    moneda: "CLP",
    monto_bruto: amount,
    monto_fee: 0,
    monto_neto: amount,
    fecha_transaccion: "2026-06-03T15:00:00.000Z",
    estado: "COMPLETADA",
    referencia_externa: `seed-${transactionKey}`,
    idempotencia_key: transactionKey,
    metadata: { seed: "demo", transactionKey },
    created_by: { id_usuario: createdByUser.id_usuario },
  };

  if (!transaction) {
    return transactionRepository.save(transactionRepository.create(payload));
  }

  let changed = false;
  for (const field of [
    "tipo",
    "descripcion",
    "moneda",
    "monto_bruto",
    "monto_fee",
    "monto_neto",
    "fecha_transaccion",
    "estado",
    "referencia_externa",
  ]) {
    if ((transaction[field] ?? null) !== (payload[field] ?? null)) {
      transaction[field] = payload[field];
      changed = true;
    }
  }
  if (JSON.stringify(transaction.metadata ?? null) !== JSON.stringify(payload.metadata)) {
    transaction.metadata = payload.metadata;
    changed = true;
  }
  if (Number(transaction.created_by?.id_usuario ?? createdByUser.id_usuario) !== Number(createdByUser.id_usuario)) {
    transaction.created_by = { id_usuario: createdByUser.id_usuario };
    changed = true;
  }

  return changed ? transactionRepository.save(transaction) : transaction;
}

async function ensureInventoryReceiptRecord(
  receiptRepository,
  {
    idempotencyKey,
    cantidad,
    fechaRecepcion,
    observaciones,
    destinationLocationId,
    performedById,
    movementId,
    donationItemId = null,
    purchaseDetailId = null,
  },
) {
  let receipt = await receiptRepository.findOne({
    where: { idempotency_key: idempotencyKey },
    relations: {
      movement: true,
      destination_location: true,
      performed_by: true,
      donation_item: true,
      purchase_detail: true,
    },
  });

  const payload = {
    cantidad,
    fecha_recepcion: fechaRecepcion,
    observaciones,
    cierra_detalle: false,
    idempotency_key: idempotencyKey,
    destination_location: { ubicacion_id: Number(destinationLocationId) },
    performed_by: { id_usuario: Number(performedById) },
    movement: { movimiento_id: Number(movementId) },
    donation_item: donationItemId ? { donacion_individual_id: Number(donationItemId) } : null,
    purchase_detail: purchaseDetailId ? { detalle_compra_id: Number(purchaseDetailId) } : null,
  };

  if (!receipt) {
    return receiptRepository.save(receiptRepository.create(payload));
  }

  let changed = false;
  for (const field of ["cantidad", "fecha_recepcion", "observaciones", "cierra_detalle"]) {
    if ((receipt[field] ?? null) !== (payload[field] ?? null)) {
      receipt[field] = payload[field];
      changed = true;
    }
  }

  if (Number(receipt.movement?.movimiento_id ?? 0) !== Number(movementId)) {
    receipt.movement = payload.movement;
    changed = true;
  }
  if (Number(receipt.destination_location?.ubicacion_id ?? 0) !== Number(destinationLocationId)) {
    receipt.destination_location = payload.destination_location;
    changed = true;
  }
  if (Number(receipt.performed_by?.id_usuario ?? 0) !== Number(performedById)) {
    receipt.performed_by = payload.performed_by;
    changed = true;
  }
  if (Number(receipt.donation_item?.donacion_individual_id ?? 0) !== Number(donationItemId || 0)) {
    receipt.donation_item = payload.donation_item;
    changed = true;
  }
  if (Number(receipt.purchase_detail?.detalle_compra_id ?? 0) !== Number(purchaseDetailId || 0)) {
    receipt.purchase_detail = payload.purchase_detail;
    changed = true;
  }

  return changed ? receiptRepository.save(receipt) : receipt;
}

async function ensureDonationScenario({
  manager,
  donationRepository,
  donationItemRepository,
  movementRepository,
  receiptRepository,
  donationData,
  region,
  receivingUser,
  item,
  destinationLocation,
}) {
  let donation = await donationRepository.findOne({
    where: { motivo_donacion: donationData.motivo },
    relations: {
      donation_item: true,
    },
  });

  if (!donation) {
    donation = await donationRepository.save(
      donationRepository.create({
        motivo_donacion: donationData.motivo,
        punto_encuentro: donationData.punto_encuentro,
        fecha_registro: donationData.fecha_registro,
        estado: "PENDIENTE",
        observaciones: donationData.observaciones,
        region: { id_region: region.id_region },
        receiving_user: { id_usuario: receivingUser.id_usuario },
      }),
    );
  }

  let line = await donationItemRepository.findOne({
    where: {
      donation: { donacion_id: donation.donacion_id },
      item: { item_id: item.item_id },
    },
    relations: {
      donation: true,
      item: true,
    },
  });

  if (!line) {
    line = await donationItemRepository.save(
      donationItemRepository.create({
        donation: { donacion_id: donation.donacion_id },
        item: { item_id: item.item_id },
        cantidad: donationData.cantidad,
        cantidad_recepcionada: donationData.cantidadRecepcionada,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condiciones_almacenamiento: donationData.condiciones_almacenamiento,
        condicion: donationData.condicion,
        estado: donationData.estadoLinea,
        observaciones: donationData.observaciones,
        recepcion_parcial_definitiva: donationData.recepcionParcialDefinitiva,
      }),
    );
  } else {
    let changed = false;
    for (const field of [
      "cantidad",
      "cantidad_recepcionada",
      "condiciones_almacenamiento",
      "condicion",
      "estado",
      "observaciones",
      "recepcion_parcial_definitiva",
    ]) {
      const targetField = field === "cantidad_recepcionada" ? "cantidadRecepcionada"
        : field === "estado" ? "estadoLinea"
        : field === "recepcion_parcial_definitiva" ? "recepcionParcialDefinitiva"
          : field;
      if ((line[field] ?? null) !== (donationData[targetField] ?? null)) {
        line[field] = donationData[targetField];
        changed = true;
      }
    }
    if (changed) {
      line = await donationItemRepository.save(line);
    }
  }

  if (donationData.cantidadRecepcionada > 0 && destinationLocation) {
    const existingMovement = await movementRepository.findOne({
      where: {
        observaciones: donationData.movementObservation,
        donation_item: { donacion_individual_id: line.donacion_individual_id },
      },
      relations: {
        donation_item: true,
      },
    });

    if (!existingMovement) {
      const existence = await createOrIncreaseExistence(manager, {
        item_id: item.item_id,
        location_id: destinationLocation.ubicacion_id,
        cantidad_actual: donationData.cantidadRecepcionada,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condicion: donationData.condicion,
        origen_tipo: "DONACION",
        origen_id: line.donacion_individual_id,
        observaciones: donationData.movementObservation,
      });

      await createMovementRecord(manager, {
        tipo_movimiento: "ENTRADA",
        cantidad: donationData.cantidadRecepcionada,
        fecha_movimiento: donationData.fecha_registro,
        referencia_tipo: "DONACION",
        referencia_id: line.donacion_individual_id,
        observaciones: donationData.movementObservation,
        item_id: item.item_id,
        destination_location_id: destinationLocation.ubicacion_id,
        performed_by_id: receivingUser.id_usuario,
        donation_item_id: line.donacion_individual_id,
      });

      const storedMovement = await movementRepository.findOne({
        where: {
          observaciones: donationData.movementObservation,
          donation_item: { donacion_individual_id: line.donacion_individual_id },
        },
        relations: {
          donation_item: true,
        },
      });

      await ensureInventoryReceiptRecord(receiptRepository, {
        idempotencyKey: `receipt-${donationData.key}`,
        cantidad: donationData.cantidadRecepcionada,
        fechaRecepcion: donationData.fecha_registro,
        observaciones: donationData.movementObservation,
        destinationLocationId: destinationLocation.ubicacion_id,
        performedById: receivingUser.id_usuario,
        movementId: storedMovement.movimiento_id,
        donationItemId: line.donacion_individual_id,
      });

      line.cantidad_recepcionada = donationData.cantidadRecepcionada;
      line.estado = donationData.estadoLinea;
      line.recepcion_parcial_definitiva = donationData.recepcionParcialDefinitiva;
      await donationItemRepository.save(line);
      await recalculateDonationState(manager, donation.donacion_id);
      return { donation, line, existenceId: existence.existencia_id };
    }

    await ensureInventoryReceiptRecord(receiptRepository, {
      idempotencyKey: `receipt-${donationData.key}`,
      cantidad: donationData.cantidadRecepcionada,
      fechaRecepcion: donationData.fecha_registro,
      observaciones: donationData.movementObservation,
      destinationLocationId: destinationLocation.ubicacion_id,
      performedById: receivingUser.id_usuario,
      movementId: existingMovement.movimiento_id,
      donationItemId: line.donacion_individual_id,
    });

    line.cantidad_recepcionada = donationData.cantidadRecepcionada;
    line.estado = donationData.estadoLinea;
    line.recepcion_parcial_definitiva = donationData.recepcionParcialDefinitiva;
    await donationItemRepository.save(line);
    await recalculateDonationState(manager, donation.donacion_id);
    return { donation, line, existenceId: null };
  }

  await recalculateDonationState(manager, donation.donacion_id);
  return { donation, line, existenceId: null };
}

async function ensurePurchaseScenario({
  manager,
  purchaseRepository,
  purchaseDetailRepository,
  movementRepository,
  receiptRepository,
  transactionRepository,
  purchaseData,
  supplier,
  registeredBy,
  item,
  destinationLocation,
}) {
  let purchase = await purchaseRepository.findOne({
    where: { descripcion: purchaseData.descripcion },
    relations: {
      purchase_details: true,
      transaction: true,
    },
  });

  if (!purchase) {
    purchase = await purchaseRepository.save(
      purchaseRepository.create({
        fecha_compra: purchaseData.fecha_compra,
        fecha_recepcion: null,
        estado: "CONFIRMADA",
        monto_total: purchaseData.monto_total,
        descripcion: purchaseData.descripcion,
        observaciones: purchaseData.observaciones,
        supplier: { proveedor_id: supplier.proveedor_id },
        registered_by: { id_usuario: registeredBy.id_usuario },
        transaction: null,
      }),
    );
  } else {
    let changed = false;
    if (purchase.estado !== "CONFIRMADA") {
      purchase.estado = "CONFIRMADA";
      changed = true;
    }
    if ((purchase.observaciones ?? null) !== (purchaseData.observaciones ?? null)) {
      purchase.observaciones = purchaseData.observaciones;
      changed = true;
    }
    if (changed) {
      purchase = await purchaseRepository.save(purchase);
    }
  }

  let transaction = purchase.transaction ?? null;

  if (purchaseData.isPaid && purchaseData.transactionKey) {
    transaction = await ensureTransactionRecord(
      transactionRepository,
      purchaseData.transactionKey,
      purchaseData.monto_total,
      registeredBy,
    );

    const currentTransactionId =
      purchase.transaction?.transaccion_id ?? null;

    if (
      Number(currentTransactionId) !==
      Number(transaction.transaccion_id)
    ) {
      purchase.transaction = {
        transaccion_id: transaction.transaccion_id,
      };

      purchase = await purchaseRepository.save(purchase);
    }
  } else if (purchase.transaction?.transaccion_id) {
    purchase.transaction = null;
    purchase = await purchaseRepository.save(purchase);
  }

  let detail = await purchaseDetailRepository.findOne({
    where: {
      purchase: { compra_id: purchase.compra_id },
      item: { item_id: item.item_id },
    },
    relations: {
      purchase: true,
      item: true,
    },
  });

  if (!detail) {
    detail = await purchaseDetailRepository.save(
      purchaseDetailRepository.create({
        purchase: { compra_id: purchase.compra_id },
        item: { item_id: item.item_id },
        cantidad: purchaseData.cantidad,
        cantidad_recepcionada: purchaseData.cantidadRecepcionada,
        precio_unitario: purchaseData.precio_unitario,
        subtotal: purchaseData.subtotal,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condiciones_almacenamiento: purchaseData.condiciones_almacenamiento,
        condicion: purchaseData.condicion,
        estado: purchaseData.estadoLinea,
        observaciones: purchaseData.observaciones,
        recepcion_parcial_definitiva: purchaseData.recepcionParcialDefinitiva,
      }),
    );
  } else {
    let changed = false;
    for (const field of [
      "cantidad",
      "cantidad_recepcionada",
      "precio_unitario",
      "subtotal",
      "condiciones_almacenamiento",
      "condicion",
      "estado",
      "observaciones",
      "recepcion_parcial_definitiva",
    ]) {
      const targetField = field === "cantidad_recepcionada" ? "cantidadRecepcionada"
        : field === "estado" ? "estadoLinea"
        : field === "recepcion_parcial_definitiva" ? "recepcionParcialDefinitiva"
          : field;
      if ((detail[field] ?? null) !== (purchaseData[targetField] ?? null)) {
        detail[field] = purchaseData[targetField];
        changed = true;
      }
    }
    if (changed) {
      detail = await purchaseDetailRepository.save(detail);
    }
  }

  if (purchaseData.cantidadRecepcionada > 0 && destinationLocation) {
    const existingMovement = await movementRepository.findOne({
      where: {
        observaciones: purchaseData.movementObservation,
        purchase_detail: { detalle_compra_id: detail.detalle_compra_id },
      },
      relations: {
        purchase_detail: true,
      },
    });

    if (!existingMovement) {
      const existence = await createOrIncreaseExistence(manager, {
        item_id: item.item_id,
        location_id: destinationLocation.ubicacion_id,
        cantidad_actual: purchaseData.cantidadRecepcionada,
        fecha_vencimiento: null,
        fecha_apertura: null,
        condicion: purchaseData.condicion,
        origen_tipo: "COMPRA",
        origen_id: detail.detalle_compra_id,
        observaciones: purchaseData.movementObservation,
      });

      await createMovementRecord(manager, {
        tipo_movimiento: "ENTRADA",
        cantidad: purchaseData.cantidadRecepcionada,
        fecha_movimiento: purchaseData.fecha_compra,
        referencia_tipo: "COMPRA",
        referencia_id: detail.detalle_compra_id,
        observaciones: purchaseData.movementObservation,
        item_id: item.item_id,
        destination_location_id: destinationLocation.ubicacion_id,
        performed_by_id: registeredBy.id_usuario,
        purchase_detail_id: detail.detalle_compra_id,
      });

      const storedMovement = await movementRepository.findOne({
        where: {
          observaciones: purchaseData.movementObservation,
          purchase_detail: { detalle_compra_id: detail.detalle_compra_id },
        },
        relations: {
          purchase_detail: true,
        },
      });

      await ensureInventoryReceiptRecord(receiptRepository, {
        idempotencyKey: `receipt-${purchaseData.key}`,
        cantidad: purchaseData.cantidadRecepcionada,
        fechaRecepcion: purchaseData.fecha_compra,
        observaciones: purchaseData.movementObservation,
        destinationLocationId: destinationLocation.ubicacion_id,
        performedById: registeredBy.id_usuario,
        movementId: storedMovement.movimiento_id,
        purchaseDetailId: detail.detalle_compra_id,
      });

      detail.cantidad_recepcionada = purchaseData.cantidadRecepcionada;
      detail.estado = purchaseData.estadoLinea;
      detail.recepcion_parcial_definitiva = purchaseData.recepcionParcialDefinitiva;
      await purchaseDetailRepository.save(detail);
      await recalculatePurchaseState(manager, purchase.compra_id);
      return { purchase, detail, existenceId: existence.existencia_id, transactionId: transaction?.transaccion_id || null };
    }

    await ensureInventoryReceiptRecord(receiptRepository, {
      idempotencyKey: `receipt-${purchaseData.key}`,
      cantidad: purchaseData.cantidadRecepcionada,
      fechaRecepcion: purchaseData.fecha_compra,
      observaciones: purchaseData.movementObservation,
      destinationLocationId: destinationLocation.ubicacion_id,
      performedById: registeredBy.id_usuario,
      movementId: existingMovement.movimiento_id,
      purchaseDetailId: detail.detalle_compra_id,
    });

    detail.cantidad_recepcionada = purchaseData.cantidadRecepcionada;
    detail.estado = purchaseData.estadoLinea;
    detail.recepcion_parcial_definitiva = purchaseData.recepcionParcialDefinitiva;
    await purchaseDetailRepository.save(detail);
    await recalculatePurchaseState(manager, purchase.compra_id);
    return {
      purchase,
      detail,
      existenceId: null,
      transactionId: transaction?.transaccion_id || null,
    };
  }

  await recalculatePurchaseState(manager, purchase.compra_id);
  return { purchase, detail, existenceId: null, transactionId: transaction?.transaccion_id || null };
}

export async function seedDemoData({
  manager,
  helpers,
  maps,
  defaults,
  permissionsByName,
  rolePermissionRepository,
  roleRepository,
}) {
  const regionRepository = manager.getRepository("Region");
  const comunaRepository = manager.getRepository("Comuna");
  const fosterHomeRepository = manager.getRepository(FosterHome);
  const fosterHomeMemberRepository = manager.getRepository(FosterHomeMember);
  const fosterHomeAllowedAnimalRepository = manager.getRepository(FosterHomeAllowedAnimal);
  const animalRepository = manager.getRepository(Animal);
  const fosterAssignmentRepository = manager.getRepository(FosterAssignment);
  const shiftRepository = manager.getRepository(Shift);
  const registrationRepository = manager.getRepository(RegistrationShift);
  const noticeRepository = manager.getRepository(Notice);
  const eventRepository = manager.getRepository(Event);
  const taskRepository = manager.getRepository(Task);
  const taskAssignmentRepository = manager.getRepository(TaskAssignment);
  const donationRepository = manager.getRepository(Donation);
  const donationItemRepository = manager.getRepository(DonationItem);
  const purchaseRepository = manager.getRepository(Purchase);
  const purchaseDetailRepository = manager.getRepository(PurchaseDetail);
  const transactionRepository = manager.getRepository(Transaction);
  const movementRepository = manager.getRepository("InventoryMovement");
  const receiptRepository = manager.getRepository("InventoryReceipt");
  const supplierRepository = manager.getRepository("Supplier");

  for (const regionData of DEMO_REGIONS) {
    const region = await helpers.ensureRegion(regionRepository, regionData);
    maps.regionsByKey.set(regionData.clave, region);
  }

  for (const comunaData of DEMO_COMUNAS) {
    const region = maps.regionsByKey.get(comunaData.regionKey);
    const comuna = await helpers.ensureComuna(comunaRepository, region, comunaData);
    maps.comunasByKey.set(`${comunaData.regionKey}:${comunaData.nombre}`, comuna);
  }

  const allPermissionNames = Array.from(permissionsByName.keys());
  const directivaPermissions = allPermissionNames.filter(
    (permissionName) => ![
      "role:create",
      "role:update",
      "role:delete",
      "users:user:delete",
      "users:user_password:reset",
      "users:user_role:assign",
      "users:user_area:assign",
    ].includes(permissionName),
  );

  const fosterHomePermissions = [
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
    "home:task:read:mine",
    "home:task:update:status:mine",
    "home:task:history:read:mine",
    "home:task:comment:mine",
    "inventory:read:location",
    "inventory:movement:create:location",
    "inventory:location:read",
    "inventory:inventory_existence:read",
    "inventory:inventory_movement:read",
  ];

  await ensureRolePermissions({
    roleName: DEMO_ROLES.ADMIN_GENERAL,
    permissionNames: null,
    ensureRole: helpers.ensureRole,
    roleRepository,
    syncRolePermissions: helpers.syncRolePermissions,
    permissionsByName,
    rolePermissionRepository,
    rolesByName: maps.rolesByName,
  });

  await ensureRolePermissions({
    roleName: DEMO_ROLES.DIRECTIVA,
    permissionNames: directivaPermissions,
    ensureRole: helpers.ensureRole,
    roleRepository,
    syncRolePermissions: helpers.syncRolePermissions,
    permissionsByName,
    rolePermissionRepository,
    rolesByName: maps.rolesByName,
  });

  await ensureRolePermissions({
    roleName: DEMO_ROLES.FOSTER_HOME,
    permissionNames: fosterHomePermissions,
    ensureRole: helpers.ensureRole,
    roleRepository,
    syncRolePermissions: helpers.syncRolePermissions,
    permissionsByName,
    rolePermissionRepository,
    rolesByName: maps.rolesByName,
  });

  for (const userData of DEMO_USERS) {
    const role = maps.rolesByName.get(userData.roleName);
    const area = maps.areasByKey.get(userData.areaKey);
    const region = maps.regionsByKey.get(userData.location.regionKey);
    const comuna = maps.comunasByKey.get(`${userData.location.regionKey}:${userData.location.comunaName}`);

    const user = await helpers.ensureUser({
      manager,
      userRepository: manager.getRepository("User"),
      userAreaRepository: manager.getRepository("UserArea"),
      userRoleRepository: manager.getRepository("UserRole"),
      role,
      area,
      region,
      comuna,
      userData: {
        ...userData,
        ...resolveDemoPasswordConfig(userData),
        updatePasswordIfExists: true,
      },
    });

    const hydratedUser = await manager.getRepository("User").findOne({
      where: { id_usuario: user.id_usuario },
      relations: {
        area: true,
        UserArea: { area: true },
        location: locationRelations,
        UserRole: { role: true },
      },
    });

    maps.usersByEmail.set(user.email, hydratedUser || user);
  }

  const inactiveLocationRegion = maps.regionsByKey.get("RM");
  const inactiveLocationComuna = maps.comunasByKey.get("RM:Maipú");
  const inactiveLocation = await helpers.ensureManualLocation({
    manager,
    locationRepository: manager.getRepository("Location"),
    region: inactiveLocationRegion,
    comuna: inactiveLocationComuna,
    data: {
      tipo: defaults.LOCATION_TYPES.BODEGA,
      nombre_ubicacion: "Bodega Secundaria Inactiva",
      direccion: "Camino Demo 1234",
      observaciones: "Ubicación demo inactiva sin stock",
      activo: false,
    },
  });
  maps.manualLocationsByName.set(inactiveLocation.nombre_ubicacion, inactiveLocation);

  const inactiveSupplier = await helpers.ensureSupplier({
    manager,
    supplierRepository,
    region: maps.regionsByKey.get("RM"),
    comuna: maps.comunasByKey.get("RM:Providencia"),
    supplierData: {
      nombre: "Proveedor Histórico Inactivo",
      telefono: "+56955555561",
      email: "proveedor.inactivo@example.com",
      observaciones: "Proveedor demo inactivo para filtros",
      activo: false,
      location: null,
    },
  });

  const fosterHomes = [];
  for (const fosterHomeData of DEMO_FOSTER_HOMES) {
    const user = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === fosterHomeData.userKey)?.email,
    );
    if (!user?.location) {
      throw new Error(`No se pudo resolver la ubicación del hogar temporal ${fosterHomeData.userKey}`);
    }
    const fosterHomeRecord = await ensureFosterHome({
      manager,
      ensureLocation: helpers.ensureLocation,
      locationType: defaults.LOCATION_TYPES.HOGAR_TEMPORAL,
      fosterHomeRepository,
      fosterHomeMemberRepository,
      fosterHomeAllowedAnimalRepository,
      user,
      config: fosterHomeData,
    });
    fosterHomes.push({
      id: fosterHomeRecord.fosterHome.id_hogar_temporal,
      userEmail: user.email,
      locationId: fosterHomeRecord.location.ubicacion_id,
      species: fosterHomeData.species,
    });
    user.location = fosterHomeRecord.location;
  }

  const animals = [];
  const fosterAssignments = [];
  for (const animalData of DEMO_ANIMALS) {
    const region = maps.regionsByKey.get(animalData.regionKey);
    const animal = await ensureAnimalRecord(animalRepository, animalData, region);
    animals.push({
      id: animal.id_animal,
      nombre: animal.nombre,
      especie: animal.especie,
    });

    if (animalData.fosterUserKey) {
      const fosterHome = fosterHomes.find((home) => home.userEmail === DEMO_USERS.find((user) => user.key === animalData.fosterUserKey)?.email);
      if (fosterHome) {
        const assignment = await ensureFosterAssignmentRecord(
          fosterAssignmentRepository,
          { id_hogar_temporal: fosterHome.id },
          animal,
        );
        fosterAssignments.push({
          id: assignment.id_foster_assignment,
          animalId: animal.id_animal,
          fosterHomeId: fosterHome.id,
        });
      }
    }
  }

  const shifts = [];
  const shiftsByKey = new Map();
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const shiftDate = addDaysToDateOnly(DEMO_SHIFT_WEEK_START, dayOffset);
    for (const template of DEMO_SHIFT_TEMPLATES) {
      const shift = await ensureShiftRecord(shiftRepository, {
        fecha: shiftDate,
        titulo: template.title,
        hora_inicio: template.start,
        hora_fin: template.end,
        cantidad_maxima: template.capacity,
        estado: true,
      });
      shifts.push({
        id: shift.id_turno,
        fecha: shift.fecha,
        titulo: shift.titulo,
      });
      shiftsByKey.set(`${shiftDate}:${template.title}`, shift);
    }
  }

  const shiftRegistrations = [];
  for (const registrationData of DEMO_SHIFT_REGISTRATIONS) {
    const user = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === registrationData.userKey)?.email,
    );
    const shiftDate = addDaysToDateOnly(DEMO_SHIFT_WEEK_START, registrationData.dayOffset);
    const shift = shiftsByKey.get(`${shiftDate}:${registrationData.shiftTitle}`);
    if (!user || !shift) continue;
    const registration = await ensureRegistrationShift(
      registrationRepository,
      shift,
      user,
      registrationData.estado,
    );
    shiftRegistrations.push({
      id: registration.turno_registro_id,
      userEmail: user.email,
      shiftId: shift.id_turno,
      estado: registration.estado,
    });
  }


  const events = [];
  for (const eventData of DEMO_EVENTS) {
    const event = await ensureEventRecord(eventRepository, eventData);
    events.push({
      id: event.id_evento,
      titulo: event.titulo,
      categoria: event.categoria,
      fecha_inicio: event.fecha_inicio,
      fecha_fin: event.fecha_fin,
      todo_el_dia: event.todo_el_dia,
    });
  }

  const tasks = [];
  const taskAssignments = [];
  for (const taskData of DEMO_TASKS) {
    const createdBy = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === taskData.createdByKey)?.email,
    );
    const assignedTo = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === taskData.assignedToKey)?.email,
    );
    const area = maps.areasByKey.get(taskData.areaKey);
    const task = await ensureTaskRecord(taskRepository, taskData, createdBy, area);
    tasks.push({
      id: task.id_tarea,
      titulo: task.titulo,
      estado: task.estado,
    });

    if (assignedTo) {
      const assignment = await ensureTaskAssignmentRecord(
        taskAssignmentRepository,
        task,
        assignedTo,
        createdBy,
        taskData.assignmentState,
      );
      taskAssignments.push({
        id: assignment.id_asignacion,
        taskId: task.id_tarea,
        userEmail: assignedTo.email,
        estado: assignment.estado,
      });
    }
  }

  const adminUser = maps.usersByEmail.get("admin.demo@example.com")
    || maps.usersByEmail.get("admin@example.com");
  const demoSupplier = await supplierRepository.findOne({
    where: { nombre: "Proveedor Inventario Demo" },
  });

  const seededLoads = [];
  for (const loadData of DEMO_INITIAL_LOADS) {
    const item = maps.itemsByName.get(loadData.itemName);
    const location = loadData.locationRef.type === "manual"
      ? maps.manualLocationsByName.get(loadData.locationRef.name)
      : maps.usersByEmail.get(
          DEMO_USERS.find((userItem) => userItem.key === loadData.locationRef.key)?.email,
        )?.location;

    if (!item || !location) {
      throw new Error(`No se pudo resolver la carga inicial demo para ${loadData.itemName}`);
    }

    const movement = await helpers.ensureSeedInitialLoad({
      manager,
      movementRepository,
      item,
      location,
      performedBy: adminUser,
      seedData: loadData,
    });

    seededLoads.push({
      movementId: movement.movimiento_id,
      item: item.nombre,
      location: location.nombre_ubicacion,
    });
  }

  const donations = [];
  for (const donationData of DEMO_DONATIONS) {
    const donationRegion = maps.regionsByKey.get(donationData.regionKey);
    const receivingUser = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === donationData.receivingUserKey)?.email,
    );
    const item = maps.itemsByName.get(donationData.itemName);
    const destinationLocation = donationData.destinationLocationName
      ? maps.manualLocationsByName.get(donationData.destinationLocationName)
      : null;
    const result = await ensureDonationScenario({
      manager,
      donationRepository,
      donationItemRepository,
      movementRepository,
      receiptRepository,
      donationData,
      region: donationRegion,
      receivingUser,
      item,
      destinationLocation,
    });
    donations.push({
      id: result.donation.donacion_id,
      motivo: result.donation.motivo_donacion,
      lineId: result.line.donacion_individual_id,
      lineState: result.line.estado,
      received: Number(result.line.cantidad_recepcionada),
    });
  }

  const purchases = [];
  for (const purchaseData of DEMO_PURCHASES) {
    const registeredBy = maps.usersByEmail.get(
      DEMO_USERS.find((userItem) => userItem.key === purchaseData.registeredByKey)?.email,
    );
    const item = maps.itemsByName.get(purchaseData.itemName);
    const destinationLocation = purchaseData.destinationLocationName
      ? maps.manualLocationsByName.get(purchaseData.destinationLocationName)
      : null;
    const result = await ensurePurchaseScenario({
      manager,
      purchaseRepository,
      purchaseDetailRepository,
      movementRepository,
      receiptRepository,
      transactionRepository,
      purchaseData,
      supplier: demoSupplier,
      registeredBy,
      item,
      destinationLocation,
    });
    purchases.push({
      id: result.purchase.compra_id,
      descripcion: result.purchase.descripcion,
      detailId: result.detail.detalle_compra_id,
      lineState: result.detail.estado,
      received: Number(result.detail.cantidad_recepcionada),
      transactionId: result.transactionId,
    });
  }

  return {
    enabled: true,
    roles: [DEMO_ROLES.ADMIN_GENERAL, DEMO_ROLES.DIRECTIVA, DEMO_ROLES.FOSTER_HOME, DEMO_ROLES.VOLUNTEER],
    regions: DEMO_REGIONS.map((regionItem) => ({
      clave: regionItem.clave,
      id: maps.regionsByKey.get(regionItem.clave)?.id_region || null,
      nombre: regionItem.nombre,
    })),
    comunas: DEMO_COMUNAS.map((comunaItem) => ({
      nombre: comunaItem.nombre,
      id: maps.comunasByKey.get(`${comunaItem.regionKey}:${comunaItem.nombre}`)?.id_comuna || null,
      regionKey: comunaItem.regionKey,
    })),
    users: DEMO_USERS.map((userData) => {
      const user = maps.usersByEmail.get(userData.email);
      return {
        id: user?.id_usuario || null,
        email: userData.email,
        role: userData.roleName,
        locationId: user?.location?.ubicacion_id || null,
      };
    }),
    fosterHomes,
    animals,
    fosterAssignments,
    shifts,
    shiftRegistrations,
    events,
    tasks,
    taskAssignments,
    inventoryInitialLoads: seededLoads,
    donations,
    purchases,
    inactiveLocation: {
      id: inactiveLocation.ubicacion_id,
      nombre: inactiveLocation.nombre_ubicacion,
      activo: inactiveLocation.activo,
    },
    inactiveSupplier: {
      id: inactiveSupplier.proveedor_id,
      nombre: inactiveSupplier.nombre,
      activo: inactiveSupplier.activo,
    },
  };
}

export {
  DEMO_PURCHASES,
  ensureTransactionRecord,
};
