/**
 * FOUNDATION SEED RUNNER
 * Syority Turnaround Management Platform
 * 
 * Runs the authoritative Platform Seed followed by the Living Reference Validation Plant.
 * Version: 1.3.0
 */

import { runPlatformSeed } from './platform-seed';
import { runValidationPlantSeed } from './validation-plant-seed';
import { disconnect, verifyDatabase } from '../seed-client';

async function main() {
  console.log('🌱 Verifying database connectivity...');
  await verifyDatabase();

  console.log('🌱 Starting Platform Foundation Seed Pipeline...');
  const t0 = Date.now();

  await runPlatformSeed();
  await runValidationPlantSeed();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`\n🎉 ALL SEED FOUNDATIONS EXECUTED SUCCESSFULLY in ${elapsed}s!`);
}

main()
  .then(() => disconnect())
  .catch(async (err) => {
    console.error('❌ Foundation Seed Pipeline failed:', err);
    await disconnect();
    process.exit(1);
  });
