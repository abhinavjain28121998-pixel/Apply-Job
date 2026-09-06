import { jobService } from './jobService';

export const applicationService = {
  markAsApplied: async (jobId: string): Promise<void> => {
    await jobService.updateJob(jobId, {
      status: 'APPLIED',
      dateApplied: Date.now()
    });
  }
};
