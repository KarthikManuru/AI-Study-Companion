import prisma from './prisma';

/**
 * Asserts that the given user owns the space.
 * Throws if the space doesn't exist or doesn't belong to the user.
 */
export async function assertSpaceOwnership(userId: string, spaceId: string) {
  const space = await prisma.space.findFirst({
    where: { id: spaceId, userId },
    select: { id: true },
  });
  if (!space) {
    throw new Error('Space not found or access denied');
  }
  return space;
}

/**
 * Asserts that the given user owns the project (through space ownership).
 * Returns the project with its space for further use.
 */
export async function assertProjectOwnership(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      space: { userId },
    },
    select: {
      id: true,
      spaceId: true,
      name: true,
      space: { select: { userId: true } },
    },
  });
  if (!project) {
    throw new Error('Project not found or access denied');
  }
  return project;
}

/**
 * Asserts that the given user owns the conversation (through project→space ownership).
 */
export async function assertConversationOwnership(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      userId,
      project: { space: { userId } },
    },
    select: { id: true, projectId: true },
  });
  if (!conversation) {
    throw new Error('Conversation not found or access denied');
  }
  return conversation;
}

/**
 * Gets all project IDs for a given user (for scoped queries).
 */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { space: { userId } },
    select: { id: true },
  });
  return projects.map((p) => p.id);
}
