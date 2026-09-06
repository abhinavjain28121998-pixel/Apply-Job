import React, { useEffect, useState } from 'react';


import { useAuth } from '../AuthContext';
import { Job } from '../types';
import { jobService } from '../services/jobService';
import { Briefcase, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const fetchedJobs = await jobService.getJobsForUser(user.uid);
        setJobs(fetchedJobs.sort((a, b) => b.dateAdded - a.dateAdded));
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
  const jobsAnalyzed = jobs.filter(j => j.matchScore !== undefined).length;
  const strongMatches = jobs.filter(j => j.recommendation === 'APPLY').length;
  const applicationsSubmitted = jobs.filter(j => ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.status)).length;
  const interviews = jobs.filter(j => j.status === 'INTERVIEW' || j.status === 'OFFER').length;
  const offers = jobs.filter(j => j.status === 'OFFER').length;
  
  const appToInterviewRate = applicationsSubmitted > 0 ? Math.round((interviews / applicationsSubmitted) * 100) : 0;
  const avgMatchScore = jobsAnalyzed > 0 ? Math.round(jobs.reduce((acc, job) => acc + (job.matchScore || 0), 0) / jobsAnalyzed) : 0;

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
            {jobs.filter(j => j.recommendation === 'APPLY').length === 0 ? (
              <div className="p-8 text-center text-slate-500">No highly recommended jobs yet. Analyze a job to see it here.</div>
            ) : (
              jobs.filter(j => j.recommendation === 'APPLY').slice(0, 5).map(job => (
                <div key={job.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 className="font-medium text-slate-900">{job.title}</h3>
                    <p className="text-sm text-slate-500">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-indigo-600">{job.matchScore}% Match</p>
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
            {jobs.filter(j => ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.status)).length === 0 ? (
              <div className="p-8 text-center text-slate-500">No applications submitted yet.</div>
            ) : (
              jobs.filter(j => ['APPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(j.status)).slice(0, 5).map(job => (
                <div key={job.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 className="font-medium text-slate-900">{job.title}</h3>
                    <p className="text-sm text-slate-500">{job.company}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-md ${job.status === 'INTERVIEW' || job.status === 'OFFER' ? 'bg-green-100 text-green-700' : job.status === 'REJECTED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                      {job.status}
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
