import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export class ProjectCommunicationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectCommunicationError';
  }
}

/**
 * Project-scoped notes / distribution log. Not WhatsApp, not M16, not STO comms.
 */
export class ProjectCommunicationService {
  static async list(organizationId: string, projectId: string, db: typeof prisma = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new ProjectCommunicationError('Project not found');
    return db.projectCommunication.findMany({
      where: { organization_id: organizationId, project_id: projectId },
      orderBy: { created_at: 'desc' },
    });
  }

  static async create(
    organizationId: string,
    projectId: string,
    input: { type?: string; subject: string; body?: string | null; created_by?: string | null },
    db: typeof prisma = prisma
  ) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true },
    });
    if (!project) throw new ProjectCommunicationError('Project not found');
    const subject = input.subject.trim();
    if (!subject) throw new ProjectCommunicationError('subject is required');
    return db.projectCommunication.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        project_id: projectId,
        type: input.type?.trim() || 'note',
        subject,
        body: input.body?.trim() || null,
        created_by: input.created_by ?? null,
      },
    });
  }
}
