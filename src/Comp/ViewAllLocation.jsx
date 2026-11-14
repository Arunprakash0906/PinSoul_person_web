import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/AllPinSoulLocaiton.css';
import pinSoulLogo from '../assets/PinSoul_logo.png';
import { getStoredLocations, deleteStoredLocation } from '../utils/locationStorage';
import {
  fetchLocationsFromSheet,
  getSavedToken,
  getGoogleToken,
  SPREADSHEET_URL,
} from '../services/googleSheetsService';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import { categoryConfig, getCategoryIcon } from './catgory';

function getLocationShareLink(location) {
  const coordinates = `${location.latitude},${location.longitude}`;
  const params = new URLSearchParams({
    api: '1',
    query: coordinates,
    name: location.address,
    latitude: String(location.latitude),
    longitude: String(location.longitude),
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

function MapFocus({ location }) {
  const map = useMap();

  useEffect(() => {
    if (location && location.latitude && location.longitude) {
      map.flyTo([location.latitude, location.longitude], 15, { duration: 1.2 });
    }
  }, [location, map]);

  return null;
}

export default function ViewAllLocation() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [allLocations, setAllLocations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get('category') || '');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [sharingLocationId, setSharingLocationId] = useState(null);
  const [shareStatus, setShareStatus] = useState('');
  const [userLocation, setUserLocation] = useState(null);

  // Google Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState({ type: '', text: '' });
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  // Load locations from local storage and detect user location on mount
  useEffect(() => {
    const data = getStoredLocations();
    setAllLocations(data);
    setIsGoogleConnected(Boolean(getSavedToken()));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation([Number(pos.coords.latitude.toFixed(6)), Number(pos.coords.longitude.toFixed(6))]);
        },
        () => {},
        { timeout: 8000 }
      );
    }
  }, []);

  // Fetch / Sync from Google Sheet
  const handleSyncFromGoogleSheet = async () => {
    setIsSyncing(true);
    setSyncNotice({ type: 'info', text: 'Fetching rows from Google Sheet...' });

    try {
      await getGoogleToken(false);
      setIsGoogleConnected(true);

      const sheetLocations = await fetchLocationsFromSheet();

      if (sheetLocations.length === 0) {
        setSyncNotice({
          type: 'warning',
          text: 'Google Sheet is currently empty. Pins you add will appear here.',
        });
      } else {
        setAllLocations(sheetLocations);
        setSyncNotice({
          type: 'success',
          text: `Successfully synced ${sheetLocations.length} location(s) from your Google Sheet!`,
        });
      }
    } catch (err) {
      console.error(err);
      setSyncNotice({
        type: 'danger',
        text: 'Google Sheet sync failed: ' + err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const sharingLocation = allLocations.find((loc) => loc.locationId === sharingLocationId);

  useEffect(() => {
    if (!sharingLocation) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSharingLocationId(null);
        setShareStatus('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sharingLocation]);

  const categories = Object.keys(categoryConfig);

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setSelectedCategory(cat);
    setSelectedLocation(null);
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  };

  const handleLocationClick = (location) => {
    setSelectedLocation(selectedLocation?.locationId === location.locationId ? null : location);
  };

  const handleCopyLocationLink = async (location, event) => {
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(getLocationShareLink(location));
      setShareStatus('Link copied to clipboard!');
    } catch {
      setShareStatus('Copy unavailable. Please manually select the link.');
    }
  };

  const handleDeleteLocation = (locationId) => {
    if (!window.confirm('Are you sure you want to delete this location?')) {
      return;
    }

    const updated = deleteStoredLocation(locationId);
    setAllLocations(updated);
    if (selectedLocation?.locationId === locationId) {
      setSelectedLocation(null);
    }
  };

  // Filter locations by selected category
  const filteredLocations = selectedCategory
    ? allLocations.filter((l) => l.category === selectedCategory)
    : allLocations;

  // Calculate map center: selectedLocation -> first location -> current user location -> fallback
  const getMapCenter = () => {
    if (selectedLocation) return [selectedLocation.latitude, selectedLocation.longitude];
    if (filteredLocations.length > 0) {
      return [filteredLocations[0].latitude, filteredLocations[0].longitude];
    }
    if (userLocation) return userLocation;
    return [20.0, 0.0];
  };

  return (
    <div
      className="min-vh-100 d-flex flex-column text-white"
      style={{
        backgroundColor: '#07080c',
        background: 'radial-gradient(ellipse at top, #141829 0%, #07080c 100%)',
      }}
    >
      {/* Header Bar - Black Theme */}
      <header
        className="py-2 px-3 px-sm-4 sticky-top border-bottom"
        style={{
          backgroundColor: '#0b0f19',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
          {/* Brand & Back Button */}
          <div className="d-flex align-items-center gap-2 gap-sm-3">
            <button
              type="button"
              className="btn btn-outline-light btn-sm rounded-pill px-3 py-1 fw-semibold d-flex align-items-center gap-1 shadow-sm"
              onClick={() => navigate('/')}
              style={{
                borderColor: 'rgba(255, 255, 255, 0.2)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(6px)',
              }}
            >
              <span>←</span> <span>Back</span>
            </button>

            <div
              className="d-flex align-items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
              style={{ cursor: 'pointer' }}
            >
              <div className="pinsoul-logo-container">
                <img src={pinSoulLogo} alt="PinSoul Logo" />
              </div>
              <h1 className="h6 fw-bold text-white m-0 d-none d-sm-inline">
                All Locations
              </h1>
            </div>

            <span className="badge bg-primary rounded-pill px-2 py-1 small fw-bold">
              {filteredLocations.length}
            </span>
          </div>

          {/* Action buttons */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-success btn-sm rounded-pill px-3 py-1 fw-semibold d-flex align-items-center gap-1 shadow-sm"
              onClick={handleSyncFromGoogleSheet}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span className="d-none d-sm-inline">Syncing...</span>
                </>
              ) : (
                <>
                  <span>🔄</span> <span className="d-none d-sm-inline">Sync</span> Google Sheet
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-pill px-3 py-1 fw-semibold shadow-sm d-flex align-items-center gap-1"
              onClick={() => navigate('/pinLocation')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
              }}
            >
              <span>+</span> <span>Pin Soul</span>
            </button>
          </div>
        </div>
      </header>

      {/* Filter and Content */}
      <div className="container-fluid flex-grow-1 p-2 p-md-3 d-flex flex-column gap-3">
        {syncNotice.text && (
          <div
            className={`alert alert-${syncNotice.type} alert-dismissible fade show py-2 px-3 small`}
            role="alert"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff' }}
          >
            {syncNotice.text}
            <button
              type="button"
              className="btn-close btn-close-white btn-sm p-2"
              onClick={() => setSyncNotice({ type: '', text: '' })}
            ></button>
          </div>
        )}

        {/* Category Filter */}
        <div
          className="card border-0 shadow-sm p-2 p-md-3 rounded-3"
          style={{
            backgroundColor: '#0f1422',
            border: '1px solid rgba(255, 255, 255, 0.08) !important',
          }}
        >
          <div className="row align-items-center g-2 g-md-3">
            <div className="col-12 col-sm-auto">
              <label htmlFor="location-category-filter" className="form-label fw-bold text-white m-0 small">
                Filter by Category:
              </label>
            </div>
            <div className="col-12 col-sm-6 col-md-4">
              <select
                id="location-category-filter"
                className="form-select form-select-sm dark-form-control"
                value={selectedCategory}
                onChange={handleCategoryChange}
              >
                <option value="">All Categories ({allLocations.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {categoryConfig[cat]?.icon || '📍'} {cat.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            {selectedCategory && (
              <div className="col-auto">
                <button
                  type="button"
                  className="btn btn-link btn-sm text-decoration-none p-0 text-info"
                  onClick={() => {
                    setSelectedCategory('');
                    setSearchParams({});
                  }}
                >
                  Clear filter ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Map and Location List Grid */}
        <div className="row g-3 flex-grow-1">
          {/* Interactive Map */}
          <div className="col-12 col-lg-7">
            <div
              className="card border-0 shadow-lg rounded-4 overflow-hidden h-100"
              style={{
                backgroundColor: '#0f1422',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                className="card-header py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
                style={{
                  backgroundColor: '#131929',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                }}
              >
                <span className="small text-light fw-semibold">
                  Click any marker or card to center map.
                </span>
                {selectedLocation && (
                  <span className="badge bg-info-subtle text-info border border-info-subtle text-truncate" style={{ maxWidth: '240px' }}>
                    {selectedLocation.address}
                  </span>
                )}
              </div>

              {/* Responsive Map Container */}
              <div className="responsive-map-wrapper">
                {filteredLocations.length === 0 ? (
                  <div className="h-100 d-flex flex-column align-items-center justify-content-center text-muted p-4">
                    <p className="fs-6 mb-2 text-secondary">No locations found in this category.</p>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => navigate('/pinLocation')}
                    >
                      Pin a location now
                    </button>
                  </div>
                ) : (
                  <MapContainer
                    center={getMapCenter()}
                    zoom={filteredLocations.length === 1 ? 14 : 4}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <MapFocus location={selectedLocation} />
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      maxZoom={19}
                    />

                    {filteredLocations.map((location) => {
                      const category = categoryConfig[location.category] || fallbackCategory;
                      const markerColor = category.accent;
                      return (
                        <Marker
                          key={location.locationId}
                          position={[location.latitude, location.longitude]}
                          icon={getCategoryIcon(location.category)}
                          eventHandlers={{
                            click: () => handleLocationClick(location),
                          }}
                        >
                          <Popup className="custom-location-popup">
                            <div
                              className="popup-content"
                              style={{ '--marker-color': markerColor }}
                            >
                              <div className="d-flex align-items-center justify-content-between mb-1 gap-2">
                                {location.category && (
                                  <span
                                    className="popup-category-badge"
                                    style={{
                                      background: `${markerColor}22`,
                                      color: markerColor,
                                      border: `1px solid ${markerColor}55`,
                                    }}
                                  >
                                    {location.category.replaceAll('_', ' ')}
                                  </span>
                                )}
                              </div>
                              <p className="popup-address mb-1">
                                <strong>{location.address}</strong>
                              </p>
                              {location.notes && (
                                <p className="small text-secondary mb-1">{location.notes}</p>
                              )}
                              <p className="popup-date">
                                {new Date(location.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                )}
              </div>
            </div>
          </div>

          {/* Locations List */}
          <div className="col-12 col-lg-5" style={{ maxHeight: '660px', display: 'flex', flexDirection: 'column' }}>
            <div
              className="card border-0 shadow-lg rounded-4 flex-grow-1 overflow-hidden d-flex flex-column"
              style={{
                backgroundColor: '#0f1422',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div
                className="card-header py-2 px-3 d-flex justify-content-between align-items-center"
                style={{
                  backgroundColor: '#131929',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h2 className="h6 fw-bold text-white m-0">Pinned Places</h2>
                <small className="text-secondary">{filteredLocations.length} items</small>
              </div>

              <div className="card-body p-2 p-sm-3 overflow-auto flex-grow-1 d-flex flex-column gap-2" style={{ maxHeight: '580px' }}>
                {filteredLocations.length === 0 ? (
                  <div className="text-center text-secondary my-auto py-4">
                    <p className="mb-2">No locations match your filter.</p>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => setSelectedCategory('')}
                    >
                      Show All Categories
                    </button>
                  </div>
                ) : (
                  filteredLocations.map((loc) => {
                    const cat = categoryConfig[loc.category] || fallbackCategory;
                    const isSelected = selectedLocation?.locationId === loc.locationId;

                    return (
                      <div
                        key={loc.locationId}
                        className={`location-item ${isSelected ? 'active' : ''}`}
                        onClick={() => handleLocationClick(loc)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleLocationClick(loc);
                          }
                        }}
                      >
                        <div className="d-flex align-items-start justify-content-between gap-2">
                          <div className="d-flex align-items-center gap-1 flex-grow-1 text-truncate">
                            {isSelected && (
                              <span className="sky-blue-pulse-dot" title="Selected Location"></span>
                            )}
                            <h3 className="h6 fw-bold text-white mb-0 text-truncate">{loc.address}</h3>
                          </div>

                          {loc.category && (
                            <span
                              className="category-pill flex-shrink-0"
                              style={{ '--category-accent': cat.accent }}
                            >
                              <span>{cat.icon}</span>
                              <span className="d-none d-sm-inline">{loc.category.replaceAll('_', ' ')}</span>
                            </span>
                          )}
                        </div>

                        {loc.notes && (
                          <p className="small text-secondary mb-0">{loc.notes}</p>
                        )}

                        <div
                          className="d-flex align-items-center justify-content-between pt-2 gap-2 flex-wrap"
                          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}
                        >
                          <small className="text-secondary">
                            📅 {new Date(loc.createdAt).toLocaleDateString()}
                          </small>

                          <div className="location-item-actions ms-auto">
                            <button
                              type="button"
                              className="share-location-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSharingLocationId(loc.locationId);
                                setShareStatus('');
                              }}
                            >
                              Share
                            </button>
                            <button
                              type="button"
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLocation(loc.locationId);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal Dialog - Black Theme */}
      {sharingLocation && (
        <div
          className="location-share-backdrop"
          onClick={() => {
            setSharingLocationId(null);
            setShareStatus('');
          }}
        >
          <section
            className="location-share-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="location-share-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="location-share-heading">
              <div>
                <span className="location-share-eyebrow">PIN SOUL · LOCATION</span>
                <h2 id="location-share-title">Share this place</h2>
                <p className="location-share-address">{sharingLocation.address}</p>
              </div>
              <button
                type="button"
                className="close-location-share"
                aria-label="Close share dialog"
                onClick={() => {
                  setSharingLocationId(null);
                  setShareStatus('');
                }}
              >
                ×
              </button>
            </div>

            <div className="location-share-content">
              <label htmlFor="share-location-link" className="form-label small fw-bold text-white mb-1">
                Google Maps Link
              </label>
              <div className="location-share-controls">
                <input
                  id="share-location-link"
                  type="url"
                  value={getLocationShareLink(sharingLocation)}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className="copy-location-link"
                  onClick={(e) => handleCopyLocationLink(sharingLocation, e)}
                >
                  Copy Link
                </button>
              </div>

              {shareStatus && (
                <p className="location-share-status small" role="status">
                  {shareStatus}
                </p>
              )}

              <div className="mt-2">
                <a
                  className="open-location-map"
                  href={getLocationShareLink(sharingLocation)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in Google Maps ↗
                </a>
              </div>
            </div>

            <div className="location-share-dialog-actions">
              <button
                type="button"
                className="cancel-location-share"
                onClick={() => {
                  setSharingLocationId(null);
                  setShareStatus('');
                }}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
