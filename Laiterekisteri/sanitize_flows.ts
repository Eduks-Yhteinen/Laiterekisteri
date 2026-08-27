import * as fs from 'fs';
import * as path from 'path';

const SECRET_KEYS = new Set([
  'clientsecret', 'secret', 'refreshtoken', 'accesstoken',
  'clientid', 'password', 'authorization', 'token', 'sharedkey'
]);

function sanitizeJson(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeJson);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (SECRET_KEYS.has(key.toLowerCase()) && typeof val === 'string') {
        newObj[key] = 'REDACTED';
      } else {
        newObj[key] = sanitizeJson(val);
      }
    }
    return newObj;
  } else if (typeof obj === 'string') {
    return obj.replace(/(client_secret|refresh_token|code)=[^&"'\s]+/gi, '$1=REDACTED');
  }
  return obj;
}

function processDirectory(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === 'node_modules' || entry.name === '.git') continue;

    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const parsed = JSON.parse(content);
        const cleaned = sanitizeJson(parsed);
        fs.writeFileSync(fullPath, JSON.stringify(cleaned, null, 2), 'utf8');
        console.log(`Sanitized: ${fullPath}`);
      } catch (e) {
        // Skip non-valid JSON files
      }
    }
  }
}

processDirectory(process.cwd());
console.log('Sanitization complete!');