// Test Cloudinary Upload API
// Run this to test if Cloudinary credentials are working

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dvparynza',
    api_key: '868842388793697',
    api_secret: 'Y9AOrkIw8wmdQs_7jWHnqOpg99s',
});

async function testCloudinaryConnection() {
    console.log('🧪 Testing Cloudinary connection...');
    console.log('Cloud Name:', cloudinary.config().cloud_name);
    console.log('API Key:', cloudinary.config().api_key);

    try {
        // Test upload with a small base64 encoded test video
        const testDataUri = 'data:video/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwEAAAAAAAHTEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHGTbuMU6uEElTDZ1OsggEXTbuMU6uEHFO7a1OsggG97AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmoCrXsYMPQkBNgIRMYXZmV0GETGF2ZkSJiEBnIEcAAAAAAAAFlSua8yuAQAAAAAAAEUy4kAYAAAAAAABHrgEAAAAAAAA+14EBc8WBAZyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhAJiWgDgIgEAwAQCdASoQABAAAUAmJaJAABAAAAAAA==';

        console.log('📤 Uploading test video...');
        const result = await cloudinary.uploader.upload(testDataUri, {
            resource_type: 'video',
            public_id: 'test-upload-' + Date.now(),
            folder: 'interview-recordings',
        });

        console.log('✅ Upload successful!');
        console.log('Video URL:', result.secure_url);
        console.log('Public ID:', result.public_id);
        console.log('Duration:', result.duration);

        // Clean up test file
        console.log('🗑️ Cleaning up test file...');
        await cloudinary.uploader.destroy(result.public_id, { resource_type: 'video' });
        console.log('✅ Test complete!');

        return true;
    } catch (error) {
        console.error('❌ Cloudinary test failed:', error);
        console.error('Error details:', error.message);
        if (error.http_code) {
            console.error('HTTP Code:', error.http_code);
        }
        return false;
    }
}

testCloudinaryConnection()
    .then(success => {
        if (success) {
            console.log('\n✅ Cloudinary is configured correctly!');
        } else {
            console.log('\n❌ Cloudinary configuration has issues. Check the error above.');
        }
        process.exit(success ? 0 : 1);
    })
    .catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
