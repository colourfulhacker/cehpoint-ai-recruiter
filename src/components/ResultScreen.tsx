import React, { useEffect, useState } from 'react';
import { InterviewConfig, InterviewResult } from '../types';
import { CheckCircle, XCircle, Phone, RefreshCcw, Mail, AlertCircle, Calendar, User, Briefcase, Upload, Loader2, Info, ChevronDown, ChevronUp, Activity, Cloud } from 'lucide-react';
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
          <div className="grid grid-cols-1 gap-3">
            <button onClick={onRestart} className="flex flex-col items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 p-4 rounded-xl border border-slate-700 transition-all group">
              <RefreshCcw className="w-5 h-5 text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
              <span className="text-xs font-medium text-slate-300">New Interview</span>
            </button>
          </div>
        </div>

        {/* --- Right Column: Transcript & Feedback (8 cols) --- */}
        <div className="lg:col-span-8 flex flex-col gap-6 h-[800px] lg:h-auto">

          {/* Feedback / Contact Section */}
          {result.passed ? (
            <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-emerald-500/20 rounded-2xl p-6 flex flex-col items-start gap-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>

              <div>
                <h3 className="text-emerald-400 font-bold text-xl flex items-center gap-2 mb-2">
                  <CheckCircle className="w-6 h-6" /> 🎉 Congratulations! You're Shortlisted
                </h3>
                <p className="text-white text-base font-medium mb-2">
                  Final Round: Complete Onboarding Process
                </p>
                <p className="text-slate-300 text-sm max-w-xl">
                  You have successfully cleared the AI screening round! To proceed with your application, please complete the final onboarding process where you'll submit your expected stipend/salary and answer a few important questions.
                </p>
              </div>

              <div className="flex items-center gap-4 z-10 w-full md:w-auto">
                <a
                  href="https://internlink.cehpoint.co.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg shadow-emerald-900/30 text-center text-base"
                >
                  Complete Onboarding Process →
                </a>

                <div className="group relative">
                  <Info className="w-5 h-5 text-slate-500 hover:text-slate-300 cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-4 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-sm text-slate-300 z-50">
                    <strong className="text-emerald-400">Final Step:</strong> This is the last stage before joining our team. Complete the onboarding form to provide your salary expectations and finalize your application.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-red-900/20 border border-red-500/20 rounded-2xl p-6">
              <h3 className="text-red-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Assessment Feedback
              </h3>
              <p className="text-slate-300 italic">"{result.notes || "Based on this assessment, we need someone with more hands-on depth in the required areas. We encourage you to strengthen your skills and apply again in the future."}"</p>
            </div>
          )}

          {/* Submission Status Card (Replaces Transcript) */}
          <div className="glass-panel rounded-2xl border border-white/5 p-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-400" />
              Submission Status
            </h3>
            <div className="space-y-4">
              {/* Video Upload Step */}
              <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${videoUploadStatus === 'uploading' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-800/50 border-white/5'}`}>
                <div className="shrink-0">
                  {videoUploadStatus === 'uploading' && <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />}
                  {videoUploadStatus === 'success' && <CheckCircle className="w-6 h-6 text-emerald-400" />}
                  {videoUploadStatus === 'error' && <AlertCircle className="w-6 h-6 text-red-400" />}
                  {videoUploadStatus === 'idle' && <div className="w-6 h-6 rounded-full border-2 border-slate-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-slate-400" /> Interview Video Upload
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {videoUploadStatus === 'uploading' && "Uploading your interview recording to secure cloud storage..."}
                    {videoUploadStatus === 'success' && "Video uploaded successfully."}
                    {videoUploadStatus === 'error' && "Upload failed. Please download the log manually."}
                    {videoUploadStatus === 'idle' && "Waiting to start upload..."}
                  </p>
                </div>
              </div>

              {/* Email Step */}
              <div className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${saveStatus === 'saving' ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-slate-800/50 border-white/5'}`}>
                <div className="shrink-0">
                  {saveStatus === 'saving' && <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />}
                  {saveStatus === 'success' && <CheckCircle className="w-6 h-6 text-emerald-400" />}
                  {saveStatus === 'error' && <AlertCircle className="w-6 h-6 text-red-400" />}
                  {saveStatus === 'idle' && <div className="w-6 h-6 rounded-full border-2 border-slate-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-400" /> HR Notification
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {saveStatus === 'saving' && "Sending interview results and video link to HR..."}
                    {saveStatus === 'success' && "Results sent successfully to HR team."}
                    {saveStatus === 'error' && "Email failed. Please download log and email to hr@cehpoint.co.in"}
                    {saveStatus === 'idle' && "Waiting for video upload to complete..."}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
