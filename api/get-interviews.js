import { v2 as cloudinary } from 'cloudinary';

/**
 * API endpoint to fetch all interview videos from Cloudinary
 * Returns candidate names and video URLs for HR dashboard
 */

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

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
        console.log('📊 [GET-INTERVIEWS] Fetching interview videos from Cloudinary...');

        // Check Cloudinary configuration
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
            console.error('❌ [GET-INTERVIEWS] Cloudinary not configured');
            return res.status(503).json({
                error: 'Cloudinary not configured',
                message: 'Please contact administrator'
            });
        }

        // Fetch all videos from the interview-recordings folder
        const result = await cloudinary.api.resources({
            type: 'upload',
            resource_type: 'video',
            prefix: 'interview-recordings/',
            max_results: 500, // Adjust as needed
        });

        if (!result.resources || result.resources.length === 0) {
            console.log('⚠️ [GET-INTERVIEWS] No videos found in Cloudinary');
            return res.status(200).json({
                success: true,
                interviews: [],
                message: 'No interviews found'
            });
        }

        // Parse video metadata and extract candidate information
        const interviews = result.resources.map((video, index) => {
            // Extract name from public_id: "interview-recordings/interview_John_Doe_1234567890"
            const publicId = video.public_id;
            const filename = publicId.split('/').pop() || '';

            // Parse the filename pattern: interview_Name_Timestamp
            const parts = filename.replace('interview_', '').split('_');
            const timestamp = parts.pop(); // Remove timestamp
            const name = parts.join(' ').replace(/_/g, ' ') || 'Unknown Candidate';

            return {
                id: index + 1,
                name: name,
                videoUrl: video.secure_url,
                publicId: video.public_id,
                duration: video.duration || 0,
                format: video.format || 'webm',
                createdAt: video.created_at,
                bytes: video.bytes,
            };
        });

        // Sort by creation date (newest first)
        interviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        console.log(`✅ [GET-INTERVIEWS] Found ${interviews.length} interview videos`);

        return res.status(200).json({
            success: true,
            interviews,
            count: interviews.length
        });

    } catch (error) {
        console.error('❌ [GET-INTERVIEWS] Error:', error.message);

        // Handle specific Cloudinary errors
        if (error.http_code === 401) {
            return res.status(401).json({ error: 'Invalid Cloudinary credentials' });
        }

        return res.status(500).json({
            error: 'Failed to fetch interviews',
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
}
