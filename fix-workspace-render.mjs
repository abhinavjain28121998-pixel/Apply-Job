import fs from 'fs';

let content = fs.readFileSync('src/components/ApplicationWorkspace.tsx', 'utf8');

// Replace savedJob?.job?.matchScore -> match?.matchScore
content = content.replace(/savedJob\?\.job\?\.matchScore/g, 'match?.matchScore');
content = content.replace(/savedJob\?\.job\?\.matchExplanation/g, 'match?.matchExplanation');
content = content.replace(/savedJob\?\.job\?\.matchedSkills/g, 'match?.matchedSkills');
content = content.replace(/savedJob\?\.job\?\.missingRequiredSkills/g, 'match?.missingRequiredSkills');
content = content.replace(/savedJob\?\.job\?\.status/g, 'app?.status');
content = content.replace(/savedJob\?\.job\?\.analysisStatus/g, 'match?.analysisStatus');
content = content.replace(/savedJob\?\.job\?\.tailoredCv/g, 'app?.tailoredCv');
content = content.replace(/savedJob\?\.job\?\.coverLetter/g, 'app?.coverLetter');
content = content.replace(/savedJob\?\.job\?\.applicationAnswers/g, 'app?.applicationAnswers');
content = content.replace(/savedJob\?\.job\?\.bulletImprovements/g, 'app?.bulletImprovements');

fs.writeFileSync('src/components/ApplicationWorkspace.tsx', content);
