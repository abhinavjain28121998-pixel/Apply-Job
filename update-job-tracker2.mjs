import fs from 'fs';
let content = fs.readFileSync('src/components/JobTracker.tsx', 'utf8');

// Replace seedSampleData block explicitly using string indexOf or substring
const seedStart = content.indexOf('const seedSampleData = async () => {');
const fetchJobsStart = content.indexOf('fetchJobs();', seedStart);
const catchBlock = content.indexOf('} catch (err) {', fetchJobsStart);

if (seedStart !== -1 && catchBlock !== -1) {
  content = content.substring(0, seedStart) + `const seedSampleData = async () => {
    alert("Please go to Find Jobs to search and save realistic jobs. They will automatically be analyzed against your profile.");
  };

  ` + content.substring(content.indexOf('useEffect(() => {', catchBlock));
}

fs.writeFileSync('src/components/JobTracker.tsx', content);
