const STORAGE_KEY = 'pinsoul_locations';
const CLEANED_FLAG = 'pinsoul_cleaned_mock_defaults_v2';

// No default locations - starts completely clean
export const INITIAL_LOCATIONS = [];

// Legacy mock addresses to purge from existing browser storage
const LEGACY_DEFAULT_ADDRESSES = new Set([
  'Eiffel Tower Viewpoint, Paris',
  'Shibuya Crossing Cafe, Tokyo',
  'Central Park Great Lawn, New York',
  'Trattoria Romana, Rome',
  'Louvre Art Museum, Paris',
]);

export function getStoredLocations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    let parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Automatically purge legacy default mock locations from user's browser
    const alreadyCleaned = localStorage.getItem(CLEANED_FLAG);
    if (!alreadyCleaned) {
      parsed = parsed.filter((item) => !LEGACY_DEFAULT_ADDRESSES.has(item.address));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CLEANED_FLAG, 'true');
    }

    if (parsed.length === 0) {
      return [];
    }

    // Clean up IDs: filter out timestamp IDs (> 999999) to keep numbers strictly 1001+
    let needsUpdate = false;
    let counter = 1001;

    const existingNumerics = parsed
      .map((p) => {
        const num = parseInt(String(p.locationId || '').replace(/\D/g, ''), 10);
        return !isNaN(num) && num >= 1000 && num < 1000000 ? num : null;
      })
      .filter((n) => n !== null);

    if (existingNumerics.length > 0) {
      counter = Math.max(...existingNumerics) + 1;
    }

    const normalized = parsed.map((item) => {
      const num = parseInt(String(item.locationId || '').replace(/\D/g, ''), 10);
      if (!item.locationId || isNaN(num) || num >= 1000000) {
        needsUpdate = true;
        return { ...item, locationId: String(counter++) };
      }
      return item;
    });

    if (needsUpdate) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }

    return parsed;
  } catch (e) {
    console.error('Failed to read locations from localStorage:', e);
    return [];
  }
}

/**
 * Calculates next location ID starting from 1001
 */
export function getNextLocationId(additionalLocations = []) {
  const current = getStoredLocations();
  const all = [...current, ...additionalLocations];

  const numericIds = all
    .map((l) => {
      const match = String(l.locationId || '').match(/\d+/);
      const val = match ? parseInt(match[0], 10) : null;
      return val !== null && val >= 1000 && val < 1000000 ? val : null;
    })
    .filter((num) => num !== null);

  if (numericIds.length === 0) {
    return 1001;
  }

  return Math.max(...numericIds) + 1;
}

export function setStoredLocations(locations) {
  try {
    if (Array.isArray(locations)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(locations));
      return locations;
    }
  } catch (e) {
    console.error('Failed to set locations in localStorage:', e);
  }
  return [];
}

export function saveStoredLocation(newLoc) {
  try {
    const current = getStoredLocations();
    // If location already exists with same locationId, replace it to avoid duplicate
    const existingIndex = current.findIndex(
      (l) => String(l.locationId) === String(newLoc.locationId)
    );
    let updated;
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = { ...current[existingIndex], ...newLoc };
    } else {
      updated = [newLoc, ...current];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to save location to localStorage:', e);
    return [];
  }
}

export function deleteStoredLocation(locationId) {
  try {
    const current = getStoredLocations();
    const updated = current.filter((l) => String(l.locationId) !== String(locationId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Failed to delete location from localStorage:', e);
    return [];
  }
}

export function clearStoredLocations() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch (e) {
    console.error('Failed to clear locations from localStorage:', e);
    return [];
  }
}
