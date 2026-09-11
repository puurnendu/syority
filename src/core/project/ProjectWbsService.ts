import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { WbsNodeType } from '@prisma/client';

type Db = typeof prisma;

export class ProjectWbsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectWbsError';
  }
}

export type WbsCreateInput = {
  parent_id?: string | null;
  code?: string;
  name: string;
  order?: number;
};

export type WbsNodeDto = {
  id: string;
  organization_id: string;
  project_id: string | null;
  event_id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  type: WbsNodeType;
  order: number;
  locked: boolean;
  depth: number;
  children?: WbsNodeDto[];
};

/**
 * Project-owned WBS. Queries always include organization_id + project_id.
 * Never reads or writes event_id on Project nodes. Never calls prisma.event.
 */
export class ProjectWbsService {
  static async assertProject(organizationId: string, projectId: string, db: Db = prisma) {
    const project = await db.project.findFirst({
      where: { id: projectId, org_id: organizationId },
      select: { id: true, org_id: true, name: true },
    });
    if (!project) throw new ProjectWbsError('Project not found');
    return project;
  }

  static async list(organizationId: string, projectId: string, db: Db = prisma) {
    await this.assertProject(organizationId, projectId, db);
    const nodes = await db.wbsNode.findMany({
      where: { organization_id: organizationId, project_id: projectId },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    });
    const depths = this.computeDepths(nodes);
    const decorated = nodes.map((n) => ({ ...n, depth: depths.get(n.id) ?? 0 }));
    return { flat: decorated, tree: this.buildTree(decorated) };
  }

  static async create(organizationId: string, projectId: string, input: WbsCreateInput, db: Db = prisma) {
    await this.assertProject(organizationId, projectId, db);
    const name = input.name.trim();
    if (!name) throw new ProjectWbsError('name is required');

    let parentId = input.parent_id ?? null;
    if (parentId) {
      const parent = await db.wbsNode.findFirst({
        where: { id: parentId, organization_id: organizationId, project_id: projectId },
        select: { id: true },
      });
      if (!parent) throw new ProjectWbsError('Parent node not found in this project');
    }

    const siblings = await db.wbsNode.count({
      where: { organization_id: organizationId, project_id: projectId, parent_id: parentId },
    });
    const order = input.order ?? siblings;
    const code = (input.code?.trim() || this.suggestCode(parentId, siblings + 1));

    return db.wbsNode.create({
      data: {
        id: randomUUID(),
        organization_id: organizationId,
        project_id: projectId,
        event_id: null,
        parent_id: parentId,
        code,
        name,
        type: WbsNodeType.CUSTOM,
        order,
        updated_at: new Date(),
      },
    });
  }

