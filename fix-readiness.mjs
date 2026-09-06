import fs from 'fs';
let content = fs.readFileSync('src/services/applicationReadinessService.ts', 'utf8');

content = `import { Job } from '../types';

export const calculateApplicationReadiness = (job: Partial<Job>): { score: number, reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  // 1. Is Job Analyzed?
  if (job.matchScore !== undefined) {
    score += 20;
  } else {
    reasons.push("Job not analyzed");
  }

  // 2. Is Tailored CV generated?
  if (job.tailoredCv || (job.bulletImprovements && job.bulletImprovements.length > 0)) {
    score += 25;
  } else {
    reasons.push("Resume not optimized");
  }

  // 3. Is Cover Letter generated?
  if (job.coverLetter) {
    score += 25;
  } else {
    reasons.push("Cover letter missing");
  }

  // 4. Are Application Answers completed?
  if (job.applicationAnswers && Object.keys(job.applicationAnswers).length > 0) {
    score += 15;
  } else {
    reasons.push("Application answers missing");
  }

  // 5. Required Info
  if (job.title && job.company && job.url) {
    score += 15;
  } else {
    reasons.push("Basic job info missing (title, company, URL)");
  }

  return { score, reasons };
};
`;
fs.writeFileSync('src/services/applicationReadinessService.ts', content);

let testContent = fs.readFileSync('tests/application.test.ts', 'utf8');
testContent = testContent.replace(/\{ why: 'Because' \}/g, "{ why: 'Because' }, title: 'T', company: 'C', url: 'U'");
fs.writeFileSync('tests/application.test.ts', testContent);

