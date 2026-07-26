import { Prisma } from '@prisma/client';

const need = ['WebhookConfig', 'WebhookLog', 'ApiKey', 'Area'];
const names = Prisma.ModelName;
for (const n of need) {
  console.log(n, names[n] ? 'OK' : 'MISSING');
}
