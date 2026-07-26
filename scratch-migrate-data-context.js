const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

const targetDir = path.join(process.cwd(), 'app/platform-data');

walkDir(targetDir, (filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.jsx') || filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;

        // Replace `requireTenantContext` with `requireDataAdminContext`
        if (content.includes('requireTenantContext')) {
            content = content.replace(/requireTenantContext/g, 'requireDataAdminContext');
            modified = true;
        }
        
        // Also fix legacy `getServerSession` if it somehow survived
        if (content.includes('getServerSession(authOptions)') && !content.includes('requireDataAdminContext')) {
            content = content.replace(/import \{ getServerSession \} from 'next-auth';\nimport \{ authOptions \} from '@\/lib\/auth';/g, "import { requireDataAdminContext } from '@/lib/server-context';");
            content = content.replace(/const session = await getServerSession\(authOptions\);[\s\S]*?(?=const|return|let)/, "const session = await requireDataAdminContext();\n\n");
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated: ${filePath}`);
        }
    }
});
