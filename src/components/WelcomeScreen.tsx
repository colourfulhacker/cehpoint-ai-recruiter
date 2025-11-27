import React, { useState } from 'react';
import { JobRole, Language, InterviewConfig } from '../types';
import { ArrowRight, Mic, Briefcase, User, Megaphone, Terminal, Cpu, CheckCircle2, Globe, Palette, TrendingUp, Shield, Bug, Phone, Presentation } from 'lucide-react';

interface WelcomeScreenProps {
  onStart: (config: InterviewConfig) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<JobRole>(JobRole.SDE_INTERN);
  const [language, setLanguage] = useState<Language>(Language.ENGLISH);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && email.trim()) {
      onStart({ name, email, role, language });
    }
  };

  const getRoleIcon = (r: JobRole) => {
    switch (r) {
      case JobRole.MARKETING: return <Megaphone className="w-5 h-5" />;
      case JobRole.SDE_INTERN: return <Terminal className="w-5 h-5" />;
      case JobRole.SDE_JOB: return <Cpu className="w-5 h-5" />;
      case JobRole.UI_UX_INTERN: return <Palette className="w-5 h-5" />;
      case JobRole.IT_SALES_INTERN: return <TrendingUp className="w-5 h-5" />;
      case JobRole.CYBER_SECURITY_INTERN: return <Shield className="w-5 h-5" />;
      case JobRole.JUNIOR_PENTEST: return <Bug className="w-5 h-5" />;
      case JobRole.TELECALLING: return <Phone className="w-5 h-5" />;
      case JobRole.PRESENTATION_SPECIALIST: return <Presentation className="w-5 h-5" />;
      default: return <Briefcase className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[100px] animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px] animate-pulse-slow-delayed"></div>
      </div>

      <div className="max-w-2xl w-full glass-panel rounded-3xl shadow-2xl p-8 md:p-12 relative z-10 animate-fade-in-up border-t border-white/10">

        <div className="text-center mb-10">
          <div className="relative inline-block">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full"></div>
            <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/10 relative z-10 mb-4 inline-flex shadow-lg">
              <Mic className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">AI Recruiter</h1>
          <p className="text-slate-400 text-lg mb-3">Automated Screening & Technical Assessment</p>
          <div className="flex items-center justify-center gap-2 text-indigo-300 hover:text-indigo-200 transition-colors">
            <Phone className="w-4 h-4" />
            <a href="tel:+913369029331" className="text-sm font-medium tracking-wide">
              Helpline: +91 33690 29331
            </a>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Name Input */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-semibold text-slate-300 gap-2 uppercase tracking-wider">
              <User size={14} className="text-indigo-400" />
              Candidate Name
            </label>
            <div className="relative group">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600 text-lg group-hover:bg-slate-900/80"
                placeholder="Enter your full name..."
              />
            </div>
          </div>

          {/* Email Input */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-semibold text-slate-300 gap-2 uppercase tracking-wider">
              <User size={14} className="text-indigo-400" />
              Email Address
            </label>
            <div className="relative group">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-5 py-4 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder-slate-600 text-lg group-hover:bg-slate-900/80"
                placeholder="Enter your email address..."
              />
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-semibold text-slate-300 gap-2 uppercase tracking-wider">
              <Briefcase size={14} className="text-indigo-400" />
              Target Position
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(JobRole).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 group h-32 text-center gap-3 ${role === r
                    ? 'bg-indigo-600/20 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)]'
                    : 'bg-slate-900/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60'
                    }`}
                >
                  <div className={`p-2 rounded-lg transition-colors ${role === r ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-slate-200'}`}>
                    {getRoleIcon(r)}
                  </div>
                  <span className={`text-sm font-medium ${role === r ? 'text-indigo-100' : 'text-slate-400 group-hover:text-slate-200'}`}>
                    {r}
                  </span>
                  {role === r && <div className="absolute top-3 right-3 text-indigo-400"><CheckCircle2 size={16} /></div>}
                </button>
              ))}
            </div>
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <label className="flex items-center text-sm font-semibold text-slate-300 gap-2 uppercase tracking-wider">
              <Globe size={14} className="text-indigo-400" />
              Interview Language
            </label>
            <div className="flex gap-3">
              {Object.values(Language).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={`flex-1 py-3 px-4 rounded-xl border text-sm font-medium transition-all ${language === l
                    ? 'bg-indigo-600/20 border-indigo-500 text-indigo-100 shadow-lg'
                    : 'bg-slate-900/40 border-slate-700 text-slate-400 hover:border-slate-500 hover:bg-slate-800/60'
                    }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 group mt-4"
          >
            Start Assessment
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <p className="text-xs text-center text-slate-500">
            By continuing, you consent to audio/video recording for evaluation purposes.
          </p>
        </form>
      </div>
    </div>
  );
};
