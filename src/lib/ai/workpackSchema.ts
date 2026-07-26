import { z } from 'zod';

export const disciplineEnum = z.enum([
    'mechanical',
    'piping',
    'inspection',
    'scaffolding',
    'safety',
    'electrical',
    'instrumentation',
    'insulation',
    'civil',
    'painting',
]);

export const aiWorkpackActivitySchema = z.object({
    activity_id: z.string(),
    title: z.string(),
    discipline: z.string(),
    description: z.string(),
    sequence: z.number().int().positive(),
    estimated_manhours: z.number().nonnegative(),
    crew_size: z.number().int().positive().optional(),
    tools_required: z.array(z.string()).optional(),
    safety_requirements: z.array(z.string()).optional(),
    predecessors: z.array(z.string()).optional(),
});

export const aiWorkpackMaterialSchema = z.object({
    item: z.string(),
    specification: z.string().optional(),
    quantity: z.number().nonnegative(),
    unit: z.string().optional(),
});

export const aiWorkpackConstraintSchema = z.object({
    description: z.string(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    type: z.string().optional(),
});

export const aiWorkpackBlindSchema = z.object({
    tag_no: z.string().optional(),
    line_number: z.string(),
    size: z.string(),
    rating: z.string().optional(),
    location: z.string().optional(),
    type: z.enum(['spectacle', 'spade', 'paddle']).optional(),
});

export const aiWorkpackQaRequirementSchema = z.object({
    inspection_type: z.string(),
    standard: z.string(),
    description: z.string().optional(),
    acceptance_criteria: z.string().optional(),
});

export const aiWorkpackResponseSchema = z.object({
    scope_of_work: z.string(),
    activities: z.array(aiWorkpackActivitySchema),
    materials: z.array(aiWorkpackMaterialSchema),
    constraints: z.array(aiWorkpackConstraintSchema),
    blinds: z.array(aiWorkpackBlindSchema),
    qa_requirements: z.union([
        z.string(),
        z.array(aiWorkpackQaRequirementSchema),
    ]),
    estimated_total_manhours: z.number().nonnegative(),
});

export type AiWorkpackActivity = z.infer<typeof aiWorkpackActivitySchema>;
export type AiWorkpackMaterial = z.infer<typeof aiWorkpackMaterialSchema>;
export type AiWorkpackConstraint = z.infer<typeof aiWorkpackConstraintSchema>;
export type AiWorkpackBlind = z.infer<typeof aiWorkpackBlindSchema>;
export type AiWorkpackQaRequirement = z.infer<typeof aiWorkpackQaRequirementSchema>;
export type AiWorkpackResponse = z.infer<typeof aiWorkpackResponseSchema>;

export function validateAiWorkpackResponse(raw: unknown): AiWorkpackResponse {
    return aiWorkpackResponseSchema.parse(raw);
}
