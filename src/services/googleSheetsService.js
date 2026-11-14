// Google Sheets API Service for PinSoul
export const GOOGLE_CLIENT_ID = '559156268261-tqcem0uudg81ccfs8qia6b6cukgqiqj8.apps.googleusercontent.com';
export const SPREADSHEET_ID = '1GR4-v0yBN9_WHQetdo7wwqf_qHdB_VQbuZMmtJXVmRo';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=0#gid=0`;
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile';

const TOKEN_KEY = 'pinsoul_google_access_token';
const TOKEN_EXPIRY_KEY = 'pinsoul_google_token_expiry';

let tokenClient = null;

/**
 * Loads the Google Identity Services client script dynamically if not present
 */
export function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services script.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'));
    document.head.appendChild(script);
  });
}

/**
 * Retrieve saved non-expired access token
 */
export function getSavedToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = Number(localStorage.getItem(TOKEN_EXPIRY_KEY) || 0);
  if (token && expiry > Date.now()) {
    return token;
  }
  return null;
}

/**
 * Save access token with expiration buffer
 */
export function saveToken(token, expiresInSeconds = 3600) {
  localStorage.setItem(TOKEN_KEY, token);
  const expiry = Date.now() + Math.max(300, expiresInSeconds - 60) * 1000;
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
}

/**
 * Clear saved access token
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Automatically get detected username from localStorage / login sessions
 */
export function getAutoUsername() {
  const direct = localStorage.getItem('pinsoul_username');
  if (direct && direct.trim()) return direct.trim();

  const uname = localStorage.getItem('username');
  if (uname && uname.trim()) return uname.trim();

  try {
    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      if (rawUser.startsWith('{')) {
        const u = JSON.parse(rawUser);
        return u.name || u.username || u.email || '';
      }
      return rawUser.trim();
    }
  } catch {}

  const signId = localStorage.getItem('signId');
  if (signId && signId.trim()) return signId.trim();

  return '';
}

/**
 * Fetch Google User Profile (name/email) using OAuth access token
 */
export async function fetchGoogleUserProfile(token) {
  if (!token) return '';
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.ok) {
      const data = await res.json();
      const name = data.name || data.given_name || data.email || '';
      if (name) {
        localStorage.setItem('pinsoul_username', name);
      }
      return name;
    }
  } catch (err) {
    console.warn('Could not fetch Google user profile:', err);
  }
  return '';
}

/**
 * Initialize or get Google OAuth2 Token Client
 */
