import * as dotenv from 'dotenv';
dotenv.config();
import { ExecutionWriteService } from './src/core/execution/ExecutionWriteService';
import { prisma } from './src/lib/prisma';
async function test() {
  const org = await prisma.organization.findFirst();
  if (!org) throw new Error('No org found');
  const user = await prisma.user.findFirst({ where: { organization_id: org.id }});
  if (!user) throw new Error('No user found');
  const activity = await prisma.activity.findFirst({ where: { workpack: { event: { organization_id: org.id } } } });
  if (!activity) { console.log('No activity found'); return; }
  
  console.log('Testing update on activity:', activity.id);
  
  try {
    const result = await ExecutionWriteService.applyAction(
      org.id,
      user.id,
      {
        activityId: activity.id,
        action: 'UPDATE_PROGRESS',
        progress: 50,
        notes: 'Test via WhatsApp route logic'
      },
      { source_channel: 'whatsapp' }
    );
    console.log(`Activity ${result.activity.id} released by ${user.email} in ${org.name}`);
  } catch(e) {
    console.error('Failed:', e);
  }
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
