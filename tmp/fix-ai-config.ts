import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  // Show current settings
  const settings = await prisma.aiProviderSetting.findMany({
    select: { id: true, organization_id: true, provider: true, model: true, is_active: true }
  });
  console.log('Current AI Settings:', JSON.stringify(settings, null, 2));

  if (settings.length === 0) {
    console.log('No AI settings found — nothing to update.');
    return;
  }

  // Fix all records: Vertex AI with correct model IDs, no API key
  for (const setting of settings) {
    await prisma.aiProviderSetting.update({
      where: { id: setting.id },
      data: {
        provider: 'vertex',
        model: 'gemini-1.5-flash-002',
        api_key_encrypted: null,
        vision_provider: 'vertex',
        vision_model: 'gemini-1.5-flash-002',
        vision_api_key_encrypted: null,
        whatsapp_provider: 'vertex',
        whatsapp_model: 'gemini-1.5-flash-002',
        whatsapp_api_key_encrypted: null,
        lessons_provider: 'vertex',
        lessons_model: 'gemini-1.5-pro-002',
        is_active: true,
      }
    });
    console.log(`✅ Updated AI settings for org: ${setting.organization_id}`);
  }
  console.log('All done!');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
