export const PERMISSION_GROUPS = [
  {
    id: "commercial",
    label: "Ventas y CRM",
    permissions: [
      ["dashboard.view", "Ver panel"],
      ["inbox.view", "Ver bandeja"],
      ["inbox.reply", "Responder mensajes"],
      ["crm.view", "Ver CRM"],
      ["crm.manage", "Mover etapas y asignar leads"],
      ["agent.use", "Usar / probar agente"],
      ["tasks.view", "Ver tareas"],
      ["tasks.manage", "Crear y completar tareas"],
      ["customers.view", "Ver clientes"],
      ["customers.manage", "Editar clientes"],
    ],
  },
  {
    id: "operations",
    label: "Operación",
    permissions: [
      ["orders.view", "Ver pedidos"],
      ["orders.manage", "Gestionar pedidos"],
      ["inventory.view", "Ver inventario"],
      ["inventory.manage", "Modificar inventario"],
      ["returns.view", "Ver devoluciones"],
      ["returns.manage", "Gestionar devoluciones"],
      ["products.view", "Ver productos"],
      ["products.manage", "Editar productos y precios"],
    ],
  },
  {
    id: "management",
    label: "Dirección y control",
    permissions: [
      ["analytics.view", "Ver analítica"],
      ["analytics.export", "Descargar conversaciones y reportes"],
      ["automations.view", "Ver automatizaciones"],
      ["automations.manage", "Modificar automatizaciones"],
      ["integrations.view", "Ver integraciones"],
      ["integrations.manage", "Modificar integraciones"],
      ["settings.view", "Ver configuración"],
      ["settings.manage", "Modificar configuración"],
      ["users.manage", "Crear usuarios y permisos"],
    ],
  },
] as const;

export type Permission = (typeof PERMISSION_GROUPS)[number]["permissions"][number][0];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map(([key]) => key)
) as Permission[];

export type AdminRoleName = "ADMIN" | "SALES" | "INVENTORY" | "EDITOR";

export const ROLE_LABELS: Record<AdminRoleName, string> = {
  ADMIN: "Administrador",
  SALES: "Ventas",
  INVENTORY: "Inventario / logística",
  EDITOR: "Catálogo / contenido",
};

export const ROLE_PRESETS: Record<AdminRoleName, Permission[]> = {
  ADMIN: [...ALL_PERMISSIONS],
  SALES: [
    "dashboard.view",
    "inbox.view",
    "inbox.reply",
    "crm.view",
    "crm.manage",
    "agent.use",
    "tasks.view",
    "tasks.manage",
    "customers.view",
    "customers.manage",
    "orders.view",
    "products.view",
    "analytics.view",
  ],
  INVENTORY: [
    "dashboard.view",
    "orders.view",
    "orders.manage",
    "inventory.view",
    "inventory.manage",
    "returns.view",
    "returns.manage",
    "products.view",
    "customers.view",
  ],
  EDITOR: [
    "dashboard.view",
    "products.view",
    "products.manage",
    "analytics.view",
  ],
};

export function normalizeRole(value: unknown): AdminRoleName {
  return ["ADMIN", "SALES", "INVENTORY", "EDITOR"].includes(String(value))
    ? (String(value) as AdminRoleName)
    : "SALES";
}

export function resolvePermissions(role: unknown, custom: unknown): Permission[] {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "ADMIN") return [...ALL_PERMISSIONS];

  if (Array.isArray(custom) && custom.length > 0) {
    const allowed = new Set(ALL_PERMISSIONS);
    return Array.from(new Set(custom.map(String).filter((item) => allowed.has(item as Permission)))) as Permission[];
  }

  return [...ROLE_PRESETS[normalizedRole]];
}

export function hasPermission(role: unknown, custom: unknown, permission: Permission) {
  if (normalizeRole(role) === "ADMIN") return true;
  return resolvePermissions(role, custom).includes(permission);
}
