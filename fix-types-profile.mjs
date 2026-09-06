import fs from 'fs';
let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /export interface UserProfile \{/,
  `export interface UserProfile {\n  version?: string;`
);

// We need to also add UNAVAILABLE to recommendation if not there
content = content.replace(
  /recommendation\?: 'APPLY' \| 'APPLY_WITH_CHANGES' \| 'LOW_PRIORITY';/,
  `recommendation?: 'APPLY' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'UNAVAILABLE';`
);

fs.writeFileSync('src/types.ts', content);
