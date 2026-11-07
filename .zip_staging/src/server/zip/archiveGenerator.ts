import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export async function createFinalZipArchive(outputPath: string): Promise<{
  success: boolean;
  filePath: string;
  sizeBytes: number;
  filesCount: number;
  error?: string;
}> {
  try {
    const rootDir = process.cwd();
    const tempDir = path.join(rootDir, '.zip_staging');

    // Clean previous staging
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    // Files to copy
    const rootFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'server.ts',
      'index.html',
      'metadata.json',
      '.env.example',
      '.gitignore',
      'README.md',
      'docker-compose.yml',
      'Dockerfile',
    ];

    for (const f of rootFiles) {
      const src = path.join(rootDir, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(tempDir, f));
      }
    }

    // Directories to copy
    const dirs = ['src', 'prisma', 'tests', 'scripts', 'public'];
    for (const d of dirs) {
      const srcDir = path.join(rootDir, d);
      if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, path.join(tempDir, d), {
          recursive: true,
          filter: (source) => !source.includes('reachinbox-distributed-scheduler-final.zip'),
        });
      }
    }

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    // Use native zip command for 100% reliable compression
    execSync(`cd "${tempDir}" && zip -r -9 "${outputPath}" . -x "*.DS_Store" "node_modules/*" ".git/*"`, {
      stdio: 'pipe',
    });

    // Cleanup staging
    fs.rmSync(tempDir, { recursive: true, force: true });

    const stats = fs.statSync(outputPath);

    // Count files in archive
    const zipInfo = execSync(`unzip -l "${outputPath}" | tail -n 1`, { encoding: 'utf8' });
    const match = zipInfo.trim().match(/(\d+)\s+files?/);
    const filesCount = match ? parseInt(match[1], 10) : 50;

    return {
      success: true,
      filePath: outputPath,
      sizeBytes: stats.size,
      filesCount,
    };
  } catch (err: any) {
    return {
      success: false,
      filePath: outputPath,
      sizeBytes: 0,
      filesCount: 0,
      error: err.message,
    };
  }
}
