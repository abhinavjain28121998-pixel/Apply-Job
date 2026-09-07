/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { 
  Briefcase, 
  LayoutDashboard, 
  UserCircle, 
  LogOut, 
  Search, 
  Linkedin, 
  Sparkles, 
  FileText, 
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { isFirebaseConfigured } from './firebase';
import { cn } from './lib/utils';
import { safeFetchJson } from './lib/api';

// Imports of core views
import Dashboard from './components/Dashboard';
import FindJobs from './components/FindJobs';
import AnalyzeJob from './components/AnalyzeJob';
import JobTracker from './components/JobTracker';
import MyProfile from './components/MyProfile';
import MyResume from './components/MyResume';
import LinkedInConnection from './components/LinkedInConnection';
import Settings from './components/Settings';
import ApplicationWorkspace from './components/ApplicationWorkspace';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-slate-600">Verifying session...</span>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function Login() {
  const { user, signIn } = useAuth();
  if (user) return <Navigate to="/" />;
  const hasFirebase = isFirebaseConfigured();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 text-slate-900 font-sans p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-[#0A66C2] rounded-xl flex items-center justify-center text-white mb-6 shadow-sm">
          <Linkedin className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-2">LinkedIn AI Job Assistant</h1>
        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
          Your secure, private dashboard for personal job analysis, resume tailoring, and direct LinkedIn application tracking.
        </p>
        
        {hasFirebase ? (
          <button
            onClick={signIn}
            className="w-full bg-[#0A66C2] text-white py-3 px-5 rounded-xl font-semibold hover:bg-[#004182] transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg cursor-pointer text-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google Secure OIDC</span>
          </button>
        ) : (
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl font-medium leading-relaxed">
            Firebase project environment variables are currently missing or unconfigured. Please connect a Firestore database instance first.
          </div>
        )}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, logOut } = useAuth();
  const location = useLocation();
  const [providerStatus, setProviderStatus] = React.useState<any>(null);
  
  React.useEffect(() => {
    safeFetchJson('/api/provider/status')
      .then(result => {
        if (result.ok && result.data?.status) {
          setProviderStatus(result.data.status);
        }
      })
      .catch((err) => {
        console.warn('Failed to fetch provider status:', err);
      });
  }, [location.pathname]);

  const getPageHeader = () => {
    switch (location.pathname) {
      case '/': return 'Dashboard Overview';
      case '/find-jobs': return 'LinkedIn Job Search';
      case '/analyze-job': return 'Gemini Job Match Workspace';
      case '/tracker': return 'Application Pipeline Tracker';
      case '/profile': return 'My Candidate Profile';
      case '/resume': return 'Master CV & Baseline Resume';
      case '/connection': return 'LinkedIn Profile Connection';
      case '/settings': return 'Assistant Configuration Settings';
      default: return 'LinkedIn AI Assistant';
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex fixed h-full z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-[#0A66C2] rounded-lg flex items-center justify-center text-white">
            <Linkedin className="w-5 h-5" />
          </div>
          <span className="font-bold tracking-tight text-slate-800 text-sm">LinkedIn AI Assistant</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Analytics</div>
          <Link to="/" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          
          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider pt-4">Job Discovery</div>
          <Link to="/find-jobs" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/find-jobs' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Search className="w-4 h-4" />
            Find Jobs
          </Link>
          <Link to="/analyze-job" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/analyze-job' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Sparkles className="w-4 h-4 text-amber-500" />
            Analyze Job
          </Link>
          <Link to="/tracker" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/tracker' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Briefcase className="w-4 h-4" />
            Applications
          </Link>

          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider pt-4">Candidate Identity</div>
          <Link to="/profile" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/profile' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <UserCircle className="w-4 h-4" />
            My Profile
          </Link>
          <Link to="/resume" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/resume' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <FileText className="w-4 h-4" />
            My Resume
          </Link>

          <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider pt-4">Configuration</div>
          <Link to="/connection" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/connection' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
            LinkedIn Connection
          </Link>
          <Link to="/settings" className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-colors", location.pathname === '/settings' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Sliders className="w-4 h-4" />
            Settings
          </Link>
        </nav>
        
        {/* User Account Bar */}
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3.5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate">{user?.displayName}</p>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={logOut}
              className="w-full flex items-center gap-2 justify-center px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out Session
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main Container Wrapper */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-base font-bold text-slate-800 tracking-tight">{getPageHeader()}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full font-bold uppercase tracking-wider">
              <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
              Secure Workspace
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout><Dashboard /></Layout></PrivateRoute>} />
          <Route path="/find-jobs" element={<PrivateRoute><Layout><FindJobs /></Layout></PrivateRoute>} />
          <Route path="/analyze-job" element={<PrivateRoute><Layout><AnalyzeJob /></Layout></PrivateRoute>} />
          <Route path="/tracker" element={<PrivateRoute><Layout><JobTracker /></Layout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Layout><MyProfile /></Layout></PrivateRoute>} />
          <Route path="/resume" element={<PrivateRoute><Layout><MyResume /></Layout></PrivateRoute>} />
          <Route path="/connection" element={<PrivateRoute><Layout><LinkedInConnection /></Layout></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Layout><Settings /></Layout></PrivateRoute>} />
          <Route path="/workspace/:id" element={<PrivateRoute><ApplicationWorkspace /></PrivateRoute>} />
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
