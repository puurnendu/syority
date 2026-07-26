import { Prisma } from '@prisma/client';

const required = ['Area', 'Site', 'Plant', 'Unit', 'System', 'Asset', 'WebhookConfig', 'WebhookLog', 'ApiKey'];
const names = Object.keys(Prisma.ModelName || {});
const missing = required.filter((n) => !names.includes(n));
console.log(JSON.stringify({ count: names.length, missing, present: required.filter((n) => names.includes(n)) }, null, 2));
process.exit(missing.length ? 1 : 0);
