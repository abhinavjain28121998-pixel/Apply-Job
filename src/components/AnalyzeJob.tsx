import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Job } from '../types';
import { jobService } from '../services/jobService';
import { resumeService } from '../services/resumeService';
import { isValidLinkedInUrl } from '../services/linkedinService';
import { safeFetchJson } from '../lib/api';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Bookmark } from 'lucide-react';

export default function AnalyzeJob() {
  const { user, getToken } = useAuth();
  const navigate = useNavigate();
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAnalyzing(false);
    setError('');
    setSuccess('');

    // Form validation
    if (!company.trim()) {
      setError('Company name is required.');
      return;
    }
    if (!title.trim()) {
      setError('Job title is required.');
      return;
    }
    if (!description.trim()) {
      setError('Job description is required.');
      return;
    }

    if (url.trim() && !isValidLinkedInUrl(url.trim())) {
      setError('Invalid LinkedIn Job URL. Please provide an official LinkedIn URL (e.g., https://www.linkedin.com/jobs/view/... or https://linkedin.com/jobs/search/...).');
      return;
    }

    setAnalyzing(true);

    try {
      // 1. Fetch Profile to get CV text
      const profile = await resumeService.getProfile(user.uid);
      if (!profile.baseCvText || !profile.baseCvText.trim()) {
        throw new Error("You must upload or paste your master CV in the 'My Resume' section before analyzing a job.");
      }
      const baseCv = profile.baseCvText;

      // 2. Query server for Gemini matching/tailoring analysis
      const token = await getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const result = await safeFetchJson('/api/analyze-job', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jobDescription: description, baseCv })
      });

      if (!result.ok || !result.data) {
        throw new Error(result.error || "Failed to analyze job match with Gemini.");
      }

      const analysis = result.data;

      // 3. Normalize & Save Job model into Firestore/local state
      const isLinkedIn = url.toLowerCase().includes('linkedin.com') || !url;
      const newJobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const jobData = {
        id: newJobId,
        company: company.trim(),
        title: title.trim(),
        url: url.trim() || `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(title.trim() + ' ' + company.trim())}`,
        description: description.trim(),
        source: isLinkedIn ? 'linkedin' : 'manual',
        postedDate: Date.now()
      };

      await jobService.saveJob(user.uid, jobData as Job);

      // 4. Save Match results
      const { jobMatchService } = await import('../services/jobMatchService');
      const newMatch = { ...analysis, jobId: newJobId, userId: user.uid, resumeVersion: profile.version || 'v1' };
      await jobMatchService.saveMatch(newMatch);

      // Create an initial application record with 'SAVED' status
      const { applicationService } = await import('../services/applicationService');
      await applicationService.createOrUpdateApplication(user.uid, newJobId, {
        status: 'SAVED',
        datePrepared: Date.now(),
        matchScore: analysis.matchScore || null
      });

      setSuccess('Job successfully analyzed and saved!');
      setTimeout(() => {
        navigate(`/workspace/${newJobId}`);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during job analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Analyze Job</h1>
        <p className="text-slate-600">
          Paste a LinkedIn job posting URL and description to perform immediate Gemini match analysis, resume tailoring, and cover letter generation.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
          <Bookmark className="w-5 h-5 text-indigo-600" />
          <h2 className="font-bold text-slate-800 text-lg">Import & Analyze LinkedIn Job</h2>
        </div>

        <form onSubmit={handleAnalyze} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Company *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Google"
                value={company} 
                onChange={e => setCompany(e.target.value)} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Job Title *</label>
              <input 
                type="text" 
                required 
                placeholder="e.g. Staff Frontend Engineer"
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">LinkedIn Job URL (Optional)</label>
            <input 
              type="text" 
              placeholder="https://www.linkedin.com/jobs/view/..."
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm" 
            />
            <p className="text-xs text-slate-400 mt-1">If provided, this must be a valid, trusted LinkedIn domain URL.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Job Description *</label>
            <textarea 
              required 
              rows={12}
              placeholder="Paste the full job description text from LinkedIn here..."
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none text-sm font-mono leading-relaxed resize-none" 
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={analyzing || !company.trim() || !title.trim() || !description.trim()}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold text-sm transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Match with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Analyze & Import Job</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
