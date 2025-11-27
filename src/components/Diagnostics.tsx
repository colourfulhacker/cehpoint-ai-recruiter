import React, { useState } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, Database, Cloud } from 'lucide-react';
import { uploadVideoToCloudinary } from '../utils/video-upload';

export const Diagnostics: React.FC = () => {
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [dbStatus, setDbStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
    const [dbResult, setDbResult] = useState<any>(null);

    const runCloudinaryTest = async () => {
        setUploadStatus('uploading');
        setUploadResult(null);

        try {
            // Create a dummy video blob (1 second black screen)
            // Since we can't easily create a real video blob without recording, we'll try to upload a text file disguised as a test
            // Or better, just a small blob with text content, Cloudinary might reject it if it validates strictly, 
            // but the error message will tell us if authentication worked.

            // Actually, let's try to upload a tiny valid webm blob if possible, or just a text file to check auth.
            // Cloudinary unsigned upload usually accepts any file type if not restricted.
            const blob = new Blob(['test data'], { type: 'text/plain' });

            // We'll use the existing utility but we need to mock the blob to be a "video" for the utility's validation
            // The utility checks for video/webm or video/mp4.
            const mockVideoBlob = new Blob(['fake video data'], { type: 'video/webm' });

            const result = await uploadVideoToCloudinary(mockVideoBlob, {
                name: 'Test User',
                role: 'Tester',
                timestamp: Date.now()
            });

            setUploadResult(result);
            setUploadStatus(result.success ? 'success' : 'error');
        } catch (err: any) {
            setUploadResult({ error: err.message });
            setUploadStatus('error');
        }
    };

    const runDbTest = async () => {
        setDbStatus('checking');
        setDbResult(null);
        try {
            const response = await fetch('/api/get-interviews');
            const data = await response.json();
            setDbResult(data);
            setDbStatus(response.ok ? 'success' : 'error');
        } catch (err: any) {
            setDbResult({ error: err.message });
            setDbStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <h1 className="text-3xl font-bold text-white mb-8">System Diagnostics</h1>

                {/* Cloudinary Test */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Cloud className="w-6 h-6 text-indigo-400" /> Cloudinary Upload Test
                    </h2>
                    <p className="text-slate-400 mb-6">
                        Tests if the Cloudinary configuration (Cloud Name: <code>dvparynza</code>, Preset: <code>interview_recordings</code>) is correct and accepting uploads.
                    </p>

                    <button
                        onClick={runCloudinaryTest}
                        disabled={uploadStatus === 'uploading'}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 mb-4"
                    >
                        {uploadStatus === 'uploading' ? <Loader2 className="animate-spin" /> : <Upload className="w-4 h-4" />}
                        Test Upload
                    </button>

                    {uploadResult && (
                        <div className={`p-4 rounded-lg font-mono text-sm overflow-auto max-h-60 ${uploadStatus === 'success' ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                            <pre>{JSON.stringify(uploadResult, null, 2)}</pre>
                        </div>
                    )}
                </div>

                {/* Database Test */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Database className="w-6 h-6 text-emerald-400" /> Database Connection Test
                    </h2>
                    <p className="text-slate-400 mb-6">
                        Tests if the Supabase database is reachable via the API.
                    </p>

                    <button
                        onClick={runDbTest}
                        disabled={dbStatus === 'checking'}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 mb-4"
                    >
                        {dbStatus === 'checking' ? <Loader2 className="animate-spin" /> : <Database className="w-4 h-4" />}
                        Test Database
                    </button>

                    {dbResult && (
                        <div className={`p-4 rounded-lg font-mono text-sm overflow-auto max-h-60 ${dbStatus === 'success' ? 'bg-emerald-900/30 border border-emerald-500/30' : 'bg-red-900/30 border border-red-500/30'}`}>
                            <pre>{JSON.stringify(dbResult, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
