import fs from 'fs';

function replaceInFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  // Handle matchScore !== undefined where we might now have null
  // Just replacing `matchScore !== undefined` with `matchScore != null`
  content = content.replace(/matchScore !== undefined/g, 'matchScore != null');
  content = content.replace(/matchScore === undefined/g, 'matchScore == null');
  fs.writeFileSync(file, content);
}

['src/components/FindJobs.tsx', 'src/components/JobTracker.tsx', 'src/components/ApplicationWorkspace.tsx'].forEach(replaceInFile);
