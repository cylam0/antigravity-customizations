import fs from 'node:fs';
import path from 'node:path';

function validateMarkdownFiles(dirPath, requiredKeys) {
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true, recursive: true });
  let count = 0;

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.md')) {
      const fullPath = path.join(entry.parentPath || entry.path, entry.name);
      const content = fs.readFileSync(fullPath, 'utf8');
      const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) continue;

      const frontmatter = match[1];
      for (const key of requiredKeys) {
        const regex = new RegExp(`^${key}:`, 'm');
        if (!regex.test(frontmatter)) {
          throw new Error(`Missing required key "${key}" in frontmatter of ${fullPath}`);
        }
      }
      count++;
    }
  }
  return count;
}

const skillsCount = validateMarkdownFiles('skills', ['name', 'description']);
const agentsCount = validateMarkdownFiles('agents', ['name', 'description', 'kind', 'model']);

console.log(`Validated ${skillsCount} skills and ${agentsCount} agents.`);
