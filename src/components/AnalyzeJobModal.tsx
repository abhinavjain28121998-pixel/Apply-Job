import React, { useState } from 'react';


import { useAuth } from '../AuthContext';
import { X, Loader2 } from 'lucide-react';
import { jobService } from '../services/jobService';
import { resumeService } from '../services/resumeService';

export default function AnalyzeJobModal({ onClose, onJobAdded }: { onClose: () => void, onJobAdded: () => void }) {
  const { user } = useAuth();
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAnalyzing(true);
    setError('');

    try {
      // 1. Get base CV
      const profile = await resumeService.getProfile(user.uid);
      if (!profile.baseCvText) {
        throw new Error("You must add your Base CV in the Profile section before analyzing a job.");
      }
      const baseCv = profile.baseCvText;

      // 2. Call backend for analysis
      const res = await fetch('/api/analyze-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobDescription: description, baseCv })
      });

      if (!res.ok) {
        throw new Error("Failed to analyze job.");
      }

      const analysis = await res.json();

      // 3. Save to Firestore
      
      
      const newJobId = String(Math.random());
      const jobData = {
        id: newJobId,
        company,
        title,
        url,
        description,
        source: 'Manual'
      };
      
      await jobService.saveJob(user.uid, jobData as any);
      
      // Save the match
      const { jobMatchService } = await import('../services/jobMatchService');
      const newMatch = { ...analysis, jobId: newJobId, userId: user.uid };
      await jobMatchService.saveMatch(newMatch);

      onJobAdded();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800">Analyze New Job</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        <form onSubmit={handleAnalyze} className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
          {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company *</label>
              <input required value={company} onChange={e => setCompany(e.target.value)} type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Job Title *</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Job URL (optional)</label>
            <input value={url} onChange={e => setUrl(e.target.value)} type="url" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>

          <div className="flex-1 flex flex-col">
            <label className="block text-sm font-medium text-slate-700 mb-1">Job Description *</label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full flex-1 min-h-[200px] p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none font-mono text-sm" placeholder="Paste full job description here..."></textarea>
          </div>
        </form>

        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleAnalyze} 
            disabled={analyzing || !company || !title || !description} 
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : 'Analyze Job Match'}
          </button>
        </div>
      </div>
    </div>
  );
}
