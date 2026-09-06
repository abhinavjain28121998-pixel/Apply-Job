import fs from 'fs';
let content = fs.readFileSync('src/components/JobTracker.tsx', 'utf8');

content = content.replace(/import \{ Job, Application \} from '\.\.\/types';\n/g, '');

fs.writeFileSync('src/components/JobTracker.tsx', content);
