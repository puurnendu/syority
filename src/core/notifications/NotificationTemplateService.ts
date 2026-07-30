/**
 * NotificationTemplateService — CRUD + rendering for notification templates.
 *
 * Templates use {{variable}} placeholders. The render engine substitutes
 * values and supports basic {{#if var}}...{{/if}} conditionals.
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// ─── Template Rendering ────────────────────────────────────────────────────────

/**
 * Render a template string by substituting {{variable}} placeholders.
 *
 * Supports:
 * - {{variable}} — simple substitution
 * - {{#if variable}}...{{/if}} — conditional blocks
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string | number | boolean | null | undefined>
): string {
  // 1. Process conditionals: {{#if var}}content{{/if}}
  let result = template.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, key, content) => {
      const val = variables[key];
      return val && val !== '' && val !== false ? content : '';
    }
  );

  // 2. Simple variable substitution: {{variable}}
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (match, key) => {
      const val = variables[key];
      return val !== undefined && val !== null ? String(val) : match;
    }
  );

  return result;
}

/**
 * Get the base HTML email template wrapper.
 * Used to wrap rendered email content in the AURIANOA brand.
 */
export function getBaseEmailWrapper(content: string, orgName?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AURIANOA OS</title></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:580px;margin:32px auto;background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
<div style="background:#0D2137;padding:24px 32px;">
<span style="color:#FFFFFF;font-size:18px;font-weight:700;letter-spacing:2px;">AURIANOA</span>
<span style="color:rgba(255,255,255,0.4);font-size:11px;margin-left:4px;">OS</span>
${orgName ? `<div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px;">${orgName}</div>` : ''}
</div>
<div style="height:3px;background:linear-gradient(90deg,#E8701A,#F59E0B);"></div>
<div style="padding:32px;">${content}</div>
<div style="padding:20px 32px;background:#F9FAFB;border-top:1px solid #E5E7EB;">
<p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center;line-height:1.6;">
AURIANOA OS — Industrial Workpack Management<br>
${orgName ? `Sent on behalf of ${orgName}. ` : ''}Do not reply to this email.</p>
</div>
</div>
</body>
</html>`;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Supported template categories.
 */
export const TEMPLATE_CATEGORIES = [
  'authentication',
  'planning',
  'execution',
  'reports',
  'platform',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export interface CreateTemplateInput {
  slug: string;
  category: string;
  name: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables?: string[];
  created_by?: string;
}

export interface UpdateTemplateInput extends Partial<Omit<CreateTemplateInput, 'slug'>> {
  updated_by?: string;
}

export class NotificationTemplateService {
  /**
   * List templates, optionally filtered by category.
   */
  static async list(filters?: { category?: string; is_active?: boolean }) {
    return prisma.notification_templates.findMany({
      where: {
        ...(filters?.category ? { category: filters.category } : {}),
        ...(filters?.is_active !== undefined ? { is_active: filters.is_active } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Get a template by ID.
   */
  static async getById(id: string) {
    return prisma.notification_templates.findUnique({ where: { id } });
  }

  /**
   * Get a template by slug.
   */
  static async getBySlug(slug: string) {
    return prisma.notification_templates.findUnique({ where: { slug } });
  }

  /**
   * Create a new template.
   */
  static async create(input: CreateTemplateInput) {
    const template = await prisma.notification_templates.create({
      data: {
        slug: input.slug,
        category: input.category,
        name: input.name,
        subject: input.subject,
        html_body: input.html_body,
        text_body: input.text_body ?? null,
        variables: input.variables ?? [],
        created_by: input.created_by,
      },
    });

    logger.info('NotificationTemplate', `Created template: ${template.name} (${template.slug})`, { id: template.id });
    return template;
  }

  /**
   * Update an existing template. Increments version automatically.
   */
  static async update(id: string, input: UpdateTemplateInput) {
    const existing = await prisma.notification_templates.findUnique({ where: { id } });
    if (!existing) throw new Error('Template not found');

    const template = await prisma.notification_templates.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.html_body !== undefined && { html_body: input.html_body }),
        ...(input.text_body !== undefined && { text_body: input.text_body }),
        ...(input.variables !== undefined && { variables: input.variables }),
        version: existing.version + 1,
        updated_by: input.updated_by,
      },
    });

    logger.info('NotificationTemplate', `Updated template: ${template.name} v${template.version}`, { id: template.id });
    return template;
  }

  /**
   * Delete a template.
   */
  static async delete(id: string) {
    // Check if any rules reference this template
    const ruleCount = await prisma.notification_rules.count({ where: { template_id: id } });
    if (ruleCount > 0) {
      throw new Error(`Cannot delete template: ${ruleCount} notification rule(s) still reference it.`);
    }

    await prisma.notification_templates.delete({ where: { id } });
    logger.info('NotificationTemplate', `Deleted template`, { id });
  }

  /**
   * Preview a template with sample variables.
   */
  static async preview(
    id: string,
    sampleVariables?: Record<string, string>
  ): Promise<{ subject: string; html: string; text: string }> {
    const template = await prisma.notification_templates.findUnique({ where: { id } });
    if (!template) throw new Error('Template not found');

    // Build sample data for all declared variables
    const vars: Record<string, string> = {};
    const declaredVars = (template.variables as string[]) ?? [];
    for (const v of declaredVars) {
      vars[v] = sampleVariables?.[v] ?? `[${v}]`;
    }
    // Merge any extra provided variables
    if (sampleVariables) Object.assign(vars, sampleVariables);

    const subject = renderTemplate(template.subject, vars);
    const htmlContent = renderTemplate(template.html_body, vars);
    const html = getBaseEmailWrapper(htmlContent, vars.company ?? 'Sample Organisation');
    const text = renderTemplate(template.text_body ?? template.html_body.replace(/<[^>]*>/g, ' ').trim(), vars);

    return { subject, html, text };
  }

  /**
   * Render a template by slug with actual variables.
   * Used by the rule engine during notification dispatch.
   */
  static async renderBySlug(
    slug: string,
    variables: Record<string, string>,
    options?: { wrapInBase?: boolean; orgName?: string }
  ): Promise<{ subject: string; html: string; text: string } | null> {
    const template = await prisma.notification_templates.findUnique({
      where: { slug },
    });
    if (!template || !template.is_active) return null;

    const subject = renderTemplate(template.subject, variables);
    let html = renderTemplate(template.html_body, variables);
    if (options?.wrapInBase !== false) {
      html = getBaseEmailWrapper(html, options?.orgName);
    }
    const text = renderTemplate(
      template.text_body ?? template.html_body.replace(/<[^>]*>/g, ' ').trim(),
      variables
    );

    return { subject, html, text };
  }
}
