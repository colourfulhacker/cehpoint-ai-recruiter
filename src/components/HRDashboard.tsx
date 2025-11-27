import React, { useEffect, useState } from 'react';
import { Users, Video, Calendar, Loader2, AlertCircle, RefreshCcw, Play } from 'lucide-react';

interface Interview {
    id: number;
    name: string;
    email?: string;
    videoUrl: string;
    publicId: string;
    duration: number;
    format: string;
    createdAt: string;
    bytes: number;
}

export const HRDashboard: React.FC = () => {
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchInterviews = async () => {
        setLoading(true);
        setError(null);

        try {
            console.log('📊 Fetching interviews from API...');
            const response = await fetch('/api/get-interviews');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                setInterviews(data.interviews || []);
                console.log(`✅ Loaded ${data.count} interviews`);
            } else {
                throw new Error(data.message || 'Failed to fetch interviews');
            }
        } catch (err: any) {
            console.error('❌ Error fetching interviews:', err);
            setError(err.message || 'Failed to load interviews');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, []);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFileSize = (bytes: number) => {
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="glass-panel rounded-3xl p-8 border border-white/10 relative overflow-hidden">
                    {/* Background gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 via-purple-600/20 to-pink-600/20 opacity-50 blur-3xl"></div>

                    <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                                <Users className="w-10 h-10 text-indigo-400" />
                                HR Dashboard
                            </h1>
                            <p className="text-slate-400 text-lg">
                                Interview recordings and candidate submissions
                            </p>
                        </div>

                        <button
                            onClick={fetchInterviews}
                            disabled={loading}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg"
                        >
                            <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto">
                {loading && (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="w-12 h-12 text-indigo-400 animate-spin mb-4" />
                        <p className="text-slate-400 text-lg">Loading interviews...</p>
                    </div>
                )}

                {error && (
                    <div className="glass-card rounded-2xl p-8 border border-red-500/30 bg-red-900/20">
                        <div className="flex items-start gap-4">
                            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                            <div>
                                <h3 className="text-red-400 font-bold text-lg mb-2">Error Loading Interviews</h3>
                                <p className="text-slate-300 mb-4">{error}</p>
                                <button
                                    onClick={fetchInterviews}
                                    className="bg-red-600 hover:bg-red-500 text-white font-semibold py-2 px-4 rounded-lg transition-all"
                                >
                                    Try Again
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!loading && !error && interviews.length === 0 && (
                    <div className="glass-card rounded-2xl p-12 text-center">
                        <Video className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-slate-400 mb-2">No Interviews Found</h3>
                        <p className="text-slate-500">No interview recordings are available yet.</p>
                    </div>
                )}

                {!loading && !error && interviews.length > 0 && (
                    <>
                        {/* Stats */}
                        <div className="mb-6 flex items-center gap-3 text-slate-400">
                            <Video className="w-5 h-5" />
                            <span className="font-medium">
                                {interviews.length} {interviews.length === 1 ? 'Interview' : 'Interviews'}
                            </span>
                        </div>

                        {/* Interview Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {interviews.map((interview) => (
                                <div
                                    key={interview.id}
                                    className="glass-card rounded-2xl p-6 border border-white/10 hover:border-indigo-500/30 transition-all group"
                                >
                                    {/* Candidate Info */}
                                    <div className="mb-4">
                                        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">
                                                {interview.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div>{interview.name}</div>
                                                {interview.email && (
                                                    <div className="text-sm text-slate-400 font-normal">{interview.email}</div>
                                                )}
                                            </div>
                                        </h3>

                                        <div className="flex flex-wrap gap-3 text-sm text-slate-400">
                                            <div className="flex items-center gap-1">
                                                <Calendar className="w-4 h-4" />
                                                {formatDate(interview.createdAt)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Video className="w-4 h-4" />
                                                {formatDuration(interview.duration)}
                                            </div>
                                            <div className="text-slate-500">
                                                {formatFileSize(interview.bytes)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Video Player */}
                                    <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 group-hover:border-indigo-500/50 transition-all">
                                        <video
                                            controls
                                            className="w-full aspect-video"
                                            preload="metadata"
                                            controlsList="nodownload"
                                        >
                                            <source src={interview.videoUrl} type={`video/${interview.format}`} />
                                            Your browser does not support the video tag.
                                        </video>

                                        {/* Play overlay (optional) */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-indigo-600/80 flex items-center justify-center">
                                                <Play className="w-8 h-8 text-white ml-1" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Video URL (for reference) */}
                                    <div className="mt-3 text-xs text-slate-600 truncate">
                                        ID: {interview.publicId}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
