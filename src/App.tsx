/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Briefcase, LayoutDashboard, UserCircle, LogOut, Search } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
import { isFirebaseConfigured } from './firebase';
import { cn } from './lib/utils';
import Dashboard from './components/Dashboard';
import JobTracker from './components/JobTracker';
import ProfileSettings from './components/ProfileSettings';
import FindJobs from './components/FindJobs';
import ApplicationWorkspace from './components/ApplicationWorkspace';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen w-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function Login() {
  const { user, signIn, signInDemo } = useAuth();
  if (user) return <Navigate to="/" />;
  const hasFirebase = isFirebaseConfigured();

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F8FAFC] text-slate-900 font-sans">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center">
        <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-2xl mb-4">
          N
        </div>
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Naukri AI Assistant</h1>
        <p className="text-slate-500 text-center mb-8">Sign in to track, analyze, and tailor your job applications.</p>
        
        {hasFirebase && (
          <button
            onClick={signIn}
            className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors mb-4"
          >
            Sign in with Google
          </button>
        )}

        {!hasFirebase && (
          <button
            onClick={signInDemo}
            className="w-full bg-slate-800 text-white py-3 px-4 rounded-lg font-medium hover:bg-slate-900 transition-colors"
          >
            Continue in Demo Mode
          </button>
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
    fetch('/api/provider/status')
    .then(res => res.json())
    .then(data => {
       if (data && data.status) setProviderStatus(data.status);
    })
    .catch(console.error);
  }, []);
  
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex fixed h-full z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-xl">N</div>
          <span className="font-bold tracking-tight text-slate-800">Naukri AI Assistant</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <div className="px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Menu</div>
          <Link to="/" className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors", location.pathname === '/' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link to="/find-jobs" className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors", location.pathname === '/find-jobs' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Search className="w-5 h-5" />
            Find Jobs
          </Link>
          <Link to="/tracker" className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors", location.pathname === '/tracker' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <Briefcase className="w-5 h-5" />
            Job Tracker
          </Link>
          <Link to="/profile" className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg font-medium transition-colors", location.pathname === '/profile' ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50")}>
            <UserCircle className="w-5 h-5" />
            My Profile & CV
          </Link>
        </nav>
        <div className="p-4 border-t border-slate-100">
          <div className="bg-slate-50 rounded-lg p-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                {user?.displayName?.charAt(0) || 'U'}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold truncate">{user?.displayName}</p>
                <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={logOut}
              className="w-full flex items-center gap-2 justify-center px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors text-xs font-medium"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col h-screen overflow-hidden">
        <header className="h-16 shrink-0 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-lg font-semibold text-slate-800">
            {location.pathname === '/' ? 'Dashboard' : location.pathname === '/find-jobs' ? 'Find Jobs' : location.pathname === '/tracker' ? 'Job Tracker' : 'My Profile & CV'}
          </h1>
          <div className="flex items-center gap-4">
            {providerStatus?.status === 'DEMO' && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full font-medium">
                Demo Mode &middot; Mock Jobs
              </div>
            )}
            {providerStatus?.status === 'CONNECTED' && (
              <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Live Provider &middot; Connected
              </div>
            )}
            {providerStatus?.status === 'NOT_CONFIGURED' && (
              <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-1 rounded-full font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Provider Not Configured
              </div>
            )}
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
          <Route path="/tracker" element={<PrivateRoute><Layout><JobTracker /></Layout></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Layout><ProfileSettings /></Layout></PrivateRoute>} />
          <Route path="/workspace/:id" element={<PrivateRoute><ApplicationWorkspace /></PrivateRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
