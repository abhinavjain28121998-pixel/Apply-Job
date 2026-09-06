import fs from 'fs';
let content = fs.readFileSync('tests/application.test.ts', 'utf8');

content = content.replace(
  /const profile = \{ baseCvText: 'This is a long base CV text to ensure it passes the length requirement.' \} as UserProfile;/g,
  `const profile = { baseCvText: 'This is a long base CV text to ensure it passes the length requirement.', skills: ['React'] } as UserProfile;`
);

fs.writeFileSync('tests/application.test.ts', content);
