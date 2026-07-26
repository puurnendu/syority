/**
 * One-shot fix: sync AiProviderSetting.api_key_encrypted with env ANTHROPIC_API_KEY.
 * Run once: node scripts/fix-ai-key.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const envKey = process.env.ANTHROPIC_API_KEY?.trim();

if (!envKey || !envKey.startsWith('sk-ant-')) {
    console.error('ANTHROPIC_API_KEY not set or invalid in .env');
    process.exit(1);
}

const rows = await prisma.aiProviderSetting.findMany({
    where: { provider: 'anthropic' },
    select: { id: true, organization_id: true, api_key_encrypted: true, is_active: true },
});

console.log(`Found ${rows.length} Anthropic provider row(s).`);

for (const row of rows) {
    const current = row.api_key_encrypted?.trim();
    if (current?.startsWith('sk-ant-') && current.length > 30) {
        console.log(`  org=${row.organization_id} — key already valid, skipping.`);
        continue;
    }
    await prisma.aiProviderSetting.update({
        where: { id: row.id },
        data: {
            api_key_encrypted: envKey,
            provider: 'anthropic',
            model: 'claude-sonnet-4-6',
            is_active: true,
        },
    });
    console.log(`  org=${row.organization_id} — updated stale key → env key.`);
}

await prisma.$disconnect();
console.log('Done.');
