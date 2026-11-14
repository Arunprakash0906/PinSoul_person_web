import { useNavigate } from 'react-router-dom';
import pinSoulLogo from '../assets/PinSoul_logo.png';
import heroMapPreview from '../assets/hero_map_preview.png';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div
      className="min-vh-100 d-flex flex-column justify-content-between p-3 p-md-4"
      style={{
        backgroundColor: '#07080c',
        color: '#ffffff',
        background: 'radial-gradient(ellipse at top, #141829 0%, #07080c 100%)',
      }}
    >
      {/* Top Logo Header */}
      <header className="d-flex justify-content-center align-items-center py-2">
        <div className="d-flex align-items-center gap-2">
          <img
            src={pinSoulLogo}
            alt="PinSoul Logo"
            style={{ height: '44px', width: 'auto', objectFit: 'contain' }}
          />
          <span className="fw-bold fs-3 text-white tracking-tight">PinSoul</span>
        </div>
      </header>

      {/* Main Center Content: Image + ONLY The 2 Action Buttons */}
      <main className="container my-auto py-3 py-md-4 text-center">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            {/* Hero Map Preview Image - Perfectly sized for laptop and mobile */}
            <div
              className="position-relative mx-auto mb-4 mb-md-5"
              style={{
                maxWidth: '640px',
                width: '100%',
              }}
            >
              <div
                className="position-absolute rounded-4"
                style={{
                  inset: '-6px',
                  background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, rgba(147, 51, 234, 0.2) 60%, transparent 80%)',
                  filter: 'blur(20px)',
                  zIndex: 0,
                }}
              ></div>
              <img
                src={heroMapPreview}
                alt="PinSoul Map Preview"
                className="img-fluid rounded-4 shadow-lg position-relative d-block mx-auto"
                style={{
                  width: '100%',
                  maxHeight: '420px',
                  objectFit: 'contain',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  backgroundColor: '#0b0f19',
                  zIndex: 1,
                }}
              />
            </div>

            {/* ONLY 2 Buttons: Pin Location & View All Locations */}
            <div
              className="d-flex flex-column flex-sm-row justify-content-center align-items-center gap-3 mx-auto"
              style={{ maxWidth: '540px' }}
            >
              <button
                type="button"
                className="btn btn-primary btn-lg w-100 py-3 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2 rounded-pill"
                onClick={() => navigate('/pinLocation')}
                style={{
                  fontSize: '1.1rem',
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                }}
              >
                <span>📍</span> Pin Location
              </button>

              <button
                type="button"
                className="btn btn-outline-light btn-lg w-100 py-3 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2 rounded-pill"
                onClick={() => navigate('/ViewAllLocation')}
                style={{
                  fontSize: '1.1rem',
                  letterSpacing: '0.02em',
                  borderColor: 'rgba(255, 255, 255, 0.35)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <span>🗺️</span> View All Locations
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="text-center py-2 text-white-50 small">
        © {new Date().getFullYear()} PinSoul
      </footer>
    </div>
  );
}
