import { describe, it, expect } from 'vitest';
import {
  roleHasPermission,
  getPermissionsForRole,
  canManageRole,
  PERMISSIONS,
  ROLE_PERMISSIONS,
} from '@/lib/auth/permissions';

describe('PERMISSIONS', () => {
  it('should define all expected permissions', () => {
    expect(PERMISSIONS.CREATE).toBe('create');
    expect(PERMISSIONS.READ).toBe('read');
    expect(PERMISSIONS.UPDATE).toBe('update');
    expect(PERMISSIONS.DELETE).toBe('delete');
    expect(PERMISSIONS.MANAGE_MEMBERS).toBe('manage_members');
    expect(PERMISSIONS.MANAGE_KEYS).toBe('manage_keys');
  });
});

describe('ROLE_PERMISSIONS', () => {
  it('should define permissions for all roles', () => {
    expect(ROLE_PERMISSIONS.owner).toBeDefined();
    expect(ROLE_PERMISSIONS.admin).toBeDefined();
    expect(ROLE_PERMISSIONS.member).toBeDefined();
    expect(ROLE_PERMISSIONS.viewer).toBeDefined();
  });

  it('owner should have all permissions', () => {
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.CREATE);
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.READ);
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.UPDATE);
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.DELETE);
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.MANAGE_MEMBERS);
    expect(ROLE_PERMISSIONS.owner).toContain(PERMISSIONS.MANAGE_KEYS);
  });

  it('admin should have most permissions except MANAGE_MEMBERS', () => {
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.CREATE);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.READ);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.UPDATE);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.DELETE);
    expect(ROLE_PERMISSIONS.admin).toContain(PERMISSIONS.MANAGE_KEYS);
    expect(ROLE_PERMISSIONS.admin).not.toContain(PERMISSIONS.MANAGE_MEMBERS);
  });

  it('member should have CREATE, READ, UPDATE only', () => {
    expect(ROLE_PERMISSIONS.member).toContain(PERMISSIONS.CREATE);
    expect(ROLE_PERMISSIONS.member).toContain(PERMISSIONS.READ);
    expect(ROLE_PERMISSIONS.member).toContain(PERMISSIONS.UPDATE);
    expect(ROLE_PERMISSIONS.member).not.toContain(PERMISSIONS.DELETE);
    expect(ROLE_PERMISSIONS.member).not.toContain(PERMISSIONS.MANAGE_MEMBERS);
    expect(ROLE_PERMISSIONS.member).not.toContain(PERMISSIONS.MANAGE_KEYS);
  });

  it('viewer should only have READ permission', () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual([PERMISSIONS.READ]);
  });
});

