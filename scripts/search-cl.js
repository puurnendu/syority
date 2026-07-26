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
    if (line.includes('type ConstraintLog = {')) {
       console.log(`${count}: ${line}`);
       // print next 30 lines
    }
    count++;
  }
}

main().catch(console.error);
