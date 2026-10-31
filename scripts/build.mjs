import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist);
for (const file of ['index.html', 'favicon.svg', 'fbapp-config.json', 'src']) {
  await cp(resolve(root, file), resolve(dist, file), { recursive: true });
}
// Python's standard library creates a portable ZIP with index.html at its root.
const result = spawnSync('python3', ['-c', `
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(${JSON.stringify(dist)})
with ZipFile(root.parent / 'maguro-escape.zip', 'w', ZIP_DEFLATED) as archive:
    for file in sorted(root.rglob('*')):
        if file.is_file(): archive.write(file, file.relative_to(root))
with ZipFile(root.parent / 'maguro-upload-kit.zip', 'w', ZIP_DEFLATED) as archive:
    archive.write(root.parent / 'maguro-escape.zip', 'maguro-escape.zip')
    archive.write(root.parent / 'scripts/upload-local.py', 'upload.py')
    archive.write(root.parent / 'scripts/UPLOAD-KIT.md', 'README.md')
`], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.log('Built dist/, maguro-escape.zip, and maguro-upload-kit.zip');
