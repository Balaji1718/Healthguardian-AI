import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Denylist patterns: Any file matching these MUST NEVER be packaged in a distributable ZIP or archive
const SENSITIVE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.local$/i,
  /^\.env\.production$/i,
  /^\.env\.development$/i,
  /.*service-account.*\.json$/i,
  /.*credentials.*\.json$/i,
  /render-env-values\.local\.txt$/i,
  /.*private.*key.*\.pem$/i,
  /.*id_rsa.*/i,
];

// Directories excluded from packaging
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  '.tanstack',
  '.wrangler',
  '.output',
  '.vinxi',
  '.nitro',
  'coverage',
  '.gemini',
]);

function isSensitive(filename) {
  if (filename.endsWith('.env.example')) return false;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(filename));
}

function scanDir(dir, foundSecrets = [], safeFiles = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) {
        continue;
      }
      scanDir(fullPath, foundSecrets, safeFiles);
    } else {
      if (isSensitive(entry.name) || SENSITIVE_PATTERNS.some((p) => p.test(relPath))) {
        foundSecrets.push(relPath);
      } else {
        safeFiles.push(relPath);
      }
    }
  }

  return { foundSecrets, safeFiles };
}

function runPackageAudit() {
  console.log('🔍 Auditing project files for sensitive credentials before distribution...');
  const { foundSecrets, safeFiles } = scanDir(rootDir);

  console.log(`📁 Safe files cataloged: ${safeFiles.length}`);

  if (foundSecrets.length > 0) {
    console.error('\n⚠️  SECURITY ALERT: Sensitive files detected that MUST NOT be included in any distribution package:');
    foundSecrets.forEach((file) => console.error(`  ❌ [BLOCKED]: ${file}`));
    console.error('\nEnsure your packaging excludes these files and verify .gitignore is respected.');
    return { ok: false, foundSecrets, safeFiles };
  }

  console.log('✅ No sensitive secrets found in packageable file tree.');
  return { ok: true, foundSecrets: [], safeFiles };
}

const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('--audit');

const auditResult = runPackageAudit();
if (!isDryRun && !auditResult.ok) {
  console.log('\n🔒 Packaging script prevents distributing secrets.');
  console.log('The following files are locally retained for your development but strictly excluded from any clean archive:');
  auditResult.foundSecrets.forEach((s) => console.log(`   - ${s}`));
  console.log('\nTip: Run `git archive -o dist/healthguardian-ai-clean.zip HEAD` to create an authenticated clean archive that automatically honors .gitignore!');
}
