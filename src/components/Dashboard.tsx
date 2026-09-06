import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import { SavedJob, JobMatch, Application } from '../types';
import { jobService } from '../services/jobService';
import { jobMatchService } from '../services/jobMatchService';
import { applicationService } from '../services/applicationService';
import { Briefcase, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

type CombinedJob = {
  saved: SavedJob;
  match: JobMatch | null;
  app: Application | null;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<CombinedJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
        const apps = await applicationService.getApplicationsForUser(user.uid);
        const appMap = new Map(apps.map(a => [a.jobId, a]));
        
        const matchPromises = savedJobsList.map(sj => jobMatchService.getMatch(user.uid, sj.jobId));
        const matches = await Promise.all(matchPromises);
        const matchMap = new Map();
        matches.forEach(m => { if (m) matchMap.set(m.jobId, m); });

        const combined = savedJobsList.map(sj => ({
          saved: sj,
          match: matchMap.get(sj.jobId) || null,
          app: appMap.get(sj.jobId) || null
        }));

        setJobs(combined.sort((a, b) => b.saved.dateAdded - a.saved.dateAdded));
      } catch (error) {
        console.error("Error fetching jobs", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user]);

  if (loading) return <div className="p-8">Loading dashboard...</div>;

  const jobsSaved = jobs.length;
  const jobsDiscovered = jobsSaved; // Cannot accurately track undiscovered jobs in this local demo mode, default to saved
  const jobsAnalyzed = jobs.filter(j => j.match !== null).length;
  const strongMatches = jobs.filter(j => j.match?.recommendation === 'APPLY').length;
  const applicationsSubmitted = jobs.filter(j => j.app?.status && ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.app.status)).length;
  const interviews = jobs.filter(j => j.app?.status === 'INTERVIEW' || j.app?.status === 'OFFER').length;
  const offers = jobs.filter(j => j.app?.status === 'OFFER').length;
  
  const appToInterviewRate = applicationsSubmitted > 0 ? Math.round((interviews / applicationsSubmitted) * 100) : 0;
  const avgMatchScore = jobsAnalyzed > 0 ? Math.round(jobs.reduce((acc, job) => acc + (job.match?.matchScore || 0), 0) / jobsAnalyzed) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
          <p className="text-slate-600">Overview of your job discovery and application pipeline.</p>
        </div>
        <Link to="/find-jobs" className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors">
          Discover Jobs
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-8">
        <StatCard title="Discovered" value={jobsDiscovered} />
        <StatCard title="Analyzed" value={jobsAnalyzed} />
        <StatCard title="Strong Matches" value={strongMatches} />
        <StatCard title="Submitted" value={applicationsSubmitted} />
        <StatCard title="Interviews" value={interviews} />
        <StatCard title="Offers" value={offers} />
        <StatCard title="App to Interview" value={`${appToInterviewRate}%`} />
        <StatCard title="Avg Match" value={`${avgMatchScore}%`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-semibold text-lg text-slate-800">Recent Recommended Jobs</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {jobs.filter(j => j.match?.recommendation === 'APPLY').length === 0 ? (
              <div className="p-8 text-center text-slate-500">No highly recommended jobs yet. Analyze a job to see it here.</div>
            ) : (
              jobs.filter(j => j.match?.recommendation === 'APPLY').slice(0, 5).map(job => (
                <div key={job.saved.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 className="font-medium text-slate-900">{job.saved.job.title}</h3>
                    <p className="text-sm text-slate-500">{job.saved.job.company}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      {job.match?.matchScore != null ? <p className="text-sm font-medium text-indigo-600">{job.match.matchScore}% Match</p> : <p className="text-sm font-medium text-slate-400">Not Analyzed</p>}
                    </div>
                    <Link to="/tracker" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors">
                      View
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-semibold text-lg text-slate-800">Recent Applications</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {jobs.filter(j => j.app?.status && ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.app.status)).length === 0 ? (
              <div className="p-8 text-center text-slate-500">No applications submitted yet.</div>
            ) : (
              jobs.filter(j => j.app?.status && ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.app.status)).slice(0, 5).map(job => (
                <div key={job.saved.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 className="font-medium text-slate-900">{job.saved.job.title}</h3>
                    <p className="text-sm text-slate-500">{job.saved.job.company}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${job.app?.status === 'INTERVIEW' || job.app?.status === 'OFFER' ? 'bg-green-100 text-green-700' : job.app?.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {job.app?.status}
                    </span>
                    <Link to="/tracker" className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors">
                      View
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string, value: number | string }) {
  return (
    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm flex flex-col justify-center text-center">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{title}</h3>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
