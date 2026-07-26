const fs = require('fs');
const readline = require('readline');

async function main() {
  const fileStream = fs.createReadStream('node_modules/.prisma/client/index.d.ts');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let count = 0;
  let inWorkpack = false;
  for await (const line of rl) {
    if (line.includes('type Workpack = {')) inWorkpack = true;
    if (inWorkpack) {
      console.log(`${count}: ${line}`);
      if (line.includes('}')) inWorkpack = false;
    }
    count++;
    if (count > 1000000) break;
  }
}

main().catch(console.error);
