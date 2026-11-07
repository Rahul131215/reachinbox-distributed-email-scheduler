import path from 'path';
import fs from 'fs';
import { createFinalZipArchive } from '../src/server/zip/archiveGenerator';

async function main() {
  console.log('Generating reachinbox-distributed-scheduler-final.zip...');
  const rootZipPath = path.join(process.cwd(), 'reachinbox-distributed-scheduler-final.zip');
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  const publicZipPath = path.join(publicDir, 'reachinbox-distributed-scheduler-final.zip');

  const result = await createFinalZipArchive(rootZipPath);
  if (!result.success) {
    console.error('Failed to generate ZIP archive:', result.error);
    process.exit(1);
  }

  fs.copyFileSync(rootZipPath, publicZipPath);
  console.log(`Successfully generated archive:`);
  console.log(`- Path: ${result.filePath}`);
  console.log(`- Files count: ${result.filesCount}`);
  console.log(`- Size: ${(result.sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(console.error);
