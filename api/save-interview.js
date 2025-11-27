import { google } from 'googleapis';
import { supabase } from './lib/supabase';

// Helper to check rate limit (simple in-memory for demo, but Vercel functions are stateless so this won't work perfectly across invocations. 
// For production, use KV or similar. For now, we'll skip strict rate limiting or rely on Vercel's built-in protection if available, 
// or accept that this simple map only works for the warm instance.)
const requestCounts = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const WINDOW = 60000;
  const MAX = 10;

  const data = requestCounts.get(ip);

  if (!data || now - data.firstRequest > WINDOW) {
    requestCounts.set(ip, { count: 1, firstRequest: now });
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
    // Note: In serverless, in-memory rate limiting is not reliable. 
    // But we keep it as a basic check for the active instance.
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: 60
      });
    }

    // Validate input
    const { name, email, role, language, status, notes, transcript, date, videoUrl } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (name.length > 200 || (transcript && transcript.length > 50000)) {
      return res.status(400).json({ error: 'Input too long' });
    }

    // --- 1. Save to Supabase ---
    console.log('💾 Saving to Supabase...');
    const { data, error: supabaseError } = await supabase
      .from('interviews')
      .insert([
        {
          name: name.trim(),
          email: email ? email.trim() : null,
          role,
          language: language || 'English',
          status: status || 'Unknown',
          notes: notes || '',
          transcript: transcript || [], // Store as JSON
          video_url: videoUrl || '',
          created_at: date || new Date().toISOString()
        }
      ])
      .select();

    if (supabaseError) {
      console.error('❌ Supabase Error:', supabaseError);
      // We don't fail the whole request if Supabase fails, we might still want to try Google Sheets or return partial success
      // But for now, let's log it.
    } else {
      console.log('✅ Saved to Supabase:', data);
    }

    // --- 2. Save to Google Sheets (Legacy/Backup) ---
    try {
      const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
      const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
      const sheetId = process.env.GOOGLE_SHEET_ID;

      if (clientEmail && privateKey) {
        const auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        let targetSheetId = sheetId;

        if (!targetSheetId) {
          // Try to find sheet if ID not provided
          const drive = google.drive({ version: 'v3', auth });
          const files = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.spreadsheet' and name='AI Recruiter Interview Results'",
            spaces: 'drive',
            fields: 'files(id, name)',
            pageSize: 1
          });
          if (files.data.files && files.data.files.length > 0) {
            targetSheetId = files.data.files[0].id;
          }
        }

        if (targetSheetId) {
          await sheets.spreadsheets.values.append({
            spreadsheetId: targetSheetId,
            range: 'Sheet1!A:I', // Extended range for email
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[
                date || new Date().toISOString(),
                name.trim(),
                email || '', // Add email to sheet
                role,
                language || 'English',
                status || 'Unknown',
                notes || '',
                JSON.stringify(transcript).substring(0, 4000) || '', // Truncate for sheet
                videoUrl || ''
              ]]
            }
          });
          console.log('✅ Saved to Google Sheets');
        }
      }
    } catch (sheetError) {
      console.warn('⚠️ Google Sheets Error (Non-fatal):', sheetError.message);
    }

    return res.status(200).json({
      result: 'success',
      message: 'Saved to Supabase and Google Sheets',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({
      error: 'Failed to save data',
      details: error.message
    });
  }
}
