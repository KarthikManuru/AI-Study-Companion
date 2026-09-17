import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assertSpaceOwnership, assertProjectOwnership } from '@/lib/db/ownership';
import prisma from '@/lib/db/prisma';

vi.mock('@/lib/db/prisma', () => ({
  default: {
    space: {
      findFirst: vi.fn(),
    },
    project: {
      findFirst: vi.fn(),
    },
  },
}));

describe('Data Isolation & Ownership Assertions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertSpaceOwnership', () => {
    it('allows owner to access their own space', async () => {
      (prisma.space.findFirst as any).mockResolvedValue({
        id: 'space-1',
      });

      await expect(assertSpaceOwnership('user-1', 'space-1')).resolves.not.toThrow();
    });

    it('denies access and throws error when space belongs to another user', async () => {
      // findFirst with where: { id: 'space-1', userId: 'attacker-user' } returns null
      (prisma.space.findFirst as any).mockResolvedValue(null);

      await expect(assertSpaceOwnership('attacker-user', 'space-1')).rejects.toThrow(
        'Space not found or access denied'
      );
    });

    it('throws error when space does not exist', async () => {
      (prisma.space.findFirst as any).mockResolvedValue(null);

      await expect(assertSpaceOwnership('user-1', 'nonexistent')).rejects.toThrow(
        'Space not found or access denied'
      );
    });
  });

  describe('assertProjectOwnership', () => {
    it('allows owner to access their project through space relationship', async () => {
      (prisma.project.findFirst as any).mockResolvedValue({
        id: 'project-1',
        spaceId: 'space-1',
        name: 'Test Project',
        space: { userId: 'user-1' },
      });

      await expect(assertProjectOwnership('user-1', 'project-1')).resolves.not.toThrow();
    });

    it('blocks foreign user from reading or modifying another user project', async () => {
      (prisma.project.findFirst as any).mockResolvedValue(null);

      await expect(assertProjectOwnership('attacker-user', 'project-1')).rejects.toThrow(
        'Project not found or access denied'
      );
    });
  });
});
