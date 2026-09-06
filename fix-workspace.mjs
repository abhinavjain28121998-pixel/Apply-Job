import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

content = content.replace(
  /fetchJob\(\);\n    \}\n  \}, \[id, user\]\);/g,
  `fetchJob();\n  }, [id, user]);`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
