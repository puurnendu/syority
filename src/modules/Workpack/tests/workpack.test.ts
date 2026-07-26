import { describe, it, expect } from 'vitest';
import { WorkpackSchema } from '../schemas/workpack.schema';

describe('Workpack Zod Validation', () => {
    it('should validate a correct workpack payload', () => {
        const validData = {
            title: 'Valid Workpack',
            organization_id: '123e4567-e89b-12d3-a456-426614174000',
            site_id: '123e4567-e89b-12d3-a456-426614174001',
            created_by: '123e4567-e89b-12d3-a456-426614174002',
        };

        const result = WorkpackSchema.safeParse(validData);
        expect(result.success).toBe(true);
    });

    it('should fail validation when title is too short', () => {
        const invalidData = {
            title: 'A', // Too short
            organization_id: '123e4567-e89b-12d3-a456-426614174000',
            site_id: '123e4567-e89b-12d3-a456-426614174001',
            created_by: '123e4567-e89b-12d3-a456-426614174002',
        };

        const result = WorkpackSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
    });
});
