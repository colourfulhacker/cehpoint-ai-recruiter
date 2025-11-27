import { supabase } from './lib/supabase';

/**
 * API endpoint to fetch all interview videos from Supabase
 * Returns candidate names, emails, and video URLs for HR dashboard
 */

export default async function handler(req, res) {
    // CORS handling - allow public access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📊 [GET-INTERVIEWS] Fetching interviews from Supabase...');

        if (!supabase) {
            console.error('❌ [GET-INTERVIEWS] Supabase client not initialized (missing env vars)');
            return res.status(503).json({
                error: 'Database configuration missing',
                details: 'SUPABASE_URL or SUPABASE_ANON_KEY not set'
            });
        }

        const { data: interviews, error } = await supabase
            .from('interviews')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ [GET-INTERVIEWS] Supabase query error:', error);
            throw error;
        }

        if (!interviews || interviews.length === 0) {
            console.log('⚠️ [GET-INTERVIEWS] No interviews found in Supabase');
            return res.status(200).json({
                success: true,
                interviews: [],
                message: 'No interviews found'
            });
        }

        // Map Supabase data to the format expected by HRDashboard
        const formattedInterviews = interviews.map((interview) => ({
            id: interview.id,
            name: interview.name,
            email: interview.email, // Include email
            videoUrl: interview.video_url,
            publicId: interview.video_url ? interview.video_url.split('/').pop() : 'no-video', // Fallback
            duration: 0, // Duration might not be stored, can be added if needed
            format: 'webm', // Default
            createdAt: interview.created_at,
            bytes: 0, // Size might not be stored
            role: interview.role,
            status: interview.status,
            result: interview.result
        }));

        console.log(`✅ [GET-INTERVIEWS] Found ${formattedInterviews.length} interviews`);

        return res.status(200).json({
            success: true,
            interviews: formattedInterviews,
            count: formattedInterviews.length
        });

    } catch (error) {
        console.error('❌ [GET-INTERVIEWS] Error:', error.message);

        return res.status(500).json({
            error: 'Failed to fetch interviews',
            details: error.message || 'Unknown server error',
            hint: 'Check server logs for more details'
        });
    }
}
