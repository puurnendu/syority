const fs = require('fs');
const files = [
  'app/platform/tenants/[id]/page.tsx',
  'app/platform/tenants/page.tsx',
  'app/platform/tenants/new/page.tsx',
  'app/platform/system/page.tsx',
  'app/platform/setup/page.tsx',
  'app/platform/onboarding/page.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
      console.log(`Skipping missing file: ${file}`);
      continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import\s*\{\s*getServerSession\s*\}\s*from\s*'next-auth';/gi, "import { requirePlatformContext } from '@/lib/server-context';");
  content = content.replace(/import\s*\{\s*authOptions\s*\}\s*from\s*'@\/lib\/auth';/gi, "");
  content = content.replace(/await\s*getServerSession\(authOptions\)/gi, "await requirePlatformContext()");
  content = content.replace(/if\s*\(!session\)\s*redirect\('\/login'\);/gi, ""); // Remove old redirect logic since requirePlatformContext handles it
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
