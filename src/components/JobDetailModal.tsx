import React, { useState } from 'react';
import { Job } from '../types';
import { X, MapPin, Briefcase, IndianRupee, Clock, CheckCircle2, AlertTriangle, Building, Save, FileText, Send, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JobDetailModalProps {
  job: Partial<Job>;
  isSaved: boolean;
  onClose: () => void;
  onSave: () => void;
  onApplied: () => void;
}

export default function JobDetailModal({ job, isSaved, onClose, onSave, onApplied }: JobDetailModalProps) {
  const navigate = useNavigate();

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          
          <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50 shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Building className="w-5 h-5 text-indigo-600" />
                <h3 className="text-lg font-semibold text-indigo-900">{job.company}</h3>
              </div>
              <h2 className="text-2xl font-bold text-slate-800">{job.title}</h2>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-3">
                {job.location && <div className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-slate-400" /> {job.location} ({job.workMode})</div>}
                {job.experienceRequired && <div className="flex items-center gap-1.5"><Briefcase className="w-4 h-4 text-slate-400" /> {job.experienceRequired}</div>}
                {job.salaryRange && <div className="flex items-center gap-1.5"><IndianRupee className="w-4 h-4 text-slate-400" /> {job.salaryRange}</div>}
              </div>
            </div>
            <div className="flex items-start gap-4">
              {job.matchScore !== undefined && (
                 <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg p-2 min-w-[80px]">
                   <span className={`text-2xl font-bold ${job.matchScore >= 80 ? 'text-green-600' : job.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                     {job.matchScore}%
                   </span>
                   <span className="text-[10px] uppercase font-bold text-slate-400">Match</span>
                 </div>
              )}
              <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
            
            {/* Match Analysis Section */}
            {job.matchScore !== undefined && (
              <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Match Analysis</h3>
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                  <p className="text-slate-700 leading-relaxed font-medium">{job.matchExplanation}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                      <h4 className="font-semibold text-sm text-green-700 flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4"/> Matched Skills</h4>
                      <div className="flex flex-wrap gap-2">
                        {job.matchedSkills?.map(s => <span key={s} className="px-2 py-1 bg-green-50 border border-green-100 text-green-700 rounded-md text-xs font-medium">{s}</span>)}
                      </div>
                    </div>
                    {(job.missingRequiredSkills && job.missingRequiredSkills.length > 0) && (
                      <div>
                        <h4 className="font-semibold text-sm text-red-700 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4"/> Missing Core Requirements</h4>
                        <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                          {job.missingRequiredSkills.map(s => <li key={s}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Job Description</h3>
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                  {job.description}
                </div>
              </div>
            </div>

          </div>

          <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
              {job.recommendation && (
                 <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider ${
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
                 <span className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium flex items-center gap-2">
                   <CheckCircle2 className="w-5 h-5" /> Saved
                 </span>
              ) : (
                <button onClick={onSave} className="px-6 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <Save className="w-5 h-5" /> Save Job
                </button>
              )}
              
              <button 
                onClick={() => navigate(`/workspace/${job.id}`)} 
                disabled={!isSaved}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                <FileText className="w-5 h-5" /> {isSaved ? 'Open Workspace' : 'Save First to Open Workspace'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
