import { createClient } from '@supabase/supabase-js';

/**
 * Diagnostic endpoint to test Supabase connection and environment variables
 * This helps identify why interview data isn't appearing in the HR dashboard
 */

export default async function handler(req, res) {
    // CORS handling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {},
        supabase: {},
        testWrite: {},
        testRead: {}
    };

    try {
        // 1. Check Environment Variables
        diagnostics.environment = {
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
            hasCloudinaryUrl: !!process.env.CLOUDINARY_URL,
            hasCloudinaryCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
            hasCloudinaryApiKey: !!process.env.CLOUDINARY_API_KEY,
            hasCloudinaryApiSecret: !!process.env.CLOUDINARY_API_SECRET,
            supabaseUrlPrefix: process.env.SUPABASE_URL?.substring(0, 30) || 'NOT SET',
            nodeEnv: process.env.NODE_ENV || 'NOT SET'
        };

        // 2. Test Supabase Connection
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            diagnostics.supabase.error = 'Missing credentials';
            diagnostics.supabase.canConnect = false;
        } else {
            try {
                const supabase = createClient(supabaseUrl, supabaseAnonKey);

                // 3. Test Write Operation
                const testRecord = {
                    name: `TEST_DIAGNOSTIC_${Date.now()}`,
                    email: 'diagnostic@test.com',
                    role: 'Diagnostic Test',
                    language: 'English',
                    status: 'TEST',
                    notes: 'This is a diagnostic test record',
                    transcript: [{ speaker: 'system', text: 'Diagnostic test', timestamp: new Date().toISOString() }],
                    video_url: 'https://test.com/diagnostic.mp4',
                    result: 'TEST'
                };

                const { data: writeData, error: writeError } = await supabase
                    .from('interviews')
                    .insert([testRecord])
                    .select();

                if (writeError) {
                    diagnostics.testWrite.success = false;
                    diagnostics.testWrite.error = writeError.message;
                    diagnostics.testWrite.errorCode = writeError.code;
                    diagnostics.testWrite.errorDetails = writeError.details;
                } else {
                    diagnostics.testWrite.success = true;
                    diagnostics.testWrite.recordId = writeData?.[0]?.id;
                    diagnostics.testWrite.message = 'Successfully inserted test record';
                }

                // 4. Test Read Operation
                const { data: readData, error: readError } = await supabase
                    .from('interviews')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (readError) {
                    diagnostics.testRead.success = false;
                    diagnostics.testRead.error = readError.message;
                } else {
                    diagnostics.testRead.success = true;
                    diagnostics.testRead.recordCount = readData?.length || 0;
                    diagnostics.testRead.latestRecords = readData?.map(r => ({
                        id: r.id,
                        name: r.name,
                        email: r.email,
                        role: r.role,
                        hasVideoUrl: !!r.video_url,
                        createdAt: r.created_at
                    }));
                }

                diagnostics.supabase.canConnect = true;
                diagnostics.supabase.message = 'Connection successful';

            } catch (supabaseError) {
                diagnostics.supabase.canConnect = false;
                diagnostics.supabase.error = supabaseError.message;
                diagnostics.supabase.stack = supabaseError.stack;
            }
        }

        // 5. Overall Status
        const allChecks = [
            diagnostics.environment.hasSupabaseUrl,
            diagnostics.environment.hasSupabaseKey,
            diagnostics.supabase.canConnect,
            diagnostics.testWrite.success,
            diagnostics.testRead.success
        ];

        const passedChecks = allChecks.filter(Boolean).length;
        const totalChecks = allChecks.length;

        diagnostics.summary = {
            status: passedChecks === totalChecks ? 'HEALTHY' : passedChecks > 0 ? 'PARTIAL' : 'FAILED',
            passedChecks: `${passedChecks}/${totalChecks}`,
            issues: []
        };

        if (!diagnostics.environment.hasSupabaseUrl) {
            diagnostics.summary.issues.push('SUPABASE_URL not set');
        }
        if (!diagnostics.environment.hasSupabaseKey) {
            diagnostics.summary.issues.push('SUPABASE_ANON_KEY not set');
        }
        if (!diagnostics.supabase.canConnect) {
            diagnostics.summary.issues.push('Cannot connect to Supabase');
        }
        if (!diagnostics.testWrite.success) {
            diagnostics.summary.issues.push('Cannot write to database');
        }
        if (!diagnostics.testRead.success) {
            diagnostics.summary.issues.push('Cannot read from database');
        }

        return res.status(200).json({
            success: true,
            diagnostics
        });

    } catch (error) {
        console.error('❌ [DIAGNOSTICS] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            error: 'Diagnostic check failed',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            partialDiagnostics: diagnostics
        });
    }
}
