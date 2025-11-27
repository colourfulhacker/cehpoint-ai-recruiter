export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
        success: true,
        message: 'Test endpoint working',
        env: {
            hasSupabaseUrl: !!process.env.SUPABASE_URL,
            hasSupabaseKey: !!process.env.SUPABASE_ANON_KEY,
            supabaseUrlPrefix: process.env.SUPABASE_URL?.substring(0, 30),
            nodeEnv: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
    });
}
