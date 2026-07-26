'use server';

import { WorkpackService } from '../Services/WorkpackService';
import { WorkpackSchema } from '../schemas/workpack.schema';
import { z } from 'zod';

export async function createWorkpackAction(data: z.infer<typeof WorkpackSchema>) {
    try {
        const result = await WorkpackService.createWorkpack(data);
        return { success: true, data: result };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
