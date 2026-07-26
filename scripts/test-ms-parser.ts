import fs from 'fs';
import { parseMsProjectXml } from '../src/modules/Scheduling/parsers/MsProjectXmlParser';

async function main() {
  const filePath = 'C:\\Users\\purne\\Desktop\\29032026_V7.xml';
  console.log(`Reading file: ${filePath}`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const xmlString = fs.readFileSync(filePath, 'utf-8');
  console.log(`File size: ${(xmlString.length / 1024 / 1024).toFixed(2)} MB`);

  try {
    const result = await parseMsProjectXml(xmlString, 'test-project', 'test-org');
    console.log(`Parsed ${result.activities.length} activities.`);
    console.log(`Parsed ${result.relationships.length} relationships.`);

    if (result.activities.length > 0) {
      console.log('\nSample Activity:');
      console.log(JSON.stringify(result.activities[0], null, 2));
    } else {
      console.warn('\nNo activities found. Check if the parser regexes match the XML tags.');
    }

    if (result.relationships.length > 0) {
      console.log('\nSample Relationship:');
      console.log(JSON.stringify(result.relationships[0], null, 2));
    }

  } catch (err: any) {
    console.error('Parsing failed:', err.message);
  }
}

main();
