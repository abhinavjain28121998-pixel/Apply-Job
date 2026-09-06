import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');
content = content.replace(/..\/server\/matchingService/g, '../src/services/matchingService');
fs.writeFileSync('tests/matchingService.test.ts', content);
