import fs from 'fs';
let content = fs.readFileSync('src/services/jobMatchService.ts', 'utf8');

content = content.replace(
  /match\.id = docId;/g,
  `const matchToSave = { ...match, id: docId, analyzedAt: Date.now() };`
);

content = content.replace(
  /await setDoc\(doc\(db, 'job_matches', docId\), match\);/g,
  `await setDoc(doc(db, 'job_matches', docId), matchToSave);`
);

content = content.replace(
  /if \(idx >= 0\) matches\[idx\] = match;\n      else matches\.push\(match\);/g,
  `if (idx >= 0) matches[idx] = matchToSave;\n      else matches.push(matchToSave);`
);

fs.writeFileSync('src/services/jobMatchService.ts', content);
