/**
 * Video Upload Utility for Cloudinary Integration
 * Uses direct browser upload to Cloudinary to bypass Vercel's 4.5MB limit
 */

export interface VideoUploadResult {
    success: boolean;
    videoUrl?: string;
    publicId?: string;
    error?: string;
}

export interface VideoUploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

/**
 * Upload video blob directly to Cloudinary (bypassing serverless function)
 * This avoids Vercel's 4.5MB payload limit
 */
export async function uploadVideoToCloudinary(
    videoBlob: Blob,
    metadata: {
        name: string;
        role: string;
        timestamp: number;
    },
    onProgress?: (progress: VideoUploadProgress) => void
): Promise<VideoUploadResult> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    console.log('📤 [UPLOAD UTIL] Starting DIRECT upload to Cloudinary...');
    console.log('📤 [UPLOAD UTIL] Video size:', videoBlob.size, 'bytes', `(${(videoBlob.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log('📤 [UPLOAD UTIL] Metadata:', metadata);

    // Cloudinary configuration
    const cloudName = 'dvparynza';
    const uploadPreset = 'interview_recordings'; // We'll need to create this

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`📤 [UPLOAD UTIL] Attempt ${attempt}/${maxRetries}`);
        try {
            // Create FormData for direct Cloudinary upload
            const formData = new FormData();
            const publicId = `interview-recordings/interview_${metadata.name.replace(/\s+/g, '_')}_${metadata.timestamp}`;

            formData.append('file', videoBlob);
            formData.append('upload_preset', uploadPreset);
            formData.append('public_id', publicId);
            formData.append('resource_type', 'video');
            formData.append('folder', 'interview-recordings');

            // Add metadata as context
            formData.append('context', `name=${metadata.name}|role=${metadata.role}|timestamp=${metadata.timestamp}`);

            console.log('📤 [UPLOAD UTIL] Uploading directly to Cloudinary...');
            console.log('📤 [UPLOAD UTIL] Public ID:', publicId);

            // Upload directly to Cloudinary
            const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
                method: 'POST',
                body: formData,
            });

            console.log('📤 [UPLOAD UTIL] Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
                console.error('❌ [UPLOAD UTIL] Upload failed:', errorData);
                throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
            }

            const result = await response.json();
            console.log('✅ [UPLOAD UTIL] Upload successful!');
            console.log('📤 [UPLOAD UTIL] Result:', result);

            return {
                success: true,
                videoUrl: result.secure_url,
                publicId: result.public_id,
            };

        } catch (error: any) {
            lastError = error;
            console.error(`❌ [UPLOAD UTIL] Attempt ${attempt}/${maxRetries} failed:`, error.message);

            // Don't retry on client errors (4xx)
            if (error.message.includes('400') || error.message.includes('413')) {
                break;
            }

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`⏳ [UPLOAD UTIL] Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    console.error('❌ [UPLOAD UTIL] All retries failed');
    return {
        success: false,
        error: lastError?.message || 'Video upload failed after multiple attempts',
    };
}

/**
 * Validate video blob before upload
 */
export function validateVideoBlob(videoBlob: Blob): { valid: boolean; error?: string } {
    if (!videoBlob || videoBlob.size === 0) {
        return { valid: false, error: 'No video data available' };
    }

    // Check file size (max 100MB for Cloudinary free tier)
    const maxSize = 100 * 1024 * 1024;
    if (videoBlob.size > maxSize) {
        return { valid: false, error: 'Video file too large (max 100MB)' };
    }

    // Accept webm and mp4 with or without codec specification
    const type = videoBlob.type.toLowerCase();
    const isValidType = type.startsWith('video/webm') || type.startsWith('video/mp4');

    if (!isValidType) {
        return { valid: false, error: `Invalid video format: ${videoBlob.type}` };
    }

    return { valid: true };
}
