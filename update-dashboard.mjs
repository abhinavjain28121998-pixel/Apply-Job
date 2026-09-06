import fs from 'fs';
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// Replace mock discovered metric
content = content.replace(
  /const jobsDiscovered = jobsSaved > 0 \? jobsSaved \* 4 \+ 12 : 0; \/\/ Mocking discovered metric/g,
  `const jobsDiscovered = jobsSaved; // Cannot accurately track undiscovered jobs in this local demo mode, default to saved`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
