import { createClient } from '@supabase/supabase-js';

/**
 * Admin endpoint to delete test/old interview records
 * This helps clean up the database when test records need to be removed
 */

export default async function handler(req, res) {
    // CORS handling
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { recordIds, deleteAll } = req.body;

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return res.status(503).json({
                error: 'Database configuration missing'
            });
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        let deletedCount = 0;

        if (deleteAll) {
            // Delete all records (use with caution!)
            const { error, count } = await supabase
                .from('interviews')
                .delete()
                .neq('id', 0); // Delete all records where id != 0 (i.e., all records)

            if (error) {
                console.error('❌ Delete all failed:', error);
                return res.status(500).json({
                    error: 'Failed to delete records',
                    details: error.message
                });
            }

            deletedCount = count || 0;
            console.log(`✅ Deleted all ${deletedCount} records`);

        } else if (recordIds && Array.isArray(recordIds)) {
            // Delete specific records by ID
            const { error, count } = await supabase
                .from('interviews')
                .delete()
                .in('id', recordIds);

            if (error) {
                console.error('❌ Delete specific records failed:', error);
                return res.status(500).json({
                    error: 'Failed to delete records',
                    details: error.message
                });
            }

            deletedCount = count || 0;
            console.log(`✅ Deleted ${deletedCount} specific records`);

        } else {
            return res.status(400).json({
                error: 'Invalid request',
                message: 'Provide either recordIds array or deleteAll: true'
            });
        }

        return res.status(200).json({
            success: true,
            message: `Successfully deleted ${deletedCount} record(s)`,
            deletedCount
        });

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return res.status(500).json({
            error: 'Failed to clean up records',
            details: error.message
        });
    }
}
