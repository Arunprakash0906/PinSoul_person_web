// Google Sheets API Service for PinSoul
export const GOOGLE_CLIENT_ID = '559156268261-tqcem0uudg81ccfs8qia6b6cukgqiqj8.apps.googleusercontent.com';
export const SPREADSHEET_ID = '1GR4-v0yBN9_WHQetdo7wwqf_qHdB_VQbuZMmtJXVmRo';
export const SPREADSHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=0#gid=0`;
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

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
        callback: (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (response.access_token) {
            saveToken(response.access_token, Number(response.expires_in) || 3600);
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
 * Ensures header row exists in the spreadsheet
 */
export async function ensureSheetHeaders(token, sheetTitle) {
  try {
    const checkRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:H1`,
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
      'Location ID',
      'Address',
      'Category',
      'Latitude',
      'Longitude',
      'Notes',
      'Created At',
      'Google Maps Link',
    ];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A1:H1?valueInputOption=USER_ENTERED`,
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
 * Inspect Google Sheet to find next numeric Location ID starting from 1001
 */
export async function getNextSheetLocationId() {
  const token = getSavedToken();
  if (!token) return null;

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
          const match = String(r[0] || '').match(/\d+/);
          return match ? parseInt(match[0], 10) : null;
        })
        .filter((n) => n !== null && n >= 1000);

      if (ids.length > 0) {
        return Math.max(...ids) + 1;
      }
      return 1001;
    }
  } catch (err) {
    console.warn('Could not query next ID from Google Sheet:', err);
  }
  return null;
}

/**
 * Append a location row to the Google Sheet
 */
export async function appendLocationToSheet(location) {
  const token = await getGoogleToken();
  const sheetTitle = await getFirstSheetTitle(token);

  await ensureSheetHeaders(token, sheetTitle);

  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;

  const row = [
    String(location.locationId || '1001'),
    location.address || '',
    location.category || 'OTHER',
    String(location.latitude),
    String(location.longitude),
    location.notes || '',
    location.createdAt || new Date().toISOString(),
    mapsLink,
  ];

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A:H:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
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

  return await response.json();
}

/**
 * Fetch all pinned locations from Google Sheet
 */
export async function fetchLocationsFromSheet() {
  const token = await getGoogleToken();
  const sheetTitle = await getFirstSheetTitle(token);

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetTitle)}!A2:H`,
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
    .filter((row) => row && row.length >= 5)
    .map((row, index) => {
      const parsedId = String(row[0] || (1001 + index)).trim();
      return {
        locationId: parsedId,
        address: row[1] || 'Pinned Location',
        category: (row[2] || 'OTHER').toUpperCase().replace(/\s+/g, '_'),
        latitude: parseFloat(row[3]),
        longitude: parseFloat(row[4]),
        notes: row[5] || '',
        createdAt: row[6] || new Date().toISOString(),
        mapsLink: row[7] || '',
      };
    })
    .filter((loc) => Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude));
}
