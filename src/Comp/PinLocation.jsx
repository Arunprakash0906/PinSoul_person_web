import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/AllPinSoulLocaiton.css';
import pinSoulLogo from '../assets/PinSoul_logo.png';
import { getStoredLocations, saveStoredLocation, getNextLocationId } from '../utils/locationStorage';
import {
  appendLocationToSheet,
  getGoogleToken,
  getSavedToken,
  clearToken,
  getNextSheetLocationId,
  SPREADSHEET_URL,
} from '../services/googleSheetsService';

// Fix default marker icons in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

import { categoryConfig, getCategoryIcon, fallbackCategory } from './catgory';
export { categoryConfig, getCategoryIcon };

// Marker icon for current target pin position
const currentPinIcon = L.divIcon({
  className: 'category-marker-wrapper',
  html: `<span class="category-marker" style="--marker-color: #ef4444; border-color: #ffffff; box-shadow: 0 4px 18px rgba(239, 68, 68, 0.6);"><span style="transform: rotate(45deg); display: inline-block; font-size: 18px;">📍</span></span>`,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -42],
});

// Component to handle map clicks for dropping new pins
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

// Component to pan/fly map to target coordinates
function MapFocus({ target }) {
  const map = useMap();

  useEffect(() => {
    if (target && target.latitude && target.longitude) {
      map.flyTo([target.latitude, target.longitude], 15, { duration: 1.2 });
    }
  }, [target, map]);

  return null;
}

