import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Job, 
  JobMatch, 
  SearchFilters, 
  ProviderStatus, 
  SavedLinkedInSearch, 
  UserProfile,
  JobSearchPreferences,
  LinkedInStatusResponse
} from '../types';
import { jobService } from '../services/jobService';
import { jobMatchService } from '../services/jobMatchService';
import { resumeService } from '../services/resumeService';
import { preferenceService } from '../services/preferenceService';
import { linkedinAuthService } from '../services/linkedinAuthService';
import {
  buildLinkedInJobsUrl,
  buildLinkedInSearchUrlForJob,
  buildLinkedInSearchUrlFromProfile,
  linkedinSearchService
} from '../services/linkedinService';
import {
  Search,
  MapPin,
  Briefcase,
  IndianRupee,
  Loader2,
  Star,
  CheckCircle2,
  Clock,
  Filter,
  AlertTriangle,
  Building,
  Save,
  Info,
  Linkedin,
  ExternalLink,
  Sparkles,
  Bookmark,
  Trash2,
  Globe,
  Sliders,
  UserCheck,
  LogOut,
  Check,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import JobDetailModal from './JobDetailModal';
import SearchPreferencesModal from './SearchPreferencesModal';
import { safeFetchJson } from '../lib/api';

export default function FindJobs() {
  const { user, getToken } = useAuth();
  const [filters, setFilters] = useState<SearchFilters>({ query: '', location: '', workMode: '' });
  const [selectedSource, setSelectedSource] = useState<'all' | 'linkedin'>('all');
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<Job[]>([]);
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set());
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'MATCH' | 'RECENT' | 'SALARY'>('MATCH');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  
  const [providerStatus, setProviderStatus] = useState<ProviderStatus | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [matches, setMatches] = useState<Map<string, JobMatch>>(new Map());
  const [userProfile, setUserProfile] = useState<Partial<UserProfile> | null>(null);
  const [savedLinkedInSearches, setSavedLinkedInSearches] = useState<SavedLinkedInSearch[]>([]);
  const [searchSavedMessage, setSearchSavedMessage] = useState<string | null>(null);
  const [savingSearch, setSavingSearch] = useState(false);

  // Search Preferences & LinkedIn Integration States
  const [preferences, setPreferences] = useState<JobSearchPreferences | null>(null);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatusResponse | null>(null);
  const [connectingLinkedIn, setConnectingLinkedIn] = useState(false);
  const [connectMessage, setConnectMessage] = useState<string | null>(null);

  const refreshLinkedInStatus = async (uid?: string) => {
    try {
      const status = await linkedinAuthService.getStatus(uid || user?.uid);
      setLinkedInStatus(status);
    } catch (e) {
      console.warn('Failed to load LinkedIn status:', e);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchUserData = async () => {
      const savedJobsList = await jobService.getSavedJobsForUser(user.uid);
      const savedIds = new Set<string>();
      savedJobsList.forEach(sj => savedIds.add(sj.jobId));
      setSavedJobIds(savedIds);
      
      const persistedMatches = await jobMatchService.getMatchesForUser(user.uid);
      const matchMap = new Map<string, JobMatch>();
      persistedMatches.forEach(m => matchMap.set(m.jobId, m));
      setMatches(matchMap);

      const profile = await resumeService.getProfile(user.uid);
      if (profile) setUserProfile(profile);

      const savedSearches = await linkedinSearchService.getSavedSearches(user.uid);
      setSavedLinkedInSearches(savedSearches);

      // Load preferences
      const prefs = await preferenceService.getPreferences(user.uid, profile);
      setPreferences(prefs);
      if (prefs && !filters.query) {
        setFilters(prev => ({
          ...prev,
          query: prefs.keywords?.join(', ') || prefs.jobTitle || prev.query,
          location: prefs.location || prev.location,
          workMode: (prefs.workMode as SearchFilters['workMode']) || prev.workMode
        }));
      }

      // Check LinkedIn Integration Status
      refreshLinkedInStatus(user.uid);
    };
    fetchUserData();
  }, [user]);

  const handleConnectLinkedIn = async () => {
    if (!user) return;
    setConnectingLinkedIn(true);
    setConnectMessage(null);
    try {
      const startRes = await linkedinAuthService.getAuthStart(user.uid);
      if (!startRes.configured || !startRes.authUrl) {
        throw new Error(startRes.error || 'LinkedIn OAuth is not configured with client credentials.');
      }

      await linkedinAuthService.openAuthPopup(startRes.authUrl);
      setConnectMessage('Successfully connected your LinkedIn profile via OpenID Connect!');
      await refreshLinkedInStatus(user.uid);
      setTimeout(() => setConnectMessage(null), 4000);
    } catch (err: any) {
      console.error('LinkedIn connection failed:', err);
      setConnectMessage(err?.message || 'LinkedIn authorization was canceled or failed.');
      setTimeout(() => setConnectMessage(null), 5000);
    } finally {
      setConnectingLinkedIn(false);
    }
  };

  const handleDisconnectLinkedIn = async () => {
    if (!user) return;
    try {
      await linkedinAuthService.disconnect(user.uid);
      await refreshLinkedInStatus(user.uid);
      setConnectMessage('LinkedIn account disconnected.');
      setTimeout(() => setConnectMessage(null), 3000);
    } catch (e: any) {
      console.error('Failed to disconnect LinkedIn:', e);
    }
  };

  const handleSavePreferences = async (updated: Partial<JobSearchPreferences>) => {
    if (!user) return;
    setSavingPreferences(true);
    try {
      const saved = await preferenceService.savePreferences(user.uid, updated);
      setPreferences(saved);
      setShowPreferencesModal(false);
      // Auto-apply to search filters
      setFilters(prev => ({
        ...prev,
        query: saved.keywords?.join(', ') || saved.jobTitle || prev.query,
        location: saved.location || prev.location,
        workMode: (saved.workMode as SearchFilters['workMode']) || prev.workMode
      }));
    } catch (e) {
      console.error('Failed to save preferences:', e);
    } finally {
      setSavingPreferences(false);
    }
  };

  useEffect(() => {
    safeFetchJson('/api/provider/status')
      .then(result => {
        if (result.ok && result.data) {
          setProviderStatus(result.data);
        }
      })
      .catch(err => {
        console.warn('Failed to fetch provider status:', err);
      });
  }, []);

  const saveJob = async (job: Job) => {
    if (!user) return;
    if (savedJobIds.has(job.id!)) return; // Prevent duplicate saves

    try {
      await jobService.saveJob(user.uid, job);
      setSavedJobIds(prev => {
        const next = new Set(prev);
        next.add(job.id!);
        return next;
      });
    } catch (error) {
      console.error('Failed to save job:', error);
    }
  };

  const clearFilters = () => {
    setFilters({ query: '', location: '', workMode: '' });
  };

  const handleSearch = async (loadMore = false) => {
    if (!user) return;
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setSearching(true);
      setPage(1);
      setHasMore(false);
    }
    setSearchError(null);
    const targetPage = loadMore ? page + 1 : 1;
        
    try {
      const result = await safeFetchJson('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...filters, page: targetPage, limit: 10 })
      });
      
      if (!result.ok || !result.data) {
        throw new Error(result.error || `Search failed with status ${result.status}`);
      }

      const data = result.data;
      setProviderStatus(data.status);
      setHasMore(Boolean(data.hasMore));
      setPage(targetPage);
      
      const newJobs: Job[] = data.jobs || [];
      setResults(prev => loadMore ? [...prev, ...newJobs] : newJobs);
    } catch (err: any) {
      console.error('Job search error:', err);
      setSearchError(err?.message || 'Failed to search jobs. Please try again.');
    } finally {
      if (loadMore) {
        setLoadingMore(false);
      } else {
        setSearching(false);
      }
    }
  };

  const analyzeJob = async (job: Job) => {
    if (!user || !job.id) return;
    setAnalyzingIds(prev => new Set(prev).add(job.id!));
    try {
      const profile = await resumeService.getProfile(user.uid);
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const result = await safeFetchJson('/api/analyze-job', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobDescription: job.description,
          baseCv: profile?.baseCvText || ''
        })
      });
      
      if (result.ok && result.data) {
        const analysis = result.data;
        
        // Save the match
        const matchToSave = { ...analysis, jobId: job.id, userId: user.uid };
        await jobMatchService.saveMatch(matchToSave);
        
        setMatches(prev => {
          const next = new Map(prev);
          next.set(job.id!, matchToSave);
          return next;
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyzingIds(prev => {
        const next = new Set(prev);
        next.delete(job.id!);
        return next;
      });
    }
  };

  const getLinkedInSearchUrl = () => {
    return buildLinkedInJobsUrl({
      keywords: filters.query,
      location: filters.location,
      workMode: filters.workMode
    });
  };

  const handleOpenLinkedInSearch = () => {
    const url = getLinkedInSearchUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenLinkedInFromProfile = () => {
    if (!userProfile) return;
    const url = buildLinkedInSearchUrlFromProfile(userProfile);
    // Optionally update current filters to match
    if (userProfile.currentRole) {
      setFilters(prev => ({
        ...prev,
        query: userProfile.currentRole || prev.query,
        location: (userProfile.preferredLocations && userProfile.preferredLocations[0]) || prev.location,
        workMode: (userProfile.workMode as SearchFilters['workMode']) || prev.workMode
      }));
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSaveLinkedInSearch = async () => {
    if (!user) return;
    setSavingSearch(true);
    try {
      const title = filters.query ? `${filters.query}${filters.location ? ` in ${filters.location}` : ''}` : 'LinkedIn Job Search';
      const saved = await linkedinSearchService.saveSearch(user.uid, {
        keywords: filters.query,
        location: filters.location,
        workMode: filters.workMode
      }, title);
      setSavedLinkedInSearches(prev => [saved, ...prev.filter(s => s.id !== saved.id)]);
      setSearchSavedMessage('Search saved to your LinkedIn bookmarks!');
      setTimeout(() => setSearchSavedMessage(null), 3000);
    } catch (e) {
      console.error('Failed to save search:', e);
    } finally {
      setSavingSearch(false);
    }
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    if (!user) return;
    try {
      await linkedinSearchService.deleteSearch(user.uid, searchId);
      setSavedLinkedInSearches(prev => prev.filter(s => s.id !== searchId));
    } catch (e) {
      console.error('Failed to delete saved search:', e);
    }
  };

  const getSortedResults = () => {
    let combined = results.map(job => ({
      job,
      match: matches.get(job.id!) || null,
      saved: savedJobIds.has(job.id!)
    }));
    
    if (sortBy === 'MATCH') {
      combined.sort((a, b) => ((b.match?.matchScore || 0) - (a.match?.matchScore || 0)));
    } else if (sortBy === 'RECENT') {
      combined.sort((a, b) => ((b.job.postedDate || 0) - (a.job.postedDate || 0)));
    } else if (sortBy === 'SALARY') {
      const parseSalary = (s?: string) => {
        if (!s) return 0;
        const match = s.match(/\d+/g);
        if (match && match.length > 0) return parseInt(match[0], 10);
        return 0;
      };
      combined.sort((a, b) => parseSalary(b.job.salaryRange) - parseSalary(a.job.salaryRange));
    }
    return combined;
  };

  const getTimeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const sortedResults = getSortedResults();

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8">
      {/* Filters Sidebar */}
      <div className="w-full md:w-80 shrink-0">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 sticky top-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-lg flex items-center gap-2"><Filter className="w-5 h-5"/> Filters</h2>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setShowPreferencesModal(true)} 
                className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors"
                title="Customize automatic target job title and keywords"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Prefs</span>
                {preferences?.jobTitle && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>}
              </button>
              <button onClick={clearFilters} className="text-xs text-slate-500 hover:text-slate-800 font-medium">Clear</button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discovery Channel</label>
              <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 text-[#0A66C2] px-3 py-2 rounded-lg text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-[#0A66C2] shrink-0" />
                  <span>LinkedIn Jobs (Official Destination)</span>
                </div>
                <span className="bg-white text-[#0A66C2] px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">ACTIVE</span>
              </div>
            </div>

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
                onChange={e => setFilters({...filters, workMode: e.target.value as SearchFilters['workMode']})}
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
              disabled={searching || loadingMore}
              className="w-full mt-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching...' : 'Search Internal Jobs'}
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={handleOpenLinkedInSearch}
                className="w-full bg-[#0A66C2] hover:bg-[#004182] text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
                title="Open official LinkedIn Jobs in a new tab with current filters"
              >
                <Linkedin className="w-4 h-4" />
                Search on LinkedIn
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>

              {userProfile && (
                <button
                  type="button"
                  onClick={handleOpenLinkedInFromProfile}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5 text-xs"
                  title="Find matching jobs on LinkedIn using target role and skills from your profile"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Find on LinkedIn using CV
                </button>
              )}

              <p className="text-[11px] text-slate-500 leading-tight px-1">
                LinkedIn opens in a new tab. Applications are completed directly on LinkedIn.
              </p>

              {/* LinkedIn Account & Integration Info */}
              <div className="pt-3 border-t border-slate-100">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Linkedin className="w-3.5 h-3.5 text-[#0A66C2]" /> LinkedIn Connect
                    </span>
                    {linkedInStatus?.connected ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span> OpenID Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400">
                        Redirect Mode
                      </span>
                    )}
                  </div>

                  {linkedInStatus?.connected && linkedInStatus.account ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {linkedInStatus.account.pictureUrl ? (
                          <img src={linkedInStatus.account.pictureUrl} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                            {linkedInStatus.account.displayName?.[0] || 'L'}
                          </div>
                        )}
                        <div className="truncate text-xs">
                          <p className="font-semibold text-slate-800 truncate">{linkedInStatus.account.displayName}</p>
                          {linkedInStatus.account.email && <p className="text-[10px] text-slate-500 truncate">{linkedInStatus.account.email}</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleDisconnectLinkedIn}
                        className="w-full text-[11px] text-slate-500 hover:text-red-600 hover:bg-red-50 py-1 rounded transition-colors flex items-center justify-center gap-1"
                      >
                        <LogOut className="w-3 h-3" /> Disconnect LinkedIn
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Connect your LinkedIn account via official OpenID Connect for verified profile data.
                      </p>
                      <button
                        type="button"
                        onClick={handleConnectLinkedIn}
                        disabled={connectingLinkedIn}
                        className="w-full py-1.5 px-2 bg-white border border-[#0A66C2]/40 text-[#0A66C2] hover:bg-blue-50 text-xs font-semibold rounded-md transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        {connectingLinkedIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Linkedin className="w-3.5 h-3.5" />}
                        {connectingLinkedIn ? 'Connecting...' : 'Connect with LinkedIn'}
                      </button>
                    </div>
                  )}

                  {connectMessage && (
                    <div className="mt-2 text-[10px] p-1.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                      {connectMessage}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1">
        {searchError && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              <p className="text-sm font-medium">{searchError}</p>
            </div>
            <button 
              onClick={() => setSearchError(null)}
              className="text-xs text-red-600 hover:text-red-800 font-semibold uppercase tracking-wider underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {providerStatus?.status === 'DEMO' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-bold">Demo Mode Active</h4>
              <p className="text-sm opacity-90">Currently displaying demo listings for preview. Use "Search on LinkedIn" to launch live searches on LinkedIn.</p>
            </div>
          </div>
        )}
        {providerStatus?.status === 'NOT_CONFIGURED' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-blue-600" />
            <div>
              <h4 className="font-bold">Official LinkedIn Search Mode</h4>
              <p className="text-sm opacity-90">LinkedIn does not offer public consumer job search APIs. Searches are routed directly through the official LinkedIn Job Search destination.</p>
            </div>
          </div>
        )}
        {providerStatus?.status === 'ERROR' && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <h4 className="font-bold">Provider Connection Error</h4>
              <p className="text-sm opacity-90">{providerStatus.lastError || 'Failed to establish connection with job provider.'}</p>
            </div>
          </div>
        )}
        {providerStatus?.status === 'CONNECTED' && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 p-4 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-green-600" />
            <div>
              <h4 className="font-bold">Provider Connected</h4>
              <p className="text-sm opacity-90">Connected to {providerStatus.provider}. Live job search is active.</p>
            </div>
          </div>
        )}

        {/* LinkedIn External Job Destination Card */}
        <div className="mb-6 bg-gradient-to-r from-blue-50/80 via-white to-indigo-50/50 border border-blue-200 rounded-xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-[#0A66C2] text-white rounded-md">
                  <Linkedin className="w-4 h-4" />
                </span>
                <h3 className="font-bold text-slate-900 text-base">LinkedIn Jobs Search Destination</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-blue-100 text-[#0A66C2] rounded">External Portal</span>
              </div>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                LinkedIn opens in a new browser tab with your criteria pre-configured. Applications are completed directly on LinkedIn. We never scrape, automate, or collect credentials.
              </p>
              {(filters.query || filters.location || filters.workMode) && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
                  <span className="font-medium text-slate-500">Active Criteria:</span>
                  {filters.query && <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">Keywords: <strong>{filters.query}</strong></span>}
                  {filters.location && <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">Location: <strong>{filters.location}</strong></span>}
                  {filters.workMode && <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-700">Mode: <strong>{filters.workMode}</strong></span>}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenLinkedInSearch}
                className="px-4 py-2 bg-[#0A66C2] hover:bg-[#004182] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                <Linkedin className="w-4 h-4" />
                Open LinkedIn Jobs
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={handleSaveLinkedInSearch}
                disabled={savingSearch}
                className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
                title="Bookmark this search criteria"
              >
                <Bookmark className="w-4 h-4 text-slate-500" />
                {savingSearch ? 'Saving...' : 'Bookmark Search'}
              </button>
            </div>
          </div>

          {searchSavedMessage && (
            <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {searchSavedMessage}
            </div>
          )}

          {/* Saved searches list if any */}
          {savedLinkedInSearches.length > 0 && (
            <div className="mt-4 pt-3 border-t border-blue-100">
              <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5" />
                Saved LinkedIn Searches:
              </div>
              <div className="flex flex-wrap gap-2">
                {savedLinkedInSearches.map(saved => (
                  <div key={saved.id} className="group inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-md pl-2.5 pr-1.5 py-1 text-xs text-slate-700 hover:border-blue-300 transition-colors">
                    <a
                      href={saved.generatedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium hover:text-[#0A66C2] flex items-center gap-1"
                    >
                      {saved.title}
                      <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDeleteSavedSearch(saved.id)}
                      className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors"
                      title="Remove saved search"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                onChange={e => setSortBy(e.target.value as "MATCH" | "RECENT" | "SALARY")}
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
          {sortedResults.map(({job, match, saved}) => {
            const isAnalyzing = analyzingIds.has(job.id!);
            const isSaved = saved;

            return (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                {match?.recommendation === "APPLY" && (
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
                      <span className={`text-xs px-2 py-0.5 rounded-md font-semibold flex items-center gap-1 ${
                        job.source === 'LinkedIn' 
                          ? 'bg-blue-50 text-[#0A66C2] border border-blue-200' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {job.source === 'LinkedIn' && <Linkedin className="w-3 h-3 text-[#0A66C2]" />}
                        {job.source === 'LinkedIn' ? 'LinkedIn' : 'Demo Job'}
                      </span>
                    </div>
                  </div>
                  
                  {match ? (
                     <div className="flex flex-col items-end">
                       <div className="flex items-center gap-2">
                         {match.matchScore != null ? (
                           <div className={`text-2xl font-bold ${match.matchScore >= 80 ? 'text-green-600' : match.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                             {match.matchScore}%
                           </div>
                         ) : (
                           <div className="text-sm font-medium text-slate-500">Analysis Unavailable</div>
                         )}
                         <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-right leading-tight">
                           Match<br/>Score
                         </div>
                       </div>
                       {match.confidenceLevel && (
                         <span className="text-[10px] font-semibold text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded">
                           Confidence: {match.confidenceLevel}
                         </span>
                       )}
                     </div>
                  ) : isAnalyzing ? (
                    <div className="flex items-center gap-2 text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-medium">
                      <Loader2 className="w-4 h-4 animate-spin" /> Analyzing Fit
                    </div>
                  ) : (
                    <button 
                      onClick={() => analyzeJob(job)}
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

                {match?.matchScore != null && (
                  <div className="mb-5 bg-slate-50 border border-slate-100 rounded-lg p-4">
                    <p className="text-sm text-slate-700 mb-3">{match?.matchExplanation}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {match?.missingRequiredSkills && match?.missingRequiredSkills.length > 0 && (
                         <div className="flex items-start gap-2 text-sm text-red-700">
                           <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                           <span>Missing: <span className="font-medium">{match?.missingRequiredSkills.join(', ')}</span></span>
                         </div>
                      )}
                      {match?.matchedSkills && match?.matchedSkills.length > 0 && (
                         <div className="flex items-start gap-2 text-sm text-green-700">
                           <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                           <span>Matches: <span className="font-medium">{match?.matchedSkills.slice(0, 3).join(', ')}{match?.matchedSkills.length > 3 ? ` +${match?.matchedSkills.length - 3}` : ''}</span></span>
                         </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                  <div className="flex items-center gap-2">
                    {match?.recommendation && (
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                        match?.recommendation === "APPLY" ? 'bg-green-100 text-green-700' : 
                        match?.recommendation === 'APPLY_WITH_CHANGES' ? 'bg-yellow-100 text-yellow-700' : 
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {match?.recommendation.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={buildLinkedInSearchUrlForJob(job)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 border border-[#0A66C2]/30 text-[#0A66C2] bg-blue-50/50 hover:bg-blue-100/70 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
                      title="Search for this job or company on LinkedIn (opens in new tab)"
                    >
                      <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                      <span>Search on LinkedIn</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                    </a>
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
                disabled={searching || loadingMore}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-70"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? 'Loading More Jobs...' : 'Load More Jobs'}
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedJob && (
        <JobDetailModal
          job={selectedJob}
          match={matches.get(selectedJob.id!) || null}
          isSaved={savedJobIds.has(selectedJob.id!)}
          onClose={() => setSelectedJob(null)}
          onSave={() => saveJob(selectedJob)}
          onApplied={() => {}}
        />
      )}

      {showPreferencesModal && (
        <SearchPreferencesModal
          preferences={preferences}
          onClose={() => setShowPreferencesModal(false)}
          onSave={handleSavePreferences}
        />
      )}
    </div>
  );
}
