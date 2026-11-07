import path from 'path';
import fs from 'fs';
import { createFinalZipArchive } from '../src/server/zip/archiveGenerator';

async function main() {
  const primaryFilename = 'reachinbox-distributed-email-scheduler.zip';
  console.log(`Generating ${primaryFilename}...`);
  const rootZipPath = path.join(process.cwd(), primaryFilename);
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicZipPath = path.join(publicDir, primaryFilename);

  const result = await createFinalZipArchive(rootZipPath);
  if (!result.success) {
    console.error('Failed to generate ZIP archive:', result.error);
    process.exit(1);
  }

  fs.copyFileSync(rootZipPath, publicZipPath);

  // Also create reachinbox-distributed-scheduler-final.zip for compatibility
  const legacyFilename = 'reachinbox-distributed-scheduler-final.zip';
  fs.copyFileSync(rootZipPath, path.join(process.cwd(), legacyFilename));
  fs.copyFileSync(rootZipPath, path.join(publicDir, legacyFilename));

  console.log(`Successfully generated standalone archive:`);
  console.log(`- Path: ${result.filePath}`);
  console.log(`- Files count: ${result.filesCount}`);
  console.log(`- Size: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
