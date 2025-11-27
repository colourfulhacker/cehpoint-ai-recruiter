import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azfufiwxhmmplvtynigx.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZnVmaXd4aG1tcGx2dHluaWd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNzkwMzUsImV4cCI6MjA3OTc1NTAzNX0.oggLMifugJnVYs-x0iEeYZkhsT5z47KPkxyBQ_VxuUM';

console.log('🧪 Testing Supabase Connection...');
console.log('URL:', supabaseUrl);
console.log('Key:', supabaseAnonKey.substring(0, 20) + '...');

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
    try {
        console.log('\n📊 Attempting to query interviews table...');

        const { data, error } = await supabase
            .from('interviews')
            .select('*')
            .limit(5);

        if (error) {
            console.error('❌ Supabase Error:', error);
            console.error('Error details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            process.exit(1);
        }

        console.log('✅ Connection successful!');
        console.log(`📝 Found ${data?.length || 0} interviews`);
        if (data && data.length > 0) {
            console.log('Sample data:', JSON.stringify(data[0], null, 2));
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err);
        process.exit(1);
    }
}

testConnection();
