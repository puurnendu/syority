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
    if (line.includes('workpack_id') || line.includes('workpackId')) {
      console.log(`${count}: ${line}`);
      if (count > 200000) break;
    }
    count++;
  }
}

main().catch(console.error);