export async function getGoogleToken(promptConsent = false) {
  const existingToken = getSavedToken();
  if (existingToken && !promptConsent) {
    return existingToken;
  }

  await loadGsiScript();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services SDK is not available.');
  }

  return new Promise((resolve, reject) => {
    try {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SHEETS_SCOPE,
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            saveToken(response.access_token, Number(response.expires_in) || 3600);
            // Attempt to grab user's Google display name in background
            fetchGoogleUserProfile(response.access_token).catch(() => {});
            resolve(response.access_token);
          } else {
            reject(new Error('No access token received from Google.'));
          }
        },
      });

      tokenClient.requestAccessToken({
        prompt: promptConsent ? 'consent' : '',
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Discover the title of the first sheet (gid=0)
 */
let cachedSheetTitle = null;

export async function getFirstSheetTitle(token) {
  if (cachedSheetTitle) return cachedSheetTitle;

  try {
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=sheets.properties`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return 'Sheet1';
    }

    const data = await res.json();
    if (data.sheets && data.sheets.length > 0) {
      cachedSheetTitle = data.sheets[0].properties.title || 'Sheet1';
      return cachedSheetTitle;
    }
  } catch (err) {
    console.warn('Could not inspect sheet properties, defaulting to Sheet1:', err);
  }

  return 'Sheet1';
}

/**
 * Format date & time in Indian Standard Time (IST) 12-hour format with AM/PM
 * Example output: "14/11/2026, 02:45:10 PM"
 */
export function formatIndiaDateTime12h(dateInput = new Date()) {
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) {
      return String(dateInput || '');
    }

    const dateFormatted = d.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }); // "14/11/2026"

    const timeFormatted = d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }); // "02:45:10 PM"

    return `${dateFormatted}, ${timeFormatted}`;
  } catch (err) {
    console.error('Error formatting India date:', err);
    return new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
  }
}

/**
 * Ensures header row exists in the spreadsheet
 */
export async function ensureSheetHeaders(token, sheetTitle) {
  try {
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:I1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (checkRes.ok) {
      const data = await checkRes.json();
      if (data.values && data.values.length > 0 && data.values[0].length >= 3) {
        return;
      }
    }

    const headerRow = [
      'ID',
      'Username',
      'Place',
      'Category',
      'Latitude',
      'Longitude',
      'Notes / Description',
      'Date &TIme',
      'Link',
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:I1?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [headerRow],
        }),
      }
    );
  } catch (err) {
    console.warn('Header initialization notice:', err);
  }
}

/**
 * Inspect Google Sheet to find next numeric Location ID starting from 1001.
 * Guaranteed strictly unique across the entire sheet (NOT category based).
 */
export async function getNextSheetLocationId() {
  const token = await getGoogleToken();
  if (!token) return 1001;

  try {
    const sheetTitle = await getFirstSheetTitle(token);
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A2:A`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      const rows = data.values || [];
      const ids = rows
        .map((r) => {
          const val = String(r?.[0] || '').trim();
          const match = val.match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter((n) => n !== null && n >= 1000 && n < 10000000);

      if (ids.length > 0) {
        return Math.max(...ids) + 1;
      }
      return 1001;
    }
  } catch (err) {
    console.warn('Could not query next ID from Google Sheet:', err);
  }
  return 1001;
}

/**
 * Append a location row to the Google Sheet
 * Columns:
 * A: ID (Unique across sheet, not category based)
 * B: Username (Automatically saved username)
 * C: Place (Address)
 * D: Category
 * E: Latitude
 * F: Longitude
 * G: Notes / Description
 * H: Date &TIme (India Time, 12-hour period AM/PM)
 * I: Link (Google Maps search link)
 */
export async function appendLocationToSheet(location) {
  const token = await getGoogleToken();
  const sheetTitle = await getFirstSheetTitle(token);

  await ensureSheetHeaders(token, sheetTitle);

  // 1. Generate strictly unique ID from Google Sheet (NOT category based)
  const nextSheetId = await getNextSheetLocationId();
  const finalId = String(nextSheetId || location.locationId || '1001');
  location.locationId = finalId;

  // 2. Automatically resolve Username
  const resolvedUsername = (
    location.username ||
    getAutoUsername() ||
    (await fetchGoogleUserProfile(token)) ||
    'User'
  ).trim();
  location.username = resolvedUsername;

  // 3. Save Date & Time in India Time (12-hour period AM/PM)
  const indiaDateTime = formatIndiaDateTime12h(location.createdAt || new Date());
  location.createdAt = indiaDateTime;

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

  const row = [
    String(finalId),
    resolvedUsername,
    location.address || '',
    location.category || 'Other',
    String(location.latitude),
    String(location.longitude),
    location.notes || '',
    indiaDateTime,
    mapsLink,
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A:I:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [row],
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Google Sheets API Error:', response.status, errorBody);
    if (response.status === 401) {
      clearToken();
      throw new Error('Google authorization token expired. Please connect again.');
    }
    throw new Error(`Google Sheets error (${response.status}): ${errorBody}`);
  }

  const result = await response.json();
  return {
    ...result,
    assignedId: finalId,
    username: resolvedUsername,
    createdAt: indiaDateTime,
  };
}

/**
 * Fetch all pinned locations from Google Sheet with support for 9-column format
 * (ID, Username, Place, Category, Latitude, Longitude, Notes, Date & Time, Link)
 */
export async function fetchLocationsFromSheet() {
  const token = await getGoogleToken();
  const sheetTitle = await getFirstSheetTitle(token);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A2:I`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      throw new Error('Google authorization token expired. Please connect again.');
    }
    const errText = await response.text();
    throw new Error(`Failed to fetch from Google Sheets (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rows = data.values || [];

  return rows
    .filter((row) => row && row.length >= 4)
    .map((row, index) => {
      // Detect if row has Username at column B:
      // In 9-col layout: [ID, Username, Place, Category, Latitude, Longitude, Notes, Date, Link]
      // In 8-col layout: [ID, Place, Category, Latitude, Longitude, Notes, Date, Link]
      const hasUsernameCol = isNaN(parseFloat(row[3])) && !isNaN(parseFloat(row[4])) && !isNaN(parseFloat(row[5]));

      let locationId = String(row[0] || (1001 + index)).trim();
      let username = '';
      let address = '';
      let category = '';
      let latitude = 0;
      let longitude = 0;
      let notes = '';
      let createdAt = '';
      let mapsLink = '';

      if (hasUsernameCol) {
        username = row[1] || '';
        address = row[2] || 'Pinned Location';
        category = row[3] || 'Other';
        latitude = parseFloat(row[4]);
        longitude = parseFloat(row[5]);
        notes = row[6] || '';
        createdAt = row[7] || '';
        mapsLink = row[8] || '';
      } else {
        username = '';
        address = row[1] || 'Pinned Location';
        category = row[2] || 'Other';
        latitude = parseFloat(row[3]);
        longitude = parseFloat(row[4]);
        notes = row[5] || '';
        createdAt = row[6] || '';
        mapsLink = row[7] || '';
      }

      return {
        locationId,
        username,
        address,
        category,
        latitude,
        longitude,
        notes,
        createdAt,
        mapsLink,
      };
    })
    .filter((loc) => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
}
