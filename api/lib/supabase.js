import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

let supabaseInstance = null;

export function getSupabase() {
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Missing Supabase credentials:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });
        return null;
    }

    if (!supabaseInstance) {
        console.log('✅ Creating Supabase client...');
        supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    }

    return supabaseInstance;
}

export const supabase = getSupabase();
