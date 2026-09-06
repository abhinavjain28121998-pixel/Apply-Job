import { Job, JobMatch, Application, UserProfile } from '../types';

export const calculateApplicationReadiness = (
  job: Partial<Job> | null,
  match: JobMatch | null,
  app: Application | null,
  profile: UserProfile | null
): { score: number, reasons: string[] } => {
  let score = 0;
  const reasons: string[] = [];

  // 1. Is Resume/Profile state valid?
  // Structural validation: has baseCvText, and has either workHistory or skills populated
  const hasBasicCv = profile && profile.baseCvText && profile.baseCvText.length > 50;
  const hasWorkHistory = profile && profile.workHistory && profile.workHistory.length > 0;
  const hasSkills = profile && profile.skills && profile.skills.length > 0;
  
  if (hasBasicCv && (hasWorkHistory || hasSkills)) {
    score += 10;
  } else {
    reasons.push("Profile is incomplete (missing work history or skills)");
  }

  // 2. Is Job Analyzed?
  if (match && match.analysisStatus === 'READY' && match.matchScore !== undefined && match.matchScore !== null) {
    score += 20;
  } else if (match && match.analysisStatus === 'ANALYSIS_UNAVAILABLE') {
    reasons.push("Analysis unavailable");
  } else if (match && match.analysisStatus === 'ANALYSIS_FAILED') {
    reasons.push("Analysis failed");
  } else {
    reasons.push("Job not analyzed");
  }

  // 3. Is Tailored CV generated?
  if (app && (app.tailoredCv || (app.bulletImprovements && app.bulletImprovements.length > 0))) {
    score += 25;
  } else {
    reasons.push("Resume not optimized");
  }

  // 4. Is Cover Letter generated?
  if (app && app.coverLetter) {
    score += 20;
  } else {
    reasons.push("Cover letter missing");
  }

  // 5. Are Application Answers completed?
  if (app && app.applicationAnswers && Object.keys(app.applicationAnswers).length > 0) {
    score += 15;
  } else {
    reasons.push("Application answers missing");
  }

  // 6. Required Info
  if (job && job.title && job.company) {
    score += 10;
  } else {
    reasons.push("Basic job info missing (title, company)");
  }

  return { score, reasons };
};
