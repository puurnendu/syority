import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { AuditService } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

export type UserListParams = {
    search?: string;
    page?: number;
    pageSize?: number;
    is_active?: boolean | null;
};

const userListInclude = {
    site: { select: { id: true, name: true, code: true } },
    user_roles: {
        include: {
            role: { select: { id: true, name: true, slug: true } },
        },
    },
} satisfies Prisma.UserInclude;

function sanitizeUser<T extends { password?: string }>(user: T) {
    const { password: _pw, ...rest } = user;
    return rest;
}

export class UserService {
    static async list(orgId: string, params: UserListParams = {}) {
        const page = Math.max(1, Number(params.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 25));
        const search = typeof params.search === 'string' ? params.search.trim() : '';

        const where: Prisma.UserWhereInput = {
            organization_id: orgId,
            deleted_at: null,
        };

        if (params.is_active === true || params.is_active === false) {
            where.is_active = params.is_active;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { employee_id: { contains: search, mode: 'insensitive' } },
                { position: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [total, users] = await Promise.all([
            prisma.user.count({ where }),
            prisma.user.findMany({
                where,
                include: userListInclude,
                orderBy: { created_at: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);

        return {
            data: users.map(sanitizeUser),
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    }

    /** @deprecated Prefer list() — kept for callers expecting a flat array */
    static async getAll(orgId: string) {
        const result = await this.list(orgId, { page: 1, pageSize: 500 });
        return result.data;
    }

    static async create(orgId: string, data: any, creatorId: string) {
        const name = typeof data.name === 'string' ? data.name.trim() : '';
        const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
        const password = data.password != null ? String(data.password) : '';
        if (!name || !email || !password) {
            throw new Error('Name, email and password are required');
        }
        if (password.length < 8) {
            throw new Error('Password must be at least 8 characters');
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const siteId = data.site_id && String(data.site_id).trim() ? String(data.site_id).trim() : null;
        const employeeId =
            data.employee_id != null && String(data.employee_id).trim() !== ''
                ? String(data.employee_id).trim()
                : null;
        const position =
            data.position != null && String(data.position).trim() !== ''
                ? String(data.position).trim()
                : null;
        const phone =
            data.phone != null && String(data.phone).trim() !== '' ? String(data.phone).trim() : null;

        const user = await prisma.user.create({
            data: {
                id: randomUUID(),
                organization_id: orgId,
                email,
                password: hashedPassword,
                name,
                employee_id: employeeId,
                position,
                phone,
                site_id: siteId,
                is_active: data.is_active ?? true,
            },
            include: userListInclude,
        });

        const roleIds = Array.isArray(data.role_ids)
            ? data.role_ids.filter((id: any) => id != null && String(id).trim() !== '')
            : [];
        if (roleIds.length > 0) {
            await prisma.userRole.createMany({
                data: roleIds.map((roleId: string) => ({
                    id: randomUUID(),
                    organization_id: orgId,
                    user_id: user.id,
                    role_id: String(roleId),
                    assigned_by: creatorId,
                })),
            });
        }

        await AuditService.log({
            organization_id: orgId,
            user_id: creatorId,
            action: 'CREATE',
            model_name: 'User',
            model_id: user.id,
            new_values: { ...sanitizeUser(user), password: '[REDACTED]' },
        });

        const created = await prisma.user.findUnique({
            where: { id: user.id },
            include: userListInclude,
        });
        return sanitizeUser(created!);
    }

    static async update(id: string, orgId: string, data: any, updaterId: string) {
        const old = await prisma.user.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
            include: { user_roles: true },
        });
        if (!old) throw new Error('User not found');

        const updateData: Prisma.UserUpdateInput = {};

        if (data.name !== undefined) updateData.name = String(data.name).trim();
        if (data.employee_id !== undefined) {
            updateData.employee_id =
                data.employee_id != null && String(data.employee_id).trim() !== ''
                    ? String(data.employee_id).trim()
                    : null;
        }
        if (data.position !== undefined) {
            updateData.position =
                data.position != null && String(data.position).trim() !== ''
                    ? String(data.position).trim()
                    : null;
        }
        if (data.phone !== undefined) {
            updateData.phone =
                data.phone != null && String(data.phone).trim() !== ''
                    ? String(data.phone).trim()
                    : null;
        }
        if (data.site_id !== undefined) {
            updateData.site =
                data.site_id === '' || data.site_id == null
                    ? { disconnect: true }
                    : { connect: { id: String(data.site_id) } };
        }
        if (data.is_active !== undefined) {
            updateData.is_active = Boolean(data.is_active);
        }
        if (data.password) {
            if (String(data.password).length < 8) {
                throw new Error('Password must be at least 8 characters');
            }
            updateData.password = await bcrypt.hash(String(data.password), 12);
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updateData,
        });

        if (data.role_ids !== undefined) {
            await prisma.userRole.deleteMany({ where: { user_id: id } });
            const roleIds = Array.isArray(data.role_ids)
                ? data.role_ids.filter((rid: any) => rid != null && String(rid).trim() !== '')
                : [];
            if (roleIds.length > 0) {
                await prisma.userRole.createMany({
                    data: roleIds.map((roleId: string) => ({
                        id: randomUUID(),
                        organization_id: orgId,
                        user_id: id,
                        role_id: String(roleId),
                        assigned_by: updaterId,
                    })),
                });
            }
        }

        await AuditService.log({
            organization_id: orgId,
            user_id: updaterId,
            action: 'UPDATE',
            model_name: 'User',
            model_id: id,
            old_values: { ...sanitizeUser(old), password: '[REDACTED]' },
            new_values: { ...sanitizeUser(updated), password: '[REDACTED]' },
        });

        const fresh = await prisma.user.findUnique({
            where: { id },
            include: userListInclude,
        });
        return sanitizeUser(fresh!);
    }

    static async setActive(id: string, orgId: string, isActive: boolean, actorId: string) {
        return this.update(id, orgId, { is_active: isActive }, actorId);
    }

    /** Soft-delete: sets deleted_at and deactivates. */
    static async delete(id: string, orgId: string, actorId: string) {
        const existing = await prisma.user.findFirst({
            where: { id, organization_id: orgId, deleted_at: null },
        });
        if (!existing) throw new Error('User not found');
        if (existing.id === actorId) {
            throw new Error('You cannot delete your own account');
        }

        const deleted = await prisma.user.update({
            where: { id },
            data: {
                deleted_at: new Date(),
                is_active: false,
                email: `deleted_${Date.now()}_${existing.email}`,
            },
        });

        await AuditService.log({
            organization_id: orgId,
            user_id: actorId,
            action: 'DELETE',
            model_name: 'User',
            model_id: id,
            old_values: { ...sanitizeUser(existing), password: '[REDACTED]' },
        });

        return sanitizeUser(deleted);
    }
}
