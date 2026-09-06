import { Job } from '../types';

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
  if (job.tailoredCv) {
    score += 30;
  } else {
    reasons.push("Resume not optimized");
  }

  // 3. Is Cover Letter generated?
  if (job.coverLetter) {
    score += 30;
  } else {
    reasons.push("Cover letter missing");
  }

  // 4. Are Application Answers completed?
  if (job.applicationAnswers && Object.keys(job.applicationAnswers).length > 0) {
    score += 20;
  } else {
    reasons.push("Application answers missing");
  }

  return { score, reasons };
};
