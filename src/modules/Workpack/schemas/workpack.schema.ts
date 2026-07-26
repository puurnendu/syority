import { z } from 'zod';

export const WorkpackSchema = z.object({
    title: z.string().min(3),
    organization_id: z.string().uuid(),
    site_id: z.string().uuid(),
    work_type: z.string().optional(),
    priority: z.string().default('Normal'),
    scope_of_work: z.string().optional(),
    created_by: z.string().uuid(),
});