describe('roleHasPermission', () => {
  describe('owner role', () => {
    it('should have all permissions', () => {
      expect(roleHasPermission('owner', PERMISSIONS.CREATE)).toBe(true);
      expect(roleHasPermission('owner', PERMISSIONS.READ)).toBe(true);
      expect(roleHasPermission('owner', PERMISSIONS.UPDATE)).toBe(true);
      expect(roleHasPermission('owner', PERMISSIONS.DELETE)).toBe(true);
      expect(roleHasPermission('owner', PERMISSIONS.MANAGE_MEMBERS)).toBe(true);
      expect(roleHasPermission('owner', PERMISSIONS.MANAGE_KEYS)).toBe(true);
    });
  });

  describe('admin role', () => {
    it('should have most permissions', () => {
      expect(roleHasPermission('admin', PERMISSIONS.CREATE)).toBe(true);
      expect(roleHasPermission('admin', PERMISSIONS.READ)).toBe(true);
      expect(roleHasPermission('admin', PERMISSIONS.UPDATE)).toBe(true);
      expect(roleHasPermission('admin', PERMISSIONS.DELETE)).toBe(true);
      expect(roleHasPermission('admin', PERMISSIONS.MANAGE_KEYS)).toBe(true);
    });

    it('should not have MANAGE_MEMBERS permission', () => {
      expect(roleHasPermission('admin', PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
    });
  });

  describe('member role', () => {
    it('should have CREATE, READ, UPDATE permissions', () => {
      expect(roleHasPermission('member', PERMISSIONS.CREATE)).toBe(true);
      expect(roleHasPermission('member', PERMISSIONS.READ)).toBe(true);
      expect(roleHasPermission('member', PERMISSIONS.UPDATE)).toBe(true);
    });

    it('should not have DELETE, MANAGE_MEMBERS, or MANAGE_KEYS permissions', () => {
      expect(roleHasPermission('member', PERMISSIONS.DELETE)).toBe(false);
      expect(roleHasPermission('member', PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
      expect(roleHasPermission('member', PERMISSIONS.MANAGE_KEYS)).toBe(false);
    });
  });

  describe('viewer role', () => {
    it('should only have READ permission', () => {
      expect(roleHasPermission('viewer', PERMISSIONS.READ)).toBe(true);
    });

    it('should not have any other permissions', () => {
      expect(roleHasPermission('viewer', PERMISSIONS.CREATE)).toBe(false);
      expect(roleHasPermission('viewer', PERMISSIONS.UPDATE)).toBe(false);
      expect(roleHasPermission('viewer', PERMISSIONS.DELETE)).toBe(false);
      expect(roleHasPermission('viewer', PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
      expect(roleHasPermission('viewer', PERMISSIONS.MANAGE_KEYS)).toBe(false);
    });
  });

  describe('invalid role', () => {
    it('should return false for unknown role', () => {
      expect(roleHasPermission('unknown', PERMISSIONS.READ)).toBe(false);
      expect(roleHasPermission('superuser', PERMISSIONS.CREATE)).toBe(false);
    });
  });
});

describe('getPermissionsForRole', () => {
  it('should return all permissions for owner', () => {
    const permissions = getPermissionsForRole('owner');
    expect(permissions).toHaveLength(6);
    expect(permissions).toEqual(ROLE_PERMISSIONS.owner);
  });

  it('should return correct permissions for admin', () => {
    const permissions = getPermissionsForRole('admin');
    expect(permissions).toHaveLength(5);
    expect(permissions).toEqual(ROLE_PERMISSIONS.admin);
  });

  it('should return correct permissions for member', () => {
    const permissions = getPermissionsForRole('member');
    expect(permissions).toHaveLength(3);
    expect(permissions).toEqual(ROLE_PERMISSIONS.member);
  });

  it('should return correct permissions for viewer', () => {
    const permissions = getPermissionsForRole('viewer');
    expect(permissions).toHaveLength(1);
    expect(permissions).toEqual([PERMISSIONS.READ]);
  });

  it('should return empty array for unknown role', () => {
    const permissions = getPermissionsForRole('unknown');
    expect(permissions).toEqual([]);
  });
});

describe('canManageRole', () => {
  describe('owner managing other roles', () => {
    it('should be able to manage admin', () => {
      expect(canManageRole('owner', 'admin')).toBe(true);
    });

    it('should be able to manage member', () => {
      expect(canManageRole('owner', 'member')).toBe(true);
    });

    it('should be able to manage viewer', () => {
      expect(canManageRole('owner', 'viewer')).toBe(true);
    });

    it('should not be able to manage another owner', () => {
      expect(canManageRole('owner', 'owner')).toBe(false);
    });
  });

  describe('admin managing other roles', () => {
    it('should be able to manage member', () => {
      expect(canManageRole('admin', 'member')).toBe(true);
    });

    it('should be able to manage viewer', () => {
      expect(canManageRole('admin', 'viewer')).toBe(true);
    });

    it('should not be able to manage owner', () => {
      expect(canManageRole('admin', 'owner')).toBe(false);
    });

    it('should not be able to manage another admin', () => {
      expect(canManageRole('admin', 'admin')).toBe(false);
    });
  });

  describe('member managing other roles', () => {
    it('should be able to manage viewer', () => {
      expect(canManageRole('member', 'viewer')).toBe(true);
    });

    it('should not be able to manage another member', () => {
      expect(canManageRole('member', 'member')).toBe(false);
    });

    it('should not be able to manage admin', () => {
      expect(canManageRole('member', 'admin')).toBe(false);
    });

    it('should not be able to manage owner', () => {
      expect(canManageRole('member', 'owner')).toBe(false);
    });
  });

  describe('viewer managing other roles', () => {
    it('should not be able to manage any role', () => {
      expect(canManageRole('viewer', 'viewer')).toBe(false);
      expect(canManageRole('viewer', 'member')).toBe(false);
      expect(canManageRole('viewer', 'admin')).toBe(false);
      expect(canManageRole('viewer', 'owner')).toBe(false);
    });
  });

  describe('unknown roles', () => {
    it('should return false for unknown manager role', () => {
      expect(canManageRole('unknown', 'viewer')).toBe(false);
    });

    it('should return false for unknown target role', () => {
      expect(canManageRole('owner', 'unknown')).toBe(true); // unknown has level 0, owner is 4
    });
  });
});
