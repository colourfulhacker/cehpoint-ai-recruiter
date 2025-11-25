// Development server for handling Google Sheets integration
// Runs alongside Vite dev server in Replit

import express from 'express';
import { google } from 'googleapis';

const app = express();
const PORT = 3001;

app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Rate limiting
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

// Get Google Sheets access token from Replit integration
async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : null;

  if (!xReplitToken || !hostname) {
    throw new Error('Google Sheets not connected. Connect via Replit integration.');
  }

  const response = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-sheet`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to authenticate with Google Sheets');
  }

  const data = await response.json();
  const connectionSettings = data.items?.[0];

  if (!connectionSettings) {
    throw new Error('Google Sheets not configured');
  }

  const accessToken = connectionSettings?.settings?.access_token || 
                     connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new Error('No access token available');
  }

  return accessToken;
}

// Find the "AI Recruiter Interview Results" spreadsheet
async function findSheetId(sheetsClient) {
  try {
    const drive = google.drive({ version: 'v3', auth: sheetsClient.auth });
    
    const files = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and name='AI Recruiter Interview Results'",
      spaces: 'drive',
      fields: 'files(id, name)',
      pageSize: 1
    });

    if (files.data.files && files.data.files.length > 0) {
      return files.data.files[0].id;
    }

    throw new Error('Google Sheet "AI Recruiter Interview Results" not found. Please create it first.');
  } catch (error) {
    console.error('Error finding sheet:', error.message);
    throw new Error('Cannot access Google Sheets. Make sure the sheet exists and is shared.');
  }
}

// Save interview to Google Sheets
app.post('/api/save-interview', async (req, res) => {
  try {
    // Rate limiting
    const ip = req.ip || 'unknown';
    const rateLimit = checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: 60
      });
    }

    // Validate input
    const { name, role, language, status, notes, transcript, date } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    if (!role || typeof role !== 'string') {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (name.length > 200 || (transcript && transcript.length > 50000)) {
      return res.status(400).json({ error: 'Input too long' });
    }

    // Get Google Sheets client
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const sheetsClient = google.sheets({ version: 'v4', auth: oauth2Client });

    // Find sheet
    const sheetId = await findSheetId(sheetsClient);

    // Append data
    await sheetsClient.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          date || new Date().toISOString(),
          name.trim(),
          role,
          language || 'English',
          status || 'Unknown',
          notes || '',
          transcript || ''
        ]]
      }
    });

    return res.status(200).json({ 
      result: 'success',
      message: 'Saved to Google Sheets',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error.message);

    if (error.message.includes('not connected') || error.message.includes('not configured')) {
      return res.status(503).json({ 
        error: error.message 
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({ 
        error: error.message
      });
    }

    return res.status(500).json({ 
      error: 'Failed to save data',
      details: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ API Server running on http://0.0.0.0:${PORT}`);
  console.log(`📧 Google Sheets integration available`);
});
