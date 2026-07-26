const fs = require('fs');
const files = [
  'app/(dashboard)/settings/master-data/equipment-types/page.tsx',
  'app/(dashboard)/settings/workpack-templates/page.tsx',
  'app/(dashboard)/settings/workpack-templates/[id]/page.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) {
      console.log(`Skipping missing file: ${file}`);
      continue;
  }
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/import\s*\{\s*getServerSession\s*\}\s*from\s*'next-auth';/gi, "import { requireTenantContext } from '@/lib/server-context';");
  content = content.replace(/import\s*\{\s*authOptions\s*\}\s*from\s*'@\/lib\/auth';/gi, "");
  content = content.replace(/await\s*getServerSession\(authOptions\)/gi, "await requireTenantContext()");
  content = content.replace(/if\s*\(!session(\?.user)?\)\s*redirect\('\/login'\);/gi, ""); 
  
  // They used to check session.user.organization_id. requireTenantContext returns active_tenant_id.
  content = content.replace(/const\s+orgId\s*=\s*session(\?.user)?\.organization_id;/gi, "const orgId = session.active_tenant_id;");
  
  // also they might check user id
  content = content.replace(/const\s+userId\s*=\s*session(\?.user)?\.id;/gi, "const userId = session.user_id;");
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