  static async update(
    organizationId: string,
    projectId: string,
    nodeId: string,
    input: { name?: string; code?: string; parent_id?: string | null; order?: number },
    db: Db = prisma
  ) {
    const node = await this.requireNode(organizationId, projectId, nodeId, db);
    if (node.locked) throw new ProjectWbsError('Cannot modify a locked node');

    if (input.parent_id !== undefined && input.parent_id !== null) {
      if (input.parent_id === nodeId) throw new ProjectWbsError('Cannot set parent to self');
      const parent = await db.wbsNode.findFirst({
        where: { id: input.parent_id, organization_id: organizationId, project_id: projectId },
        select: { id: true, parent_id: true },
      });
      if (!parent) throw new ProjectWbsError('Parent node not found in this project');
      if (await this.wouldCycle(organizationId, projectId, nodeId, input.parent_id, db)) {
        throw new ProjectWbsError('Parent change would create a cycle');
      }
    }

    return db.wbsNode.update({
      where: { id: nodeId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.code !== undefined ? { code: input.code.trim() } : {}),
        ...(input.parent_id !== undefined ? { parent_id: input.parent_id } : {}),
        ...(input.order !== undefined ? { order: input.order } : {}),
        updated_at: new Date(),
      },
    });
  }

  static async remove(organizationId: string, projectId: string, nodeId: string, db: Db = prisma) {
    const node = await this.requireNode(organizationId, projectId, nodeId, db);
    if (node.locked) throw new ProjectWbsError('Cannot delete a locked node');
    await this.deleteRecursive(organizationId, projectId, nodeId, db);
  }

  static async reorder(
    organizationId: string,
    projectId: string,
    orderedIds: string[],
    parentId: string | null,
    db: Db = prisma
  ) {
    await this.assertProject(organizationId, projectId, db);
    const siblings = await db.wbsNode.findMany({
      where: { organization_id: organizationId, project_id: projectId, parent_id: parentId },
      select: { id: true },
    });
    const allowed = new Set(siblings.map((s) => s.id));
    if (orderedIds.some((id) => !allowed.has(id))) {
      throw new ProjectWbsError('Reorder set is not the full sibling group');
    }
    await db.$transaction(
      orderedIds.map((id, index) =>
        db.wbsNode.update({
          where: { id },
          data: { order: index, updated_at: new Date() },
        })
      )
    );
  }

  private static async requireNode(organizationId: string, projectId: string, nodeId: string, db: Db = prisma) {
    const node = await db.wbsNode.findFirst({
      where: { id: nodeId, organization_id: organizationId, project_id: projectId },
    });
    if (!node) throw new ProjectWbsError('WBS node not found');
    return node;
  }

  private static async deleteRecursive(organizationId: string, projectId: string, nodeId: string, db: Db = prisma) {
    const children = await db.wbsNode.findMany({
      where: { parent_id: nodeId, organization_id: organizationId, project_id: projectId },
      select: { id: true, locked: true },
    });
    for (const child of children) {
      if (child.locked) throw new ProjectWbsError('Cannot delete: a child node is locked');
      await this.deleteRecursive(organizationId, projectId, child.id, db);
    }
    await db.wbsNode.delete({ where: { id: nodeId } });
  }

  private static async wouldCycle(
    organizationId: string,
    projectId: string,
    nodeId: string,
    newParentId: string,
    db: Db = prisma
  ): Promise<boolean> {
    let cursor: string | null = newParentId;
    const seen = new Set<string>();
    while (cursor) {
      if (cursor === nodeId) return true;
      if (seen.has(cursor)) return true;
      seen.add(cursor);
      const parent: { parent_id: string | null } | null = await db.wbsNode.findFirst({
        where: { id: cursor, organization_id: organizationId, project_id: projectId },
        select: { parent_id: true },
      });
      cursor = parent?.parent_id ?? null;
    }
    return false;
  }

  private static computeDepths(nodes: { id: string; parent_id: string | null }[]): Map<string, number> {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const depths = new Map<string, number>();
    const depthOf = (id: string): number => {
      if (depths.has(id)) return depths.get(id)!;
      const node = byId.get(id);
      if (!node || !node.parent_id || !byId.has(node.parent_id)) {
        depths.set(id, 0);
        return 0;
      }
      const d = depthOf(node.parent_id) + 1;
      depths.set(id, d);
      return d;
    };
    for (const n of nodes) depthOf(n.id);
    return depths;
  }

  private static buildTree<T extends { id: string; parent_id: string | null }>(nodes: T[]): (T & { children: T[] })[] {
    const map = new Map<string, T & { children: T[] }>();
    nodes.forEach((n) => map.set(n.id, { ...n, children: [] }));
    const tree: (T & { children: T[] })[] = [];
    nodes.forEach((n) => {
      const cur = map.get(n.id)!;
      if (n.parent_id && map.has(n.parent_id)) map.get(n.parent_id)!.children.push(cur);
      else tree.push(cur);
    });
    return tree;
  }

  private static suggestCode(parentId: string | null, siblingIndex: number) {
    return parentId ? `${siblingIndex}` : `${siblingIndex}`;
  }
}
