import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

// Add createdAt and updatedAt to Application
content = content.replace(
  /export interface Application \{/,
  `export interface Application {\n  createdAt?: number;\n  updatedAt?: number;`
);

fs.writeFileSync('src/types.ts', content);
