export type JobRecommendation = 'APPLY' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'SKIP';
export type JobStatus = 'DISCOVERED' | 'SAVED' | 'PREPARING' | 'READY_FOR_REVIEW' | 'APPLYING' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

export interface UserProfile {
  id: string;
  userId: string;
  baseCvText: string;
  summary?: string;
  totalExperience?: number;
  currentRole?: string;
  skills?: string[];
  tools?: string[];
  industries?: string[];
  education?: string[];
  certifications?: string[];
  achievements?: string[];
  preferredLocations?: string[];
  workMode?: string;
  expectedSalary?: string;
}

export interface SearchFilters {
  query?: string;
  location?: string;
  experience?: string;
  salary?: string;
  workMode?: 'Remote' | 'Hybrid' | 'On-site' | '';
  employmentType?: string;
  skills?: string[];
  page?: number;
  limit?: number;
}

export type ProviderStatus = {
  provider: string;
  status: 'DEMO' | 'CONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  lastSync?: number;
  lastError?: string;
};

export interface JobSearchResponse {
  jobs: Partial<Job>[];
  status: ProviderStatus;
  diagnostics: any;
  hasMore: boolean;
}

export interface JobProvider {
  searchJobs(filters: SearchFilters): Promise<Partial<Job>[]>;
  getJobDetails(jobId: string): Promise<Partial<Job>>;
  normalizeJob(rawJob: any): Partial<Job>;
  healthCheck(): Promise<ProviderStatus>;
}

export interface Job {
  id: string;
  userId: string;
  company: string;
  title: string;
  url?: string;
  description: string;
  location?: string;
  experienceRequired?: string;
  salaryRange?: string;
  workMode?: string;
  postedDate?: number;
  employmentType?: string;
  source?: string;
  matchScore?: number;
  matchExplanation?: string;
  matchedSkills?: string[];
  skillsMatch?: string;
  experienceMatch?: string;
  seniorityMatch?: string;
  industryMatch?: string;
  locationMatch?: string;
  educationMatch?: string;
  missingRequiredSkills?: string[];
  missingNiceToHaveSkills?: string[];
  concerns?: string[];
  recommendation?: JobRecommendation;
  status: JobStatus;
  notes?: string;
  dateAdded: number;
  dateApplied?: number;
  followUpDate?: number;
  tailoredCv?: string;
  coverLetter?: string;
  applicationAnswers?: Record<string, string>;
  bulletImprovements?: { original: string; suggested: string; reason: string; keywordTarget?: string }[];
  updatedSummary?: string;
  emphasizedSkills?: string[];
}

export interface Application {
  id: string;
  jobId: string;
  userId: string;
  tailoredCv: string;
  coverLetter: string;
  updatedSummary?: string;
  emphasizedSkills?: string[];
  bulletImprovements?: { original: string; suggested: string; reason: string }[];
  matchedKeywords?: string[];
  unchangedSections?: string[];
  answers?: string;
  status: 'DRAFT' | 'APPROVED' | 'SUBMITTED';
  datePrepared: number;
  dateSubmitted?: number;
}
