// Granular permission types
export const PERMISSIONS = {
  CREATE: "create",
  READ: "read",
  UPDATE: "update",
  DELETE: "delete",
  MANAGE_MEMBERS: "manage_members",
  MANAGE_KEYS: "manage_keys",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// Organization member roles
export type MemberRole = "owner" | "admin" | "member" | "viewer";

// Role to permission mapping
export const ROLE_PERMISSIONS: Record<MemberRole, Permission[]> = {
  owner: [
    PERMISSIONS.CREATE,
    PERMISSIONS.READ,
    PERMISSIONS.UPDATE,
    PERMISSIONS.DELETE,
    PERMISSIONS.MANAGE_MEMBERS,
    PERMISSIONS.MANAGE_KEYS,
  ],
  admin: [
    PERMISSIONS.CREATE,
    PERMISSIONS.READ,
    PERMISSIONS.UPDATE,
    PERMISSIONS.DELETE,
    PERMISSIONS.MANAGE_KEYS,
  ],
  member: [PERMISSIONS.CREATE, PERMISSIONS.READ, PERMISSIONS.UPDATE],
  viewer: [PERMISSIONS.READ],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
  role: MemberRole | string,
  permission: Permission
): boolean {
  const permissions = ROLE_PERMISSIONS[role as MemberRole];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: MemberRole | string): Permission[] {
  return ROLE_PERMISSIONS[role as MemberRole] || [];
}

/**
 * Check if a role can manage another role (hierarchy check)
 * Owners can manage all, admins can manage members/viewers, etc.
 */
export function canManageRole(
  managerRole: MemberRole | string,
  targetRole: MemberRole | string
): boolean {
  const hierarchy: Record<MemberRole, number> = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };

  const managerLevel = hierarchy[managerRole as MemberRole] || 0;
  const targetLevel = hierarchy[targetRole as MemberRole] || 0;

  // Can only manage roles below your level
  return managerLevel > targetLevel;
}
