import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Helper to check rate limit (simple in-memory for demo, but Vercel functions are stateless so this won't work perfectly across invocations. 
// For production, use KV or similar. For now, we'll skip strict rate limiting or rely on Vercel's built-in protection if available, 
// or accept that this simple map only works for the warm instance.)
const requestCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60 * 1000; // 1 minute window

  // Clean up old entries
  for (const [key, data] of requestCounts.entries()) {
    if (data.timestamp < windowStart) {
      requestCounts.delete(key);
    }
  }

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return true;
  }

  const data = requestCounts.get(ip);
  if (data.count >= 5) { // Limit to 5 requests per minute per IP
    return false;
  }

  data.count++;
  return true;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  try {
    const { name, email, role, language, status, notes, transcript, videoUrl } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const timestamp = new Date().toISOString();
    let supabaseSuccess = false;
    let sheetSuccess = false;
    let errors = [];

    // 1. Save to Supabase (Primary)
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);

        const { error: supabaseError } = await supabase
          .from('interviews')
          .insert([
            {
              name,
              email,
              role,
              language,
              status,
              notes,
              transcript, // Supabase handles JSONB automatically
              video_url: videoUrl
            }
          ]);

        if (supabaseError) {
          console.error('❌ Supabase Save Error:', supabaseError);
          errors.push(`Supabase: ${supabaseError.message}`);
        } else {
          supabaseSuccess = true;
          console.log('✅ Saved to Supabase');
        }
      } else {
        console.warn('⚠️ Supabase credentials missing, skipping Supabase save');
        errors.push('Supabase: Credentials missing');
      }
    } catch (err) {
      console.error('❌ Supabase Exception:', err);
      errors.push(`Supabase Exception: ${err.message}`);
    }

    // 2. Save to Google Sheets (Backup)
    try {
      if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SHEET_ID) {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: process.env.GOOGLE_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // Format transcript for Sheets (as string)
        const transcriptText = Array.isArray(transcript)
          ? transcript.map(t => `[${t.timestamp}] ${t.speaker}: ${t.text}`).join('\n')
          : (typeof transcript === 'string' ? transcript : JSON.stringify(transcript));

        await sheets.spreadsheets.values.append({
          spreadsheetId: process.env.GOOGLE_SHEET_ID,
          range: 'Sheet1!A:I', // Adjusted range for new columns
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              timestamp,
              name,
              email || '', // Add email column
              role,
              language || 'English',
              status,
              notes,
              transcriptText,
              videoUrl || ''
            ]],
          },
        });
        sheetSuccess = true;
        console.log('✅ Saved to Google Sheets');
      } else {
        console.warn('⚠️ Google Sheets credentials missing, skipping Sheets save');
      }
    } catch (err) {
      console.error('❌ Google Sheets Save Error:', err);
      // Don't fail the request if just Sheets fails, as long as Supabase worked or we want to return partial success
      errors.push(`Sheets: ${err.message}`);
    }

    if (!supabaseSuccess && !sheetSuccess) {
      return res.status(500).json({
        error: 'Failed to save to both Supabase and Google Sheets',
        details: errors
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Interview saved successfully',
      sources: {
        supabase: supabaseSuccess,
        sheets: sheetSuccess
      },
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Save Interview Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
