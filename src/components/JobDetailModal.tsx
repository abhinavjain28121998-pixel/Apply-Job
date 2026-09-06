import React, { useState } from 'react';
import { Job, JobMatch } from '../types';
import { X, MapPin, Briefcase, IndianRupee, Clock, CheckCircle2, AlertTriangle, Building, Save, FileText, Send, Star, Linkedin, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { buildLinkedInSearchUrlForJob } from '../services/linkedinService';

interface JobDetailModalProps {
  job: Partial<Job>;
  match: JobMatch | null;
  isSaved: boolean;
  onClose: () => void;
  onSave: () => void;
  onApplied: () => void;
}

export default function JobDetailModal({ job, match, isSaved, onClose, onSave, onApplied }: JobDetailModalProps) {
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
              {match?.matchScore !== undefined && (
                 <div className="flex flex-col items-center justify-center bg-white border border-slate-200 rounded-lg p-2 min-w-[80px]">
                   <span className={`text-2xl font-bold ${match?.matchScore >= 80 ? 'text-green-600' : match?.matchScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                     {match?.matchScore}%
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
            {match?.matchScore !== undefined && (
              <div className="mb-8 space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2 flex items-center justify-between">
                    <span>Match Analysis</span>
                    {match?.confidenceScore !== undefined && (
                      <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full">
                        Confidence: {match.confidenceLevel || 'HIGH'} ({match.confidenceScore}%)
                      </span>
                    )}
                  </h3>
                  <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
                    <p className="text-slate-700 leading-relaxed font-medium">{match?.matchExplanation}</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                      <div>
                        <h4 className="font-semibold text-sm text-green-700 flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4"/> Matched Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {match?.matchedSkills?.map(s => <span key={s} className="px-2 py-1 bg-green-50 border border-green-100 text-green-700 rounded-md text-xs font-medium">{s}</span>)}
                        </div>
                      </div>
                      {(match?.missingRequiredSkills && match?.missingRequiredSkills.length > 0) && (
                        <div>
                          <h4 className="font-semibold text-sm text-red-700 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4"/> Missing Core Requirements</h4>
                          <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                            {match?.missingRequiredSkills.map(s => <li key={s}>{s}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Keyword Gap Analysis */}
                {match.keywordGaps && match.keywordGaps.length > 0 && (
                  <div>
                    <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-indigo-600" />
                      <span>Keyword Gap Analysis</span>
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="divide-y divide-slate-100">
                        {match.keywordGaps.slice(0, 8).map((gap, idx) => (
                          <div key={idx} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-sm">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-800">{gap.keyword}</span>
                                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                                  gap.importance === 'REQUIRED' ? 'bg-red-50 text-red-700 border border-red-200' :
                                  gap.importance === 'PREFERRED' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                  'bg-slate-50 text-slate-600 border border-slate-200'
                                }`}>
                                  {gap.importance}
                                </span>
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                                  gap.foundInResume ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  {gap.foundInResume ? 'Verified in CV' : 'Not in Base CV'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500">{gap.recommendation}</p>
                            </div>
                            {gap.evidence && (
                              <span className="text-xs text-slate-400 italic max-w-xs truncate shrink-0">
                                {gap.evidence}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actionable Resume Recommendations */}
                {match.resumeRecommendations && match.resumeRecommendations.length > 0 && (
                  <div>
                    <h3 className="text-md font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-600" />
                      <span>Actionable Resume Recommendations</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {match.resumeRecommendations.slice(0, 4).map((rec, idx) => (
                        <div key={idx} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h5 className="font-semibold text-xs text-indigo-900">{rec.headline}</h5>
                            <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              {rec.category.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">{rec.suggestion}</p>
                          {rec.groundingEvidence && (
                            <p className="text-[11px] text-slate-400 italic">Grounding: {rec.groundingEvidence}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              {match?.recommendation && (
                 <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold uppercase tracking-wider ${
                  match?.recommendation === 'APPLY' ? 'bg-green-100 text-green-700' : 
                  match?.recommendation === 'APPLY_WITH_CHANGES' ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-slate-100 text-slate-500'
                }`}>
                  {match?.recommendation.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={buildLinkedInSearchUrlForJob(job)}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 bg-blue-50 text-[#0A66C2] border border-blue-200 hover:bg-blue-100 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm"
                title="Search for this job and company on LinkedIn in a new tab"
              >
                <Linkedin className="w-4 h-4 text-[#0A66C2]" />
                <span>Search on LinkedIn</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>

              {isSaved ? (
                 <span className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-lg font-medium flex items-center gap-2 text-sm">
                   <CheckCircle2 className="w-4 h-4" /> Saved
                 </span>
              ) : (
                <button onClick={onSave} className="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm">
                  <Save className="w-4 h-4" /> Save Job
                </button>
              )}
              
              <button 
                onClick={() => navigate(`/workspace/${job.id}`)} 
                disabled={!isSaved}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 text-sm"
              >
                <FileText className="w-4 h-4" /> {isSaved ? 'Open Workspace' : 'Save First to Open Workspace'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
