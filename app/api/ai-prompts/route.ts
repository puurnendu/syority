import { NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/withTenantGuard';
import {
  getAllPrompts,
  upsertPromptTemplate,
  resetPromptToDefault,
  type AiJobType,
} from '@/services/ai/AiPromptService';

// GET — list all prompts for org (merged with defaults)
export const GET = withTenantGuard(async (_req, _ctx, session) => {
  const orgId = session.user.organization_id;
  const prompts = await getAllPrompts(orgId);
  return NextResponse.json({ data: prompts });
});

// PUT — save or reset a prompt
export const PUT = withTenantGuard(async (req, _ctx, session) => {
  const orgId = session.user.organization_id;
  const userId = session.user.id;
  const body = await req.json();

  const { job_type, prompt_template, reset } = body as {
    job_type: AiJobType;
    prompt_template?: string;
    reset?: boolean;
  };

  if (!job_type) {
    return NextResponse.json({ error: 'job_type is required' }, { status: 400 });
  }

  if (reset) {
    await resetPromptToDefault(orgId, job_type);
    return NextResponse.json({ success: true, message: 'Reset to default' });
  }

  if (!prompt_template?.trim()) {
    return NextResponse.json({ error: 'prompt_template is required' }, { status: 400 });
  }

  const record = await upsertPromptTemplate(orgId, job_type, prompt_template, userId);
  return NextResponse.json({ data: record });
});
