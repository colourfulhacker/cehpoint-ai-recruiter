import { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { InterviewScreen } from './components/InterviewScreen';
import { ResultScreen } from './components/ResultScreen';
import { HRDashboard } from './components/HRDashboard';
import { InterviewConfig, InterviewResult } from './types';

enum AppState {
  WELCOME,
  INTERVIEW,
  RESULT,
  HR_DASHBOARD
}

export default function App() {
  const [state, setState] = useState<AppState>(AppState.WELCOME);
  const [config, setConfig] = useState<InterviewConfig | null>(null);
  const [result, setResult] = useState<InterviewResult | null>(null);

  // Check URL path on mount and when URL changes
  useEffect(() => {
    const checkPath = () => {
      const path = window.location.pathname;
      if (path === '/cehpoint-hr-dashboard') {
        setState(AppState.HR_DASHBOARD);
      }
    };

    checkPath();

    // Listen for URL changes (for SPA navigation)
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  const handleStart = (cfg: InterviewConfig) => {
    setConfig(cfg);
    setState(AppState.INTERVIEW);
  };

  const handleComplete = (res: InterviewResult) => {
    setResult(res);
    setState(AppState.RESULT);
  };

  const handleRestart = () => {
    setConfig(null);
    setResult(null);
    setState(AppState.WELCOME);
  };

  return (
    <div className="bg-slate-900 min-h-screen">
      {state === AppState.HR_DASHBOARD && (
        <HRDashboard />
      )}

      {state === AppState.WELCOME && (
        <WelcomeScreen onStart={handleStart} />
      )}

      {state === AppState.INTERVIEW && config && (
        <InterviewScreen config={config} onComplete={handleComplete} />
      )}

      {state === AppState.RESULT && result && config && (
        <ResultScreen config={config} result={result} onRestart={handleRestart} />
      )}
    </div>
  );
}