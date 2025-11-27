import { createClient } from '@supabase/supabase-js';

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
        console.log('📊 [GET-INTERVIEWS] Environment check:', {
            hasUrl: !!process.env.SUPABASE_URL,
            hasKey: !!process.env.SUPABASE_ANON_KEY,
            urlPrefix: process.env.SUPABASE_URL?.substring(0, 20)
        });

        // Create Supabase client inline
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('❌ [GET-INTERVIEWS] Supabase credentials missing');
            return res.status(503).json({
                error: 'Database configuration missing',
                details: 'SUPABASE_URL or SUPABASE_ANON_KEY not set',
                env: {
                    hasUrl: !!supabaseUrl,
                    hasKey: !!supabaseAnonKey
                }
            });
        }

        console.log('📊 [GET-INTERVIEWS] Creating Supabase client...');
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        console.log('📊 [GET-INTERVIEWS] Querying interviews table...');
        const { data: interviews, error } = await supabase
            .from('interviews')
            .select('*')
            .order('created_at', { ascending: false });

        console.log('📊 [GET-INTERVIEWS] Query result:', {
            hasData: !!interviews,
            dataLength: interviews?.length,
            hasError: !!error,
            errorMessage: error?.message,
            errorDetails: error?.details,
            errorHint: error?.hint,
            errorCode: error?.code
        });

        if (error) {
            console.error('❌ [GET-INTERVIEWS] Supabase query error:', error);
            return res.status(500).json({
                error: 'Database query failed',
                details: error.message,
                code: error.code,
                hint: error.hint,
                supabaseError: error
            });
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
            email: interview.email,
            videoUrl: interview.video_url,
            publicId: interview.video_url ? interview.video_url.split('/').pop() : 'no-video',
            duration: 0,
            format: 'webm',
            createdAt: interview.created_at,
            bytes: 0,
            role: interview.role,
            status: interview.status
        }));

        console.log(`✅ [GET-INTERVIEWS] Found ${formattedInterviews.length} interviews`);

        return res.status(200).json({
            success: true,
            interviews: formattedInterviews,
            count: formattedInterviews.length
        });

    } catch (error) {
        console.error('❌ [GET-INTERVIEWS] Unexpected error:', error);
        console.error('❌ [GET-INTERVIEWS] Error stack:', error.stack);

        return res.status(500).json({
            error: 'Failed to fetch interviews',
            details: error.message || 'Unknown server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            hint: 'Check server logs for more details'
        });
    }
}
