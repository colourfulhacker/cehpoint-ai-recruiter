/**
 * Script to clean up test/old interview records from the database
 * 
 * Usage:
 * 1. Open browser console on https://interview-ai.cehpoint.co.in
 * 2. Copy and paste this entire script
 * 3. Press Enter
 * 
 * This will delete ALL records from the interviews table.
 */

async function cleanupAllRecords() {
    console.log('🧹 Starting cleanup...');

    try {
        const response = await fetch('https://interview-ai.cehpoint.co.in/api/cleanup-interviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deleteAll: true
            })
        });

        const result = await response.json();

        if (result.success) {
            console.log('✅ Cleanup successful!');
            console.log(`Deleted ${result.deletedCount} record(s)`);
            console.log('Refresh the HR dashboard to see the changes.');
        } else {
            console.error('❌ Cleanup failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

// Run the cleanup
cleanupAllRecords();
