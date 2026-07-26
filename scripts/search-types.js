const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('node_modules/.prisma/client/index.d.ts');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  for await (const line of rl) {
    if (line.includes('organizationId') || line.includes('organization_id') || line.includes('Workpack = {')) {
      console.log(`${count}: ${line}`);
    }
    count++;
    if (count > 50000) break; // Search first 50k lines
  }
}

main().catch(console.error);
