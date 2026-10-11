import React from 'react';
import {
  MapPin,
  Crosshair,
  CheckCircle2,
  Box,
  Clapperboard,
  Sparkles,
  Navigation,
  Globe2
} from 'lucide-react';
import { DEFAULT_CITIES } from './CityViewport';

/**
 * LeftNavbar - Docked ultra-premium navigation bar & secondary flyout panels.
 * Features:
 * - Studio: Unified AI Scene Description + Custom Camera Path Directing + 60 FPS Filming.
 * - Location: Interactive 0.25-mile stage isolation, city switching, coordinates inspection.
 * - Models: Certified open-source 3D physics asset library.
 * Zero preview DOMs.
 */
export default function LeftNavbar({
  isSelectingLocation,
  onToggleSelectLocation,
  isLocationConfirmed,
  onConfirmLocation,
  sceneCenter,
  activeTab,
  setActiveTab,
  onRecenter,
  activeCityId,
  onSelectCity,
  cities = DEFAULT_CITIES,
  onChangeCameraAngle
}) {
  const isStudioActive = activeTab === 'studio' || activeTab === 'screenplay' || activeTab === 'director';
  const isLocationActive = activeTab === 'location';
  const isModelsActive = activeTab === 'models';

  return (
    <>
      <aside
        className="left-navbar-container"
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: '76px',
          background: 'rgba(8, 13, 24, 0.94)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          zIndex: 9999,
          boxShadow: '4px 0 32px rgba(0, 0, 0, 0.75)',
          userSelect: 'none'
        }}
      >
        {/* Brand Header (Non-clickable) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5px',
            marginBottom: '20px',
            cursor: 'default',
            userSelect: 'none'
          }}
          title="TwinCity"
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #10b981 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(6, 182, 212, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.25)'
            }}
          >
            <Sparkles size={22} color="#ffffff" strokeWidth={2.4} />
          </div>
          <span
            style={{
              fontSize: '0.56rem',
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: '#38bdf8',
              fontFamily: 'monospace'
            }}
          >
            TWINCITY
          </span>
        </div>

        <div
          style={{
            width: '46px',
            height: '1px',
            background: 'rgba(255, 255, 255, 0.08)',
            marginBottom: '14px'
          }}
        />

        {/* Navigation Buttons */}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            flex: 1
          }}
        >
          {/* OPTION 1: LOCATION (PRODUCTION 3D SETS & CITIES) */}
          <button
            id="nav-btn-select-location"
            onClick={() => setActiveTab(isLocationActive ? null : 'location')}
            title="Production Sets (Photorealistic 3D World Locations)"
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              border: isLocationActive
                ? '2px solid #10b981'
                : '1px solid rgba(255, 255, 255, 0.08)',
              background: isLocationActive
                ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.32) 0%, rgba(6, 182, 212, 0.38) 100%)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isLocationActive ? '#34d399' : '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              boxShadow: isLocationActive
                ? '0 0 20px rgba(16, 185, 129, 0.45), inset 0 0 10px rgba(16, 185, 129, 0.25)'
                : 'none'
            }}
          >
            {isSelectingLocation && (
              <span
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8'
                }}
              />
            )}
            <MapPin
              size={21}
              color={isLocationActive || isSelectingLocation ? '#34d399' : '#94a3b8'}
              strokeWidth={isLocationActive || isSelectingLocation ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1,
                color: isLocationActive || isSelectingLocation ? '#34d399' : '#94a3b8'
              }}
            >
              {isSelectingLocation ? 'PICKING' : 'Location'}
            </span>
          </button>

          {/* OPTION 2: STUDIO (UNIFIED AI SCENE + CAMERA PATH DIRECTING) */}
          <button
            id="nav-btn-studio"
            onClick={() => setActiveTab(isStudioActive ? null : 'studio')}
            title="Director Studio (Describe Scene with AI & Create Camera Path)"
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              border: isStudioActive
                ? '2px solid #38bdf8'
                : '1px solid rgba(255, 255, 255, 0.08)',
              background: isStudioActive
                ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.35) 0%, rgba(2, 132, 199, 0.45) 100%)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isStudioActive ? '#38bdf8' : '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              position: 'relative',
              boxShadow: isStudioActive
                ? '0 0 22px rgba(56, 189, 248, 0.5), inset 0 0 12px rgba(56, 189, 248, 0.3)'
                : 'none'
            }}
          >
            {isStudioActive && (
              <span
                style={{
                  position: 'absolute',
                  left: '-1px',
                  top: '18px',
                  bottom: '18px',
                  width: '3px',
                  borderRadius: '0 3px 3px 0',
                  background: '#38bdf8',
                  boxShadow: '0 0 8px #38bdf8'
                }}
              />
            )}
            <Clapperboard
              size={21}
              color={isStudioActive ? '#38bdf8' : '#94a3b8'}
              strokeWidth={isStudioActive ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1,
                color: isStudioActive ? '#38bdf8' : '#94a3b8'
              }}
            >
              Studio
            </span>
          </button>

          {/* OPTION 3: 3D MODELS CATALOG & PHYSICS */}
          <button
            id="nav-btn-models"
            onClick={() => setActiveTab(isModelsActive ? null : 'models')}
            title="3D Models Catalog & Calibrated Physics Bodies"
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '16px',
              border: isModelsActive
                ? '2px solid #a855f7'
                : '1px solid rgba(255, 255, 255, 0.08)',
              background: isModelsActive
                ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.32) 0%, rgba(99, 102, 241, 0.4) 100%)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isModelsActive ? '#c084fc' : '#cbd5e1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isModelsActive
                ? '0 0 20px rgba(168, 85, 247, 0.45), inset 0 0 10px rgba(168, 85, 247, 0.25)'
                : 'none'
            }}
          >
            <Box
              size={21}
              color={isModelsActive ? '#c084fc' : '#94a3b8'}
              strokeWidth={isModelsActive ? 2.5 : 2}
            />
            <span
              style={{
                fontSize: '0.58rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                lineHeight: 1,
                color: isModelsActive ? '#c084fc' : '#94a3b8'
              }}
            >
              Models
            </span>
          </button>
        </nav>
      </aside>

      {/* SECOND SIDEBAR: LOCATION DRAWER (HIGH-END CINEMATIC UI/UX) */}
      {isLocationActive && (
        <div
          id="location-drawer-panel"
          style={{
            position: 'fixed',
            left: '88px',
            top: '16px',
            bottom: '16px',
            width: '380px',
            background: 'rgba(8, 14, 28, 0.96)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '24px',
            padding: '20px',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 35px rgba(16, 185, 129, 0.15)',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            zIndex: 9998,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            overflowY: 'auto',
            userSelect: 'none'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)'
                }}
              >
                <MapPin size={19} color="#ffffff" strokeWidth={2.4} />
              </div>
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Production Sets
                </div>
                <div style={{ fontSize: '0.70rem', color: '#10b981', fontWeight: 600 }}>
                  Photorealistic 3D World Locations
                </div>
              </div>
            </div>

            <button
              onClick={() => setActiveTab(null)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '9px',
                color: '#94a3b8',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              ✕
            </button>
          </div>



          {/* Interactive Map Pinning Toggle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#cbd5e1' }}>
              Custom Map Location
            </span>
            <button
              onClick={onToggleSelectLocation}
              title={isSelectingLocation ? 'Cancel Map Click Mode' : 'Click anywhere on 3D map to choose coordinates'}
              style={{
                width: '100%',
                padding: '11px 14px',
                borderRadius: '12px',
                border: isSelectingLocation
                  ? '1.5px solid #38bdf8'
                  : '1px solid rgba(255, 255, 255, 0.12)',
                background: isSelectingLocation
                  ? 'rgba(56, 189, 248, 0.22)'
                  : 'rgba(255, 255, 255, 0.05)',
                color: isSelectingLocation ? '#38bdf8' : '#e2e8f0',
                fontSize: '0.78rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                boxShadow: isSelectingLocation ? '0 0 16px rgba(56, 189, 248, 0.35)' : 'none',
                transition: 'all 0.18s ease'
              }}
            >
              <Crosshair size={16} color={isSelectingLocation ? '#38bdf8' : '#94a3b8'} />
              <span>{isSelectingLocation ? '🎯 Click Anywhere on Map to Anchor' : '📍 Pin Custom Location on 3D Map'}</span>
            </button>
          </div>

          {/* Global City Environments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe2 size={15} color="#10b981" />
                World Film Sets
              </span>
              <span style={{ fontSize: '0.66rem', color: '#38bdf8', fontWeight: 700 }}>Click to Fly & Preview</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cities.map((city) => {
                const isSelected = activeCityId === city.id;
                return (
                  <button
                    key={city.id}
                    onClick={() => onSelectCity?.(city.id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: isSelected
                        ? '1.5px solid #10b981'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      background: isSelected
                        ? 'rgba(16, 185, 129, 0.18)'
                        : 'rgba(15, 23, 42, 0.65)',
                      color: isSelected ? '#34d399' : '#f1f5f9',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(16, 185, 129, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem' }}>{city.flag || '📍'}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#ffffff' }}>
                          {city.name}
                        </div>
                        <div style={{ fontSize: '0.70rem', color: '#94a3b8' }}>
                          {city.district || city.landmark}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#38bdf8',
                          fontWeight: 700,
                          background: 'rgba(56, 189, 248, 0.12)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          padding: '3px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        Fly To →
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirm Stage Button */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              id="btn-confirm-location"
              onClick={() => {
                if (onConfirmLocation) onConfirmLocation();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '14px',
                border: 'none',
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #10b981 100%)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '0.86rem',
                letterSpacing: '0.04em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(6, 182, 212, 0.45)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <CheckCircle2 size={18} color="#ffffff" />
              {isLocationConfirmed ? 'Stage Confirmed • Ready to Direct' : 'Set as Active Film Stage'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
