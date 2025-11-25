import React, { useEffect, useState } from 'react';
import { InterviewConfig, InterviewResult } from '../types';
import { CheckCircle, XCircle, Download, Phone, RefreshCcw, Mail, AlertCircle, Calendar, User, Briefcase, MessageSquare, Upload, Loader2 } from 'lucide-react';
import { uploadVideoToCloudinary, validateVideoBlob } from '../utils/video-upload';
import { sendInterviewEmail } from '../utils/email-service';

interface ResultScreenProps {
  config: InterviewConfig;
  result: InterviewResult;
  onRestart: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({ config, result, onRestart }) => {
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [videoUploadStatus, setVideoUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Auto-upload video and save to Google Sheets on mount
  useEffect(() => {
    if (saveStatus === 'idle') {
      handleVideoUploadAndSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVideoUploadAndSave = async () => {
    let uploadedVideoUrl: string | null = null;

    console.log('🎬 [VIDEO DEBUG] Starting video upload process...');
    console.log('🎬 [VIDEO DEBUG] Video blob exists:', !!result.videoBlob);
    if (result.videoBlob) {
      console.log('🎬 [VIDEO DEBUG] Video blob size:', result.videoBlob.size, 'bytes');
      console.log('🎬 [VIDEO DEBUG] Video blob type:', result.videoBlob.type);
    }

    // Step 1: Upload video to Cloudinary if available
    if (result.videoBlob) {
      setVideoUploadStatus('uploading');
      console.log('🎬 [VIDEO DEBUG] Upload status set to: uploading');

      // Validate video blob
      console.log('🎬 [VIDEO DEBUG] Validating video blob...');
      const validation = validateVideoBlob(result.videoBlob);
      console.log('🎬 [VIDEO DEBUG] Validation result:', validation);
      if (!validation.valid) {
        console.error('❌ [VIDEO DEBUG] Video validation failed:', validation.error);
        setVideoUploadStatus('error');
        // Continue to save interview data without video
      } else {
        console.log('✅ [VIDEO DEBUG] Video validation passed!');
        try {
          console.log('🎬 [VIDEO DEBUG] Calling uploadVideoToCloudinary...');
          console.log('🎬 [VIDEO DEBUG] Upload metadata:', {
            name: config.name,
            role: config.role,
            timestamp: Date.now(),
          });
          const uploadResult = await uploadVideoToCloudinary(
            result.videoBlob,
            {
              name: config.name,
              role: config.role,
              timestamp: Date.now(),
            }
          );
          console.log('🎬 [VIDEO DEBUG] Upload result received:', uploadResult);

          if (uploadResult.success && uploadResult.videoUrl) {
            uploadedVideoUrl = uploadResult.videoUrl;
            setVideoUrl(uploadResult.videoUrl);
            setVideoUploadStatus('success');
            console.log('✅ [VIDEO DEBUG] Video uploaded successfully!');
            console.log('🎬 [VIDEO DEBUG] Cloudinary URL:', uploadResult.videoUrl);
            console.log('🎬 [VIDEO DEBUG] Public ID:', uploadResult.publicId);
          } else {
            console.error('❌ [VIDEO DEBUG] Video upload failed:', uploadResult.error);
            setVideoUploadStatus('error');
            // Continue to save interview data without video
          }
        } catch (err) {
          console.error('❌ [VIDEO DEBUG] Video upload exception:', err);
          setVideoUploadStatus('error');
          // Continue to save interview data without video
        }
      }
    } else {
      console.warn('⚠️ [VIDEO DEBUG] No video blob available - skipping upload');
    }

    // Step 2: Send interview results via Email
    await sendInterviewViaEmail(uploadedVideoUrl);
  };

  const sendInterviewViaEmail = async (videoUrl: string | null) => {
    setSaveStatus('saving');

    // Format transcript into a readable string block
    const transcriptText = result.transcript.map(t =>
      `[${t.timestamp}] ${t.speaker === 'ai' ? 'HR' : 'CANDIDATE'}: ${t.text}`
    ).join('\n');

    const emailData = {
      candidateName: config.name,
      role: config.role,
      language: config.language,
      status: result.passed ? "SELECTED" : "REJECTED",
      notes: result.notes || "N/A",
      transcript: transcriptText,
      videoUrl: videoUrl || 'No video recorded',
      date: new Date().toLocaleString()
    };

    try {
      console.log('📧 Sending interview results via email...');
      const emailResult = await sendInterviewEmail(emailData);

      if (emailResult.success) {
        setSaveStatus('success');
        console.log('✅ Interview results sent successfully via email!');
      } else {
        throw new Error(emailResult.error || 'Email sending failed');
      }
    } catch (err: any) {
      console.error('❌ Email sending error:', err);
      setSaveStatus('error');
    }
  };

  const downloadLog = () => {
    if (result.transcript && result.transcript.length > 0) {
      const header = `CEHPOINT AI RECRUITER - INTERVIEW LOG\nCandidate: ${config.name}\nRole: ${config.role}\nDate: ${new Date().toLocaleString()}\nResult: ${result.passed ? "SELECTED" : "REJECTED"}\nNotes: ${result.notes || "N/A"}\n------------------------------------------\n\n`;

      const content = result.transcript.map(t =>
        `[${t.timestamp}] ${t.speaker === 'ai' ? 'HR (Sarah)' : 'CANDIDATE'}: ${t.text}`
      ).join('\n\n');

      const blob = new Blob([header + content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${config.name.replace(/\s+/g, '_')}_Interview_Log.txt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 md:p-8 font-sans text-slate-200">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* --- Left Column: Status & Actions (4 cols) --- */}
        <div className="lg:col-span-4 space-y-6">

          {/* Status Card */}
          <div className={`glass-panel rounded-3xl p-8 text-center relative overflow-hidden shadow-2xl ${result.passed ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
            {/* Background Glow */}
            <div className={`absolute inset-0 opacity-20 blur-3xl ${result.passed ? 'bg-emerald-600' : 'bg-red-600'}`}></div>

            <div className="relative z-10">
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 shadow-xl border-4 ${result.passed ? 'bg-emerald-500 border-emerald-400/30 text-white' : 'bg-red-500 border-red-400/30 text-white'}`}>
                {result.passed ? <CheckCircle className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
              </div>

              <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
                {result.passed ? 'Selected' : 'Not Selected'}
              </h2>

              <p className="text-sm text-slate-300 mb-6 leading-relaxed opacity-80">
                {result.passed
                  ? "Excellent performance. Your profile has been shortlisted for the next round."
                  : "Thank you for applying. We encourage you to improve your technical depth and try again."}
              </p>

              {/* Email Status Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-900/40 border border-indigo-500/30 backdrop-blur-sm text-xs font-medium">
                {saveStatus === 'saving' && (
                  <><Loader2 className="w-3 h-3 text-indigo-400 animate-spin" /> Sending email...</>
                )}
                {saveStatus === 'success' && (
                  <><Mail className="w-3 h-3 text-green-400" /> Email sent to HR</>
                )}
                {saveStatus === 'error' && (
                  <><AlertCircle className="w-3 h-3 text-red-400" /> Email failed</>
                )}
                {!result.videoBlob && (
                  <><AlertCircle className="w-3 h-3 text-indigo-400" /> Please email your interview log to hr@cehpoint.co.in</>
                )}
              </div>
            </div>
          </div>

          {/* Candidate Details Card */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Candidate Profile</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-lg"><User className="w-4 h-4 text-indigo-400" /></div>
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="text-sm font-medium text-white">{config.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-lg"><Briefcase className="w-4 h-4 text-indigo-400" /></div>
                <div>
                  <p className="text-xs text-slate-500">Role</p>
                  <p className="text-sm font-medium text-white">{config.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-lg"><Calendar className="w-4 h-4 text-indigo-400" /></div>
                <div>
                  <p className="text-xs text-slate-500">Date</p>
                  <p className="text-sm font-medium text-white">{new Date().toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={onRestart} className="flex flex-col items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 p-4 rounded-xl border border-slate-700 transition-all group">
              <RefreshCcw className="w-5 h-5 text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-medium text-slate-300">New Interview</span>
            </button>
            <button onClick={downloadLog} className="flex flex-col items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 p-4 rounded-xl shadow-lg shadow-indigo-900/20 transition-all">
              <Download className="w-5 h-5 text-white" />
              <span className="text-xs font-medium text-white">Download Log</span>
            </button>
          </div>
        </div>

        {/* --- Right Column: Transcript & Feedback (8 cols) --- */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-[800px] lg:h-auto">

          {/* Feedback / Contact Section */}
          {result.passed ? (
            <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
              <div>
                <h3 className="text-emerald-400 font-bold text-lg flex items-center gap-2">
                  <Phone className="w-5 h-5" /> Next Steps
                </h3>
                <p className="text-slate-400 text-sm mt-1 max-w-md">
                  Please contact the CEO directly to finalize your offer letter. Mention your reference ID: <span className="text-white font-mono">CP-{Math.floor(Math.random() * 1000)}</span>
                </p>
              </div>
              <div className="flex gap-4 relative z-10">
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase font-bold">Direct Line</p>
                  <p className="text-xl font-mono text-white font-bold tracking-wider">9091156095</p>
                </div>
                <div className="w-px bg-slate-700 mx-2"></div>
                <div className="text-left">
                  <p className="text-xs text-slate-500 uppercase font-bold">HR Email</p>
                  <p className="text-sm font-mono text-white">hr@cehpoint.co.in</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Assessment Feedback
              </h3>
              <p className="text-slate-300 italic">"{result.notes || "Candidate struggled with core technical concepts and lacked depth in scenario-based answers."}"</p>
            </div>
          )}

          {/* Chat Log */}
          <div className="flex-1 glass-panel rounded-2xl border border-white/5 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-white/5 bg-slate-900/50 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-semibold text-slate-300">Interview Transcript</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
              {result.transcript.map((entry, idx) => (
                <div key={idx} className={`flex gap-4 ${entry.speaker === 'ai' ? 'flex-row' : 'flex-row-reverse'}`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${entry.speaker === 'ai' ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                    <span className="text-xs font-bold text-white">{entry.speaker === 'ai' ? 'AI' : 'ME'}</span>
                  </div>

                  {/* Bubble */}
                  <div className={`flex flex-col max-w-[80%] ${entry.speaker === 'ai' ? 'items-start' : 'items-end'}`}>
                    <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${entry.speaker === 'ai'
                      ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                      : 'bg-indigo-600 text-white rounded-tr-none shadow-lg'
                      }`}>
                      {entry.text}
                    </div>
                    <span className="text-[10px] text-slate-600 mt-1 px-1">{entry.timestamp}</span>
                  </div>
                </div>
              ))}

              {result.transcript.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
                  <MessageSquare className="w-12 h-12 mb-2" />
                  <p className="text-sm">No conversation recorded</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
