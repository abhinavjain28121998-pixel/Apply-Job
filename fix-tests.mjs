import fs from 'fs';
let content = fs.readFileSync('tests/matchingService.test.ts', 'utf8');

// Add requirement strings to the MISSING objects so they count towards totalPossible
content = content.replace(
  /experience: \{ matchLevel: 'MISSING' \}/g,
  `experience: { requirement: 'Req', matchLevel: 'MISSING' }`
);
content = content.replace(
  /seniority: \{ matchLevel: 'MISSING' \}/g,
  `seniority: { requirement: 'Req', matchLevel: 'MISSING' }`
);
content = content.replace(
  /responsibilities: \[\n        \{ matchLevel: 'MISSING' \}\n      \]/g,
  `responsibilities: [\n        { requirement: 'Req', matchLevel: 'MISSING' }\n      ]`
);
content = content.replace(
  /industry: \{ matchLevel: 'MISSING' \}/g,
  `industry: { requirement: 'Req', matchLevel: 'MISSING' }`
);
content = content.replace(
  /education: \{ matchLevel: 'MISSING' \}/g,
  `education: { requirement: 'Req', matchLevel: 'MISSING' }`
);
content = content.replace(
  /location: \{ matchLevel: 'MISSING' \}/g,
  `location: { requirement: 'Req', matchLevel: 'MISSING' }`
);
content = content.replace(
  /otherFit: \{ matchLevel: 'MISSING' \}/g,
  `otherFit: { requirement: 'Req', matchLevel: 'MISSING' }`
);

// We also need to add requirement to MATCHED categories to ensure they count!
content = content.replace(
  /experience: \{ matchLevel: 'MATCHED' \}/g,
  `experience: { requirement: 'Req', matchLevel: 'MATCHED' }`
);
content = content.replace(
  /seniority: \{ matchLevel: 'MATCHED' \}/g,
  `seniority: { requirement: 'Req', matchLevel: 'MATCHED' }`
);
content = content.replace(
  /responsibilities: \[\n        \{ matchLevel: 'MATCHED' \}\n      \]/g,
  `responsibilities: [\n        { requirement: 'Req', matchLevel: 'MATCHED' }\n      ]`
);
content = content.replace(
  /industry: \{ matchLevel: 'MATCHED' \}/g,
  `industry: { requirement: 'Req', matchLevel: 'MATCHED' }`
);
content = content.replace(
  /education: \{ matchLevel: 'MATCHED' \}/g,
  `education: { requirement: 'Req', matchLevel: 'MATCHED' }`
);
content = content.replace(
  /location: \{ matchLevel: 'MATCHED' \}/g,
  `location: { requirement: 'Req', matchLevel: 'MATCHED' }`
);
content = content.replace(
  /otherFit: \{ matchLevel: 'MATCHED' \}/g,
  `otherFit: { requirement: 'Req', matchLevel: 'MATCHED' }`
);

fs.writeFileSync('tests/matchingService.test.ts', content);
