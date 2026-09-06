export type JobRecommendation = 'APPLY' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'SKIP';

export type JobStatus = 'DISCOVERED' | 'SAVED' | 'PREPARING' | 'READY_FOR_REVIEW' | 'APPLYING' | 'APPLIED' | 'INTERVIEW' | 'OFFER' | 'REJECTED';

export type RequirementCategory = 'SKILL' | 'EXPERIENCE' | 'RESPONSIBILITY' | 'EDUCATION' | 'CERTIFICATION' | 'LOCATION' | 'OTHER';

export interface JobRequirement {
  id: string;
  text: string;
  category: RequirementCategory;
  importance: 'REQUIRED' | 'PREFERRED';
  critical: boolean;
}

export interface WorkExperience {
  company: string;
  title: string;
  startYear?: number;
  endYear?: number;
  description: string;
  skillsUsed?: string[];
}

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
  workHistory?: WorkExperience[];
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
  
  // Structured Requirements
  structuredRequirements?: JobRequirement[];
  skills?: string[];
  requiredSkills?: string[];
  preferredSkills?: string[];
  responsibilities?: string[];
  industry?: string;
  educationRequirements?: string;
  certifications?: string[];
}

export interface SavedJob {
  id: string;
  userId: string;
  jobId: string;
  job: Job;
  dateAdded: number;
}

export interface JobMatch {
  analyzedAt?: number;
  resumeVersion?: string;
  analysisStatus?: 'READY' | 'ANALYSIS_UNAVAILABLE' | 'ANALYSIS_FAILED';
  id: string; // Typically same as jobId or composite
  userId: string;
  jobId: string;
  matchScore?: number | null;
  confidenceScore?: number;
  confidenceLevel?: 'HIGH' | 'MEDIUM' | 'LOW'; // 0-100 based on evidence coverage
  matchExplanation: string;
  matchedSkills: string[];
  skillsMatch: string;
  experienceMatch: string;
  seniorityMatch: string;
  industryMatch: string;
  locationMatch: string;
  educationMatch: string;
  missingRequiredSkills: string[];
  missingNiceToHaveSkills: string[];
  concerns: string[];
  recommendation: JobRecommendation;
  details?: any; // To store full matching evidence
}

export interface Application {
  id: string; // Generated unique ID
  userId: string; // Indexed field
  jobId: string; // Indexed field
  status: JobStatus;
  datePrepared: number;
  dateApplied?: number;
  followUpDate?: number;
  matchScore?: number | null;
  resumeVersion?: string;
  tailoredCv?: string;
  coverLetter?: string;
  applicationAnswers?: Record<string, string>;
  notes?: string;
  applicationUrl?: string;
  
  // Extra fields for tailoring details
  bulletImprovements?: { original: string; suggested: string; reason: string; keywordTarget?: string }[];
  updatedSummary?: string;
  emphasizedSkills?: string[];
}

export interface ResumeEvidence {
  skills: string[];
  experience: {
    totalYears: number | null;
    relevantYears: number | null;
    roles: WorkExperience[];
  };
  education: string;
  certifications: string[];
  industries: string[];
  other: string;
}
