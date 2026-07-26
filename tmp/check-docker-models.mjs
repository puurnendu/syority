import { Prisma } from '@prisma/client';

const names = Object.keys(Prisma.ModelName || {});
console.log('ModelName count', names.length);
console.log('has Area', names.includes('Area'));
console.log('has WebhookConfig', names.includes('WebhookConfig'));
console.log('has ApiKey', names.includes('ApiKey'));
console.log('has WebhookLog', names.includes('WebhookLog'));
console.log(
  'related',
  names.filter((k) => /Area|Site|Plant|Webhook|ApiKey/.test(k))
);
