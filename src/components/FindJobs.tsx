import React, { useState, useEffect } from 'react';


import { useAuth } from '../AuthContext';
import { Job, SearchFilters, ProviderStatus } from '../types';
import { jobService } from '../services/jobService';
import { resumeService } from '../services/resumeService';
import { Search, MapPin, Briefcase, IndianRupee, Loader2, Star, CheckCircle2, Clock, Filter, AlertTriangle, Building, Save, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import JobDetailModal from './JobDetailModal';

export default function FindJobs() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<SearchFilters>({ query: '', location: '', workMode: '' });
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Partial<Job>[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [baseCv, setBaseCv] = useState<string>('');
  const [sortBy, setSortBy] = useState<'MATCH' | 'RECENT' | 'SALARY'>('MATCH');
  const [selectedJob, setSelectedJob] = useState<Partial<Job> | null>(null);
  
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [savedJobs, setSavedJobs] = useState<Map<string, Partial<Job>>>(new Map());
  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const jobs = await jobService.getJobsForUser(user.uid);
      const savedMap = new Map<string, Partial<Job>>();
      const savedIds = new Set<string>();
      jobs.forEach(j => {
        savedIds.add(j.id!);
        savedMap.set(j.id!, j);
      });
      setSavedJobIds(savedIds);
      setSavedJobs(savedMap);
    };
    fetchUserData();
  }, [user]);

  useEffect(() => {
    fetch('/api/provider/status')
      .then(res => res.json())
      .then(data => setProviderStatus(data))
      .catch(console.error);
  }, []);

  const handleSearch = async (loadMore = false) => {
    if (!user) return;
    setSearching(true);
    const targetPage = loadMore ? page + 1 : 1;
    
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, page: targetPage, limit: 10 })
      });
      
      if (res.ok) {
        const data = await res.json();
        setProviderStatus(data.status);
        setHasMore(data.hasMore);
        setPage(targetPage);
        
        const newJobs = data.jobs;
        setResults(loadMore ? [...results, ...newJobs] : newJobs);
        
        // Auto-analysis is disabled to avoid hitting rate limits on search
        // Users can analyze individual jobs from the Workspace
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  const analyzeJobsSequentially = async (jobsToAnalyze: Partial<Job>[]) => {
    for (const job of jobsToAnalyze) {
      if (job.matchScore) continue;
      setAnalyzingIds(prev => new Set(prev).add(job.id!));
      try {
        const res = await fetch('/api/analyze-job', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobDescription: job.description,
            baseCv: baseCv
          })
        });
        
        if (res.ok) {
          const analysis = await res.json();
          
          // If the job is saved, persist the analysis to jobService immediately
          if (savedJobIds.has(job.id!)) {
             await jobService.updateJob(job.id!, analysis);
             // Also update local savedJobs map
             setSavedJobs(prev => {
                const next = new Map(prev);
                const existing = next.get(job.id!) || job;
                next.set(job.id!, { ...existing, ...analysis });
                return next;
             });
          } else {
             // If not saved, we just save it now automatically as they analyzed it
             await saveJob({ ...job, ...analysis });
          }

          setResults(prev => prev.map(j => {
            if (j.id === job.id) return { ...j, ...analysis };
            return j;
          }));
        }
      } catch (err) {
        console.error("Failed to analyze job", job.id);
      } finally {
        setAnalyzingIds(prev => {
          const next = new Set(prev);
          next.delete(job.id!);
          return next;
        });
      }
    }
  };

  const clearFilters = () => {
    setFilters({ query: '', location: '', workMode: '' });
  };

  const saveJob = async (job: Partial<Job>) => {
    if (!user || !job.id) return;
    try {
      const fullJob: Job = {
        ...(job as Job),
        userId: user.uid,
        status: 'SAVED',
        dateAdded: Date.now()
      };
      await jobService.saveJob(fullJob);
      setSavedJobIds(prev => new Set(prev).add(job.id!));
    } catch (err) {
      console.error("Failed to save job", err);
    }
  };

  const getSortedResults = () => {
    let sorted = [...results];
    if (sortBy === 'MATCH') {
      sorted.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    } else if (sortBy === 'RECENT') {
      sorted.sort((a, b) => (b.postedDate || 0) - (a.postedDate || 0));
    } else if (sortBy === 'SALARY') {
      const parseSalary = (s?: string) => {
        if (!s) return 0;
        const match = s.match(/(\d+)/);
        return match ? parseInt(match[0], 10) : 0;
      };
      sorted.sort((a, b) => parseSalary(b.salaryRange) - parseSalary(a.salaryRange));
    }
    return sorted;
  };

  const getTimeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const sortedResults = getSortedResults().map(job => savedJobs.has(job.id!) ? { ...job, ...savedJobs.get(job.id!) } : job);

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Filters Sidebar */}
      <div className="w-full md:w-80 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sticky top-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold text-lg flex items-center gap-2"><Filter className="w-5 h-5"/> Filters</h2>
            <button onClick={clearFilters} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">Clear All</button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Keywords / Title</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  value={filters.query}
                  onChange={e => setFilters({...filters, query: e.target.value})}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                  placeholder="e.g. React, Manager"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text" 
                  value={filters.location}
                  onChange={e => setFilters({...filters, location: e.target.value})}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm"
                  placeholder="e.g. Bengaluru"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Work Mode</label>
              <select 
                value={filters.workMode}
                onChange={e => setFilters({...filters, workMode: e.target.value as any})}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm bg-white"
              >
                <option value="">Any Work Mode</option>
                <option value="Remote">Remote</option>
                <option value="Hybrid">Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <button 
              onClick={() => handleSearch(false)}
              disabled={searching}
              className="w-full mt-4 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              {searching && !hasMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching && !hasMore ? 'Searching...' : 'Search Jobs'}
            </button>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1">
        {providerStatus?.status === 'DEMO' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-bold">Demo Mode Active</h4>
              <p className="text-sm opacity-90">Currently displaying mock data for preview purposes. Configure production API credentials in Settings to see live Naukri jobs.</p>
            </div>
          </div>
        )}
        {providerStatus?.status === 'NOT_CONFIGURED' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <h4 className="font-bold">Provider Not Configured</h4>
              <p className="text-sm opacity-90">Naukri integration is not configured. Please supply API credentials to enable live search.</p>
            </div>
          </div>
        )}

        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Discovered Jobs</h1>
            <p className="text-slate-600 text-sm mt-1">Found {results.length} jobs matching your criteria.</p>
          </div>
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Sort by:</span>
              <select 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-white border border-slate-300 rounded-lg text-sm px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="MATCH">Best Match</option>
                <option value="RECENT">Most Recent</option>
                <option value="SALARY">Highest Salary</option>
              </select>
            </div>
          )}
        </div>

        {results.length === 0 && !searching && (
          <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">No jobs found</h3>
            <p className="text-slate-500 max-w-sm">Adjust your filters and click Search to find opportunities matching your profile.</p>
            <button onClick={() => handleSearch(false)} className="mt-6 px-6 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium hover:bg-indigo-100 transition-colors">
              Load Suggested Jobs
            </button>
          </div>
        )}

        <div className="space-y-4">
          {sortedResults.map(job => {
            const isAnalyzing = analyzingIds.has(job.id!);
            const isSaved = savedJobIds.has(job.id!);

            return (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                {job.recommendation === 'APPLY' && (
                  <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 uppercase tracking-wider rounded-bl-lg flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> Top Match
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{job.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Building className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-700">{job.company}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-medium">{job.source}</span>
                    </div>
                  </div>
                  
                  {job.matchScore !== undefined ? (
                     <div className="flex flex-col items-end">
                       <div className="flex items-center gap-2">
                         <div className={`text-2xl font-bold ${job.matchScore >= 80 ? 'text-green-600' : job.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                           {job.matchScore}%
                         </div>
                         <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right leading-tight">Match<br/>Score</div>
                       </div>
                     </div>
                  ) : isAnalyzing ? (
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Fit
                    </div>
                  ) : (
                    <button 
                      onClick={() => analyzeJobsSequentially([job])}
                      className="flex items-center gap-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                    >
                      Analyze Fit
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-5">
                  {job.location && <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {job.location} ({job.workMode})</div>}
                  {job.experienceRequired && <div className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {job.experienceRequired}</div>}
                  {job.salaryRange && <div className="flex items-center gap-1.5"><IndianRupee className="w-4 h-4 text-slate-400" /> {job.salaryRange}</div>}
                  {job.postedDate && <div className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-slate-400" /> {getTimeAgo(job.postedDate)}</div>}
                </div>

                {job.matchScore !== undefined && (
                  <div className="mb-5 bg-slate-50 border border-slate-100 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-3">{job.matchExplanation}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {job.missingRequiredSkills && job.missingRequiredSkills.length > 0 && (
                         <div className="flex items-start gap-2 text-sm text-red-700">
                           <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                           <span>Missing: <span className="font-medium">{job.missingRequiredSkills.join(', ')}</span></span>
                         </div>
                      )}
                      {job.matchedSkills && job.matchedSkills.length > 0 && (
                         <div className="flex items-start gap-2 text-sm text-green-700">
                           <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                           <span>Matches: <span className="font-medium">{job.matchedSkills.slice(0, 3).join(', ')}{job.matchedSkills.length > 3 ? ` +${job.matchedSkills.length - 3}` : ''}</span></span>
                         </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                  <div className="flex items-center gap-2">
                    {job.recommendation && (
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        job.recommendation === 'APPLY' ? 'bg-green-100 text-green-700' : 
                        job.recommendation === 'APPLY_WITH_CHANGES' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {job.recommendation.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex gap-3">
                    {isSaved ? (
                      <Link to="/tracker" className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Saved
                      </Link>
                    ) : (
                      <button onClick={() => saveJob(job)} className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                        <Save className="w-4 h-4" /> Save Job
                      </button>
                    )}
                    <button onClick={() => setSelectedJob(job)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
          
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => handleSearch(true)}
                disabled={searching}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {searching ? 'Loading...' : 'Load More Jobs'}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isSaved={savedJobIds.has(selectedJob.id!)}
          onClose={() => setSelectedJob(null)}
          onSave={() => saveJob(selectedJob)}
          onApplied={() => {}}
        />
      )}
    </div>
  );
}
