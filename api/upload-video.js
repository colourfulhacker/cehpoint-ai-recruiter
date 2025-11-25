import { v2 as cloudinary } from 'cloudinary';
import Busboy from 'busboy';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Rate limiting (simple in-memory for serverless)
const uploadCounts = new Map();

function checkUploadRateLimit(ip) {
  const now = Date.now();
  const WINDOW = 60000; // 1 minute
  const MAX = 5; // 5 uploads per minute

  const data = uploadCounts.get(ip);

  if (!data || now - data.firstRequest > WINDOW) {
    uploadCounts.set(ip, { count: 1, firstRequest: now });
    return { allowed: true, remaining: MAX - 1 };
  }

  if (data.count >= MAX) {
    return { allowed: false, remaining: 0 };
  }

  data.count++;
  return { allowed: true, remaining: MAX - data.count };
}

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
    // Rate limiting
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const rateLimit = checkUploadRateLimit(ip);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many upload requests',
        retryAfter: 60
      });
    }

    // Check Cloudinary configuration
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      console.error('❌ Cloudinary not configured');
      return res.status(503).json({
        error: 'Cloudinary not configured. Please set environment variables.'
      });
    }

    console.log('📤 [API] Received upload request');
    console.log('📤 [API] Content-Type:', req.headers['content-type']);

    // Parse multipart form data using busboy
    const busboy = Busboy({ headers: req.headers });

    let videoBuffer = null;
    let name = 'unknown';
    let role = 'unknown';
    let timestamp = Date.now();
    let filename = '';

    // Collect file data
    busboy.on('file', (fieldname, file, info) => {
      console.log('📤 [API] Receiving file:', fieldname, info);
      filename = info.filename;
      const chunks = [];

      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        videoBuffer = Buffer.concat(chunks);
        console.log('📤 [API] File received, size:', videoBuffer.length, 'bytes');
      });
    });

    // Collect form fields
    busboy.on('field', (fieldname, value) => {
      console.log('📤 [API] Field:', fieldname, '=', value);
      if (fieldname === 'name') name = value;
      if (fieldname === 'role') role = value;
      if (fieldname === 'timestamp') timestamp = parseInt(value) || Date.now();
    });

    // Wait for parsing to complete
    await new Promise((resolve, reject) => {
      busboy.on('finish', resolve);
      busboy.on('error', reject);
      req.pipe(busboy);
    });

    if (!videoBuffer || videoBuffer.length === 0) {
      console.error('❌ [API] No video data received');
      return res.status(400).json({ error: 'No video file provided' });
    }

    // Validate file size (max 100MB)
    const maxSize = 100 * 1024 * 1024;
    if (videoBuffer.length > maxSize) {
      console.error('❌ [API] File too large:', videoBuffer.length);
      return res.status(413).json({ error: 'Video file too large (max 100MB)' });
    }

    console.log('✅ [API] Video data validated');
    console.log('📤 [API] Uploading to Cloudinary...');

    // Create public ID for the video
    const publicId = `interview-recordings/interview_${name.replace(/\s+/g, '_')}_${timestamp}`;

    // Convert buffer to base64 data URI for Cloudinary upload
    const base64Data = videoBuffer.toString('base64');
    const dataUri = `data:video/webm;base64,${base64Data}`;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'video',
      public_id: publicId,
      folder: 'interview-recordings',
      overwrite: false,
    });

    console.log('✅ [API] Upload successful!');
    console.log('📤 [API] Video URL:', uploadResult.secure_url);

    return res.status(200).json({
      success: true,
      videoUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      duration: uploadResult.duration,
      format: uploadResult.format
    });

  } catch (error) {
    console.error('❌ [API] Upload error:', error.message);
    console.error('❌ [API] Error stack:', error.stack);

    // Handle specific Cloudinary errors
    if (error.http_code === 401) {
      return res.status(401).json({ error: 'Invalid Cloudinary credentials' });
    }

    if (error.http_code === 420) {
      return res.status(429).json({ error: 'Cloudinary rate limit exceeded' });
    }

    if (error.http_code === 400) {
      return res.status(400).json({
        error: 'Invalid video format',
        details: error.message
      });
    }

    return res.status(500).json({
      error: 'Failed to upload video',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Configure Vercel to handle larger payloads and increase timeout
export const config = {
  api: {
    bodyParser: false, // Disable default body parser to use busboy
    responseLimit: false,
  },
  maxDuration: 60, // 60 seconds for video upload
};
