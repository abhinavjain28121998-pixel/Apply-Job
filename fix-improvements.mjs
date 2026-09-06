import fs from 'fs';
let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Fix Accept
content = content.replace(
  /const next = \[\.\.\.improvements\];\n\s*next\[idx\]\.status = 'ACCEPTED';\n\s*setImprovements\(next\);/g,
  `const next = [...improvements];\n                          next[idx].status = 'ACCEPTED';\n                          setImprovements(next);\n                          saveAppState({ bulletImprovements: next });`
);

// Fix Reject
content = content.replace(
  /const next = \[\.\.\.improvements\];\n\s*next\[idx\]\.status = 'REJECTED';\n\s*setImprovements\(next\);/g,
  `const next = [...improvements];\n                          next[idx].status = 'REJECTED';\n                          setImprovements(next);\n                          saveAppState({ bulletImprovements: next });`
);

// Fix Accept All
content = content.replace(
  /const next = improvements\.map\(i => \(\{\.\.\.i, status: 'ACCEPTED' as const\}\)\);\n\s*setImprovements\(next\);/g,
  `const next = improvements.map(i => ({...i, status: 'ACCEPTED' as const}));\n                    setImprovements(next);\n                    saveAppState({ bulletImprovements: next });`
);

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
