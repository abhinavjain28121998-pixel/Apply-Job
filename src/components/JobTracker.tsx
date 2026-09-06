import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { jobService } from '../services/jobService';
import { applicationService } from '../services/applicationService';
import { jobMatchService } from '../services/jobMatchService';
import { SavedJob, Application, JobMatch, Job } from '../types';
import { Plus, ExternalLink, Activity, FileText, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AnalyzeJobModal from './AnalyzeJobModal';

export default function JobTracker() {
  const { user } = useAuth();
  const [trackedJobs, setTrackedJobs] = useState<{saved: SavedJob, match: JobMatch | null, app: Application | null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'STRONG_MATCH' | 'APPLY_WITH_CHANGES' | 'LOW_PRIORITY' | 'APPLIED'>('ALL');
  const navigate = useNavigate();

  const fetchJobs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
      
      const apps = await applicationService.getApplicationsForUser(user.uid);
      const appMap = new Map(apps.map(a => [a.jobId, a]));

      // We need matches too. For now we can fetch individually or add a bulk get. 
      // Let's add a bulk get in jobMatchService or just fetch in loop for simplicity in demo.
      const matchPromises = savedJobsList.map(sj => jobMatchService.getMatch(user.uid, sj.jobId));
      const matches = await Promise.all(matchPromises);
      const matchMap = new Map();
      matches.forEach(m => { if (m) matchMap.set(m.jobId, m); });

      const combined = savedJobsList.map(sj => ({
        saved: sj,
        match: matchMap.get(sj.jobId) || null,
        app: appMap.get(sj.jobId) || null
      }));

      setTrackedJobs(combined.sort((a, b) => b.saved.dateAdded - a.saved.dateAdded));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const seedSampleData = async () => {
    alert("Please go to Find Jobs to search and save realistic jobs. They will automatically be analyzed against your profile.");
  };

  useEffect(() => {
    fetchJobs();
  }, [user]);

  const filteredJobs = trackedJobs.filter(t => {
    if (filter === 'ALL') return true;
    if (filter === 'STRONG_MATCH') return t.match?.recommendation === 'APPLY';
    if (filter === 'APPLY_WITH_CHANGES') return t.match?.recommendation === 'APPLY_WITH_CHANGES';
    if (filter === 'LOW_PRIORITY') return t.match?.recommendation === 'LOW_PRIORITY';
    if (filter === 'APPLIED') return t.app?.status && ['APPLIED', 'INTERVIEW', 'OFFER'].includes(t.app.status);
    return true;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto h-screen flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Job Tracker & Saved Jobs</h1>
          <p className="text-slate-600">Analyze jobs and track your applications.</p>
        </div>
        <button
          onClick={() => setIsAnalyzeModalOpen(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Analyze Manual Job
        </button>
      </div>

      <div className="mb-6 flex gap-2">
        {(['ALL', 'STRONG_MATCH', 'APPLY_WITH_CHANGES', 'LOW_PRIORITY', 'APPLIED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'}`}
          >
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto bg-white border border-slate-200 rounded-xl shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="p-4 font-semibold text-slate-600 text-sm">Company & Title</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Match Score</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Recommendation</th>
              <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
              <th className="p-4 font-semibold text-slate-600 text-sm text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">Loading jobs...</td>
              </tr>
            ) : filteredJobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  <p className="mb-4">No jobs found for this filter.</p>
                  {filter === 'ALL' && (
                    <button onClick={() => navigate('/find-jobs')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                      Find Jobs to Analyze
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredJobs.map(({ saved, match, app }) => (
                <tr key={saved.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{saved.job.title}</div>
                    <div className="text-sm text-slate-500 flex items-center gap-2 mt-1">
                      {saved.job.company}
                      {saved.job.url && (
                        <a href={saved.job.url} target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline inline-flex items-center">
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {match?.matchScore != null ? (
                        <>
                          <div className="w-full bg-slate-200 rounded-full h-2 max-w-[100px]">
                            <div 
                               className={`h-2 rounded-full ${match?.matchScore >= 80 ? 'bg-green-500' : match?.matchScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} 
                               style={{ width: `${match?.matchScore}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">{match?.matchScore}%</span>
                        </>
                      ) : (
                        <span className="text-sm font-medium text-slate-400 italic">Not Analyzed</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                      match?.recommendation === 'APPLY' ? 'bg-green-100 text-green-700' : 
                      match?.recommendation === 'APPLY_WITH_CHANGES' ? 'bg-yellow-100 text-yellow-700' : 
                      match?.recommendation === 'LOW_PRIORITY' ? 'bg-orange-100 text-orange-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {match?.recommendation ? match?.recommendation.replace(/_/g, ' ') : 'UNKNOWN'}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={app?.status || 'SAVED'}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        await applicationService.updateApplicationStatus(user.uid, saved.jobId, newStatus as import("../types").JobStatus);
                        fetchJobs();
                      }}
                      className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-md border-none outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="SAVED">Saved</option>
                      <option value="APPLYING">Applying</option>
                      <option value="APPLIED">Applied</option>
                      <option value="INTERVIEW">Interview</option>
                      <option value="OFFER">Offer</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => navigate(`/workspace/${saved.jobId}`)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Workspace
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isAnalyzeModalOpen && (
        <AnalyzeJobModal 
          onClose={() => setIsAnalyzeModalOpen(false)} 
          onJobAdded={fetchJobs} 
        />
      )}
    </div>
  );
}