export default function PinLocation() {
  const navigate = useNavigate();

  // Locations state
  const [locations, setLocations] = useState([]);
  const [selectedPin, setSelectedPin] = useState(null);
  const [focusTarget, setFocusTarget] = useState(null);
  const [isLocating, setIsLocating] = useState(true);

  // Form fields
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState(() => Object.keys(categoryConfig)[0] || 'Restaurant');
  const [notes, setNotes] = useState('');

  // Google Sheets state
  const [saveToGoogle, setSaveToGoogle] = useState(true);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '', link: '' });

  // On mount: load saved pins and DEFAULT TO USER'S CURRENT LOCATION
  useEffect(() => {
    const data = getStoredLocations();
    setLocations(data);
    setIsGoogleConnected(Boolean(getSavedToken()));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
          };
          setSelectedPin(coords);
          setFocusTarget(coords);
          setIsLocating(false);
        },
        (err) => {
          console.warn('Geolocation notice:', err.message);
          setIsLocating(false);
          if (data.length > 0) {
            setSelectedPin({ latitude: data[0].latitude, longitude: data[0].longitude });
          } else {
            setSelectedPin({ latitude: 20.0, longitude: 0.0 });
          }
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setIsLocating(false);
      if (data.length > 0) {
        setSelectedPin({ latitude: data[0].latitude, longitude: data[0].longitude });
      } else {
        setSelectedPin({ latitude: 20.0, longitude: 0.0 });
      }
    }
  }, []);

  // Connect Google account
  const handleConnectGoogle = async () => {
    try {
      setStatusMessage({ type: 'info', text: 'Authorizing Google Account...' });
      await getGoogleToken(true);
      setIsGoogleConnected(true);
      setStatusMessage({
        type: 'success',
        text: 'Google Account successfully connected to Google Sheets!',
      });
    } catch (err) {
      console.error(err);
      setStatusMessage({
        type: 'danger',
        text: 'Google authorization failed: ' + err.message,
      });
    }
  };

  // Disconnect Google
  const handleDisconnectGoogle = () => {
    clearToken();
    setIsGoogleConnected(false);
    setStatusMessage({
      type: 'info',
      text: 'Google Account disconnected.',
    });
  };

  // When user clicks on the map to change pin
  const handleMapClick = (latlng) => {
    setSelectedPin({
      latitude: Number(latlng.lat.toFixed(6)),
      longitude: Number(latlng.lng.toFixed(6)),
    });
    setStatusMessage({ type: '', text: '' });
  };

  // Re-center on user's current GPS location manually
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        };
        setSelectedPin(coords);
        setFocusTarget(coords);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not retrieve current location: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Save pinned location
  const handleSaveLocation = async (e) => {
    e.preventDefault();
    if (!selectedPin) {
      alert('Please select coordinates on the map.');
      return;
    }
    if (!address.trim()) {
      alert('Please enter an address or place name.');
      return;
    }

    let assignedId = getNextLocationId();
    if (saveToGoogle && isGoogleConnected) {
      try {
        const sheetId = await getNextSheetLocationId();
        if (sheetId && sheetId >= assignedId && sheetId < 1000000) {
          assignedId = sheetId;
        }
      } catch (err) {
        // Fall back to local sequential ID
      }
    }

    const newLocation = {
      locationId: String(assignedId),
      address: address.trim(),
      category: category,
      latitude: selectedPin.latitude,
      longitude: selectedPin.longitude,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    setIsSaving(true);
    setStatusMessage({ type: 'info', text: 'Saving location...' });

    // 1. Save locally
    const updated = saveStoredLocation(newLocation);
    setLocations(updated);
    setFocusTarget(newLocation);

    // 2. Save to Google Sheets if requested
    if (saveToGoogle) {
      try {
        setStatusMessage({ type: 'info', text: 'Appending to Google Sheet...' });
        await appendLocationToSheet(newLocation);
        setIsGoogleConnected(true);

        setStatusMessage({
          type: 'success',
          text: `Location "${newLocation.address}" successfully saved and appended to Google Sheet!`,
          link: SPREADSHEET_URL,
        });
      } catch (err) {
        console.error('Google Sheet save error:', err);
        setStatusMessage({
          type: 'warning',
          text: `Saved locally! Could not sync to Google Sheet: ${err.message}.`,
        });
      } finally {
        setIsSaving(false);
      }
    } else {
      setStatusMessage({
        type: 'success',
        text: `Location "${newLocation.address}" saved successfully!`,
      });
      setIsSaving(false);
    }

    setAddress('');
    setNotes('');
  };

  const centerCoords = selectedPin
    ? [selectedPin.latitude, selectedPin.longitude]
    : locations.length > 0
    ? [locations[0].latitude, locations[0].longitude]
    : [20.0, 0.0];

  return (
    <div
      className="min-vh-100 d-flex flex-column text-white"
      style={{
        backgroundColor: '#07080c',
        background: 'radial-gradient(ellipse at top, #141829 0%, #07080c 100%)',
      }}
    >
      {/* Top Header - High-end Responsive Navigation */}
      <header
        className="py-2 px-3 px-sm-4 sticky-top border-bottom"
        style={{
          backgroundColor: '#0b0f19',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
          {/* Left: Back Button & Logo Brand */}
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
              <span className="fw-bold fs-5 text-white tracking-tight d-none d-sm-inline">
                PinSoul
              </span>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {/* Google Status */}
            {isGoogleConnected ? (
              <div
                className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
                style={{
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  color: '#4ade80',
                }}
                title="Google Spreadsheet Connected"
              >
                <span className="status-dot-pulse"></span>
                <span className="small fw-semibold d-none d-md-inline">Sheet Active</span>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-outline-success btn-sm rounded-pill px-3 py-1 fw-semibold d-flex align-items-center gap-1"
                onClick={handleConnectGoogle}
              >
                <span>📊</span> <span className="d-none d-md-inline">Connect Google</span>
              </button>
            )}

            {/* Locate Me / Current GPS Button */}
            <button
              type="button"
              className="btn btn-outline-info btn-sm rounded-pill px-2 px-sm-3 py-1 fw-semibold d-flex align-items-center gap-1 gap-sm-2 shadow-sm"
              onClick={handleCurrentLocation}
              disabled={isLocating}
              style={{
                borderColor: 'rgba(56, 189, 248, 0.4)',
                backgroundColor: 'rgba(56, 189, 248, 0.08)',
              }}
              title="Locate Current GPS Position"
            >
              {isLocating ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  <span className="d-none d-sm-inline">Locating...</span>
                </>
              ) : (
                <>
                  <span>🎯</span> <span className="d-none d-sm-inline">My Location</span>
                </>
              )}
            </button>

            {/* View All Locations Button */}
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-pill px-2 px-sm-3 py-1 fw-bold shadow-sm d-flex align-items-center gap-1"
              onClick={() => navigate('/ViewAllLocation')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                border: 'none',
              }}
            >
              <span>🗺️</span> <span className="d-none d-sm-inline">View All </span><span>({locations.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area: Responsive Grid */}
      <div className="container-fluid flex-grow-1 p-2 p-md-3">
        <div className="row g-3">
          {/* Map Column */}
          <div className="col-12 col-lg-8">
            <div
              className="card border-0 shadow-lg rounded-4 overflow-hidden h-100"
              style={{
                backgroundColor: '#0f1422',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              {/* Card Sub-header */}
              <div
                className="card-header py-2 px-3 d-flex justify-content-between align-items-center flex-wrap gap-2"
                style={{
                  backgroundColor: '#131929',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                }}
              >
                <div className="d-flex align-items-center gap-2">
                  <span className="text-danger fs-6">📍</span>
                  <span className="small text-light fw-medium">
                    Tap anywhere on map to position pin
                  </span>
                </div>

                {selectedPin && (
                  <div
                    className="d-flex align-items-center gap-1 px-3 py-1 rounded-pill font-monospace small"
                    style={{
                      backgroundColor: '#162238',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      color: '#38bdf8',
                    }}
                  >
                    <span>🌐</span>
                    <span>{selectedPin.latitude}, {selectedPin.longitude}</span>
                  </div>
                )}
              </div>

              {/* Responsive Map Container */}
              <div className="responsive-map-wrapper">
                <MapContainer
                  center={centerCoords}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapClickHandler onMapClick={handleMapClick} />
                  <MapFocus target={focusTarget} />

                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    maxZoom={19}
                  />

                  {/* Selected / Current Pin Marker */}
                  {selectedPin && (
                    <Marker
                      position={[selectedPin.latitude, selectedPin.longitude]}
                      icon={currentPinIcon}
                    >
                      <Popup className="custom-location-popup">
                        <div className="p-1 text-center">
                          <span className="badge bg-danger mb-1">Target Pin</span>
                          <div><strong className="text-white">Selected Location</strong></div>
                          <div className="small text-secondary font-monospace">
                            {selectedPin.latitude}, {selectedPin.longitude}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}

                  {/* Existing Pinned Locations */}
                  {locations.map((loc) => {
                    const cat = categoryConfig[loc.category] || fallbackCategory;
                    const markerColor = cat.accent;
                    return (
                      <Marker
                        key={loc.locationId}
                        position={[loc.latitude, loc.longitude]}
                        icon={getCategoryIcon(loc.category)}
                      >
                        <Popup className="custom-location-popup">
                          <div
                            className="popup-content"
                            style={{ '--marker-color': markerColor }}
                          >
                            <div className="d-flex align-items-center justify-content-between mb-1 gap-2">
                              {loc.category && (
                                <span
                                  className="popup-category-badge"
                                  style={{
                                    background: `${markerColor}22`,
                                    color: markerColor,
                                    border: `1px solid ${markerColor}55`,
                                  }}
                                >
                                  {loc.category.replaceAll('_', ' ')}
                                </span>
                              )}
                            </div>
                            <p className="popup-address mb-1">
                              <strong>{loc.address}</strong>
                            </p>
                            {loc.notes && (
                              <p className="small text-secondary mb-1">{loc.notes}</p>
                            )}
                            <p className="popup-date">
                              {new Date(loc.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </div>
          </div>

          {/* Pin Form Column */}
          <div className="col-12 col-lg-4">
            <div
              className="card border-0 shadow-lg rounded-4"
              style={{
                backgroundColor: '#0f1422',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div className="card-body p-3 p-md-4 d-flex flex-column text-white">
                <div className="mb-3">
                  <h2 className="h5 fw-bold text-white mb-1">Save Location</h2>
                  <p className="text-secondary small mb-0">
                    Add details for this pinned place and save:
                  </p>
                </div>

                {statusMessage.text && (
                  <div
                    className={`alert alert-${statusMessage.type} alert-dismissible fade show py-2 px-3 small`}
                    role="alert"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#ffffff' }}
                  >
                    <div>{statusMessage.text}</div>
                    {statusMessage.link && (
                      <div className="mt-1">
                        <a
                          href={statusMessage.link}
                          target="_blank"
                          rel="noreferrer"
                          className="fw-bold text-info text-decoration-underline"
                        >
                          View in Google Sheet ↗
                        </a>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-close btn-close-white btn-sm p-2"
                      onClick={() => setStatusMessage({ type: '', text: '' })}
                    ></button>
                  </div>
                )}

                <form onSubmit={handleSaveLocation} className="d-flex flex-column gap-3">
                  {/* Coordinates Info */}
                  <div
                    className="p-3 rounded-3"
                    style={{
                      backgroundColor: '#141a2a',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <label className="form-label small fw-bold text-secondary mb-1">
                      Coordinates (Lat, Lng)
                    </label>
                    {selectedPin ? (
                      <div className="font-monospace text-info fw-bold">
                        {selectedPin.latitude}, {selectedPin.longitude}
                      </div>
                    ) : (
                      <div className="text-secondary small fst-italic">
                        👉 Tap anywhere on the map to select coordinates
                      </div>
                    )}
                  </div>

                  {/* Address / Title */}
                  <div>
                    <label htmlFor="pin-address" className="form-label small fw-bold text-white">
                      Address or Place Name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="pin-address"
                      type="text"
                      className="form-control dark-form-control"
                      placeholder="e.g. Cozy Corner Cafe, Paris"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      required
                    />
                  </div>

                  {/* Category Picker */}
                  <div>
                    <label htmlFor="pin-category" className="form-label small fw-bold text-white">
                      Category
                    </label>
                    <select
                      id="pin-category"
                      className="form-select dark-form-control"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      {Object.keys(categoryConfig).map((key) => {
                        const item = categoryConfig[key];
                        return (
                          <option key={key} value={key}>
                            {item.icon} {key.replaceAll('_', ' ')}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="pin-notes" className="form-label small fw-bold text-white">
                      Notes / Description (Optional)
                    </label>
                    <textarea
                      id="pin-notes"
                      className="form-control dark-form-control"
                      rows={2}
                      placeholder="e.g. Outdoor seating, scenic view"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    ></textarea>
                  </div>

                  {/* Google Sheet Sync Option */}
                  <div
                    className="form-check form-switch p-3 rounded-3 d-flex align-items-center justify-content-between"
                    style={{
                      backgroundColor: '#141a2a',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div className="me-2">
                      <label className="form-check-label fw-bold text-white small" htmlFor="googleSyncSwitch">
                        📊 Save to Google Sheet
                      </label>
                      <div className="text-secondary" style={{ fontSize: '11px' }}>
                        Appends directly to your Google Spreadsheet
                      </div>
                    </div>
                    <input
                      className="form-check-input ms-0"
                      type="checkbox"
                      role="switch"
                      id="googleSyncSwitch"
                      checked={saveToGoogle}
                      onChange={(e) => setSaveToGoogle(e.target.checked)}
                      style={{ transform: 'scale(1.2)' }}
                    />
                  </div>

                  {/* Save Button */}
                  <div className="pt-2 d-flex flex-column gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary fw-bold py-2 d-flex align-items-center justify-content-center gap-2 shadow"
                      disabled={!selectedPin || isSaving}
                      style={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        border: 'none',
                      }}
                    >
                      {isSaving ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                          <span>Saving Location...</span>
                        </>
                      ) : (
                        <>
                          <span>📌</span> Save Location
                        </>
                      )}
                    </button>
                    {!selectedPin && (
                      <small className="text-secondary text-center">
                        Tap on the map above to select coordinates.
                      </small>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
