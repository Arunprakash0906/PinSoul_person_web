import L from 'leaflet';

export const categoryConfig = {
  Restaurant: { icon: '🍽️', accent: '#ff8a5c' },
  'Street Food': { icon: '🌮', accent: '#ffb03b' },
  'Tea spot': { icon: '☕', accent: '#d4a574' },
  Biriyani: { icon: '🍛', accent: '#5fd08a' },
  Food: { icon: '🍔', accent: '#b794f6' },
  'Shopping center': { icon: '🛒', accent: '#ff6b9d' },
  Hotel: { icon: '🏨', accent: '#5bb8ff' },
  Gym: { icon: '🏋️', accent: '#ff5d5d' },
  Theater: { icon: '🎭', accent: '#e86bd6' },
  Viewpoint: { icon: '🌄', accent: '#4fd8d0' },
  Tripplace: { icon: '🧭', accent: '#7fd36b' },
  'Bike service': { icon: '🏍️', accent: '#f0a040' },
  Other: { icon: '📍', accent: '#a8abb2' },
};

export const fallbackCategory = categoryConfig.Other || { icon: '📍', accent: '#a8abb2' };

export function getCategoryIcon(category) {
  const normalized = String(category || '').trim().toLowerCase().replace(/_/g, ' ');
  const matchedKey =
    categoryConfig[category]
      ? category
      : Object.keys(categoryConfig).find((key) => key.toLowerCase() === normalized);

  const config = (matchedKey ? categoryConfig[matchedKey] : null) || fallbackCategory;
  const accent = config?.accent || '#a8abb2';
  const icon = config?.icon || '📍';

  return L.divIcon({
    className: 'category-marker-wrapper',
    html: `<span class="category-marker" style="--marker-color: ${accent}">${icon}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 42],
    popupAnchor: [0, -42],
  });
}

export default categoryConfig;
