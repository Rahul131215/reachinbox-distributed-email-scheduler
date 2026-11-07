import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { ZipArchive } = require('archiver');

export async function createFinalZipArchive(outputPath: string): Promise<{
  success: boolean;
  filePath: string;
  sizeBytes: number;
  filesCount: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    try {
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const output = fs.createWriteStream(outputPath);
      const archive = new ZipArchive({
        zlib: { level: 9 },
      });

      let filesCount = 0;

      output.on('close', () => {
        resolve({
          success: true,
          filePath: outputPath,
          sizeBytes: archive.pointer ? archive.pointer() : fs.statSync(outputPath).size,
          filesCount,
        });
      });

      archive.on('entry', () => {
        filesCount++;
      });

      archive.on('error', (err: any) => {
        resolve({
          success: false,
          filePath: outputPath,
          sizeBytes: 0,
          filesCount,
          error: err.message,
        });
      });

      archive.pipe(output);

      const rootDir = process.cwd();

      // Core configuration files
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
        const fullPath = path.join(rootDir, f);
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: f });
        }
      }

      // Project source directories
      const dirsToInclude = ['src', 'prisma', 'tests', 'scripts', 'public'];

      for (const d of dirsToInclude) {
        const fullDirPath = path.join(rootDir, d);
        if (fs.existsSync(fullDirPath)) {
          archive.directory(fullDirPath, d, (entry: any) => {
            if (entry.name && (entry.name.endsWith('.zip') || entry.name.includes('node_modules'))) {
              return false;
            }
            return entry;
          });
        }
      }

      archive.finalize().catch((err: any) => {
        resolve({
          success: false,
          filePath: outputPath,
          sizeBytes: 0,
          filesCount,
          error: err.message,
        });
      });
    } catch (err: any) {
      resolve({
        success: false,
        filePath: outputPath,
        sizeBytes: 0,
        filesCount: 0,
        error: err.message,
      });
    }
  });
}
