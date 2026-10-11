import React from 'react';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Pencil,
  Trash2,
  CheckCircle2,
  X,
  Compass,
  Sliders,
  ChevronRight
} from 'lucide-react';

const TRACKING_MODES = [
  { id: 'rail_tangent', label: '🧭 Forward Rail Look', desc: 'Camera looks straight down the flight path velocity' },
  { id: 'track_impact', label: '🎯 Lock on Target Center', desc: 'Camera lens always centers on designated target' },
  { id: 'track_lead', label: '🏎️ Chase Primary Actor', desc: 'Tracks the primary moving actor along its path' },
  { id: 'track_target', label: '📍 Secondary Actor Focus', desc: 'Tracks the secondary actor or destination' }
];

const ALTITUDE_PRESETS = [
  { id: 'curb', label: 'Curb Cam', alt: 4.0 },
  { id: 'street', label: 'Street', alt: 14.0 },
  { id: 'drone', label: 'Drone Crane', alt: 28.0 },
  { id: 'sky', label: 'Satellite High', alt: 65.0 }
];

export default function CameraRailDirector({
  // Camera Rail Directing
  isDrawCameraRailMode,
  onToggleDrawCameraRailMode,
  cameraRailWaypoints = [],
  onRemoveCameraRailWaypoint,
  onClearCameraRailWaypoints,
  onCompileCameraRail,
  cameraTrackingMode,
  onChangeCameraTrackingMode,
  cameraRailAltitudeOffset,
  onChangeCameraRailAltitudeOffset,
  // Playback & Recording
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime = 0,
  playbackSpeed = 1.0,
  onChangePlaybackSpeed,
  cameraMode,
  onChangeCameraMode,
  isRecordingVideo,
  onStartRecording,
  onStopRecording,
  onClose,
  activeScene
}) {
  const duration = activeScene?.total_duration_sec || activeScene?.duration || 6.0;
  const hasRailWaypoints = cameraRailWaypoints.length > 0;

  return (
    <div
      id="camera-rail-director-panel"
      style={{
        position: 'fixed',
        left: '86px',
        top: '16px',
        bottom: '16px',
        width: '410px',
        maxHeight: 'calc(100vh - 32px)',
        background: 'rgba(8, 14, 28, 0.96)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(56, 189, 248, 0.22)',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.85), 0 0 32px rgba(6, 182, 212, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 18px rgba(6, 182, 212, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.2)'
            }}
          >
            <Video size={20} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: '0.94rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Camera Rail Director
            </div>
            <div style={{ fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
              Draw 3D Flight Lines & Direct Camera
            </div>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            title="Close Panel"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 2. Main Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Draw Camera Rail Toggle */}
        <div>
          <button
            id="btn-toggle-camera-rail-mode"
            onClick={onToggleDrawCameraRailMode}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: '12px',
              border: isDrawCameraRailMode
                ? '2px solid #38bdf8'
                : '1px solid rgba(56, 189, 248, 0.35)',
              background: isDrawCameraRailMode
                ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.35) 0%, rgba(6, 182, 212, 0.4) 100%)'
                : 'rgba(255, 255, 255, 0.04)',
              color: isDrawCameraRailMode ? '#e0f2fe' : '#94a3b8',
              fontWeight: 800,
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: isDrawCameraRailMode ? '0 0 22px rgba(56, 189, 248, 0.45)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Pencil size={18} color={isDrawCameraRailMode ? '#38bdf8' : '#94a3b8'} strokeWidth={2.5} />
            <span>
              {isDrawCameraRailMode ? '✏️ Drawing Active — Click 3D Map' : '✏️ Draw Camera Line on Map'}
            </span>
          </button>

          <div style={{ fontSize: '0.68rem', color: isDrawCameraRailMode ? '#38bdf8' : '#94a3b8', marginTop: '6px', textAlign: 'center', lineHeight: 1.3 }}>
            {isDrawCameraRailMode
              ? 'Click anywhere on the satellite map to add camera waypoints.'
              : 'Click above to begin drawing camera flight waypoints on the satellite map.'}
          </div>
        </div>

        {/* Camera Lens Tracking Focus */}
        <div>
          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', display: 'block', marginBottom: '8px' }}>
            Camera Lens Tracking Focus
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '6px' }}>
            {TRACKING_MODES.map((tm) => (
              <button
                key={tm.id}
                onClick={() => onChangeCameraTrackingMode && onChangeCameraTrackingMode(tm.id)}
                style={{
                  padding: '9px 12px',
                  borderRadius: '10px',
                  background: cameraTrackingMode === tm.id ? 'rgba(56, 189, 248, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                  border: cameraTrackingMode === tm.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: cameraTrackingMode === tm.id ? '#38bdf8' : '#cbd5e1',
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.15s ease'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700 }}>{tm.label}</div>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>{tm.desc}</div>
                </div>
                {cameraTrackingMode === tm.id && <CheckCircle2 size={16} color="#38bdf8" />}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Rail Altitude Preset & Slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1' }}>
              Camera Flight Height
            </label>
            <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 800 }}>
              +{cameraRailAltitudeOffset}m
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginBottom: '8px' }}>
            {ALTITUDE_PRESETS.map((ap) => (
              <button
                key={ap.id}
                onClick={() => onChangeCameraRailAltitudeOffset && onChangeCameraRailAltitudeOffset(ap.alt)}
                style={{
                  padding: '7px 4px',
                  borderRadius: '8px',
                  background: cameraRailAltitudeOffset === ap.alt ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                  border: cameraRailAltitudeOffset === ap.alt ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: cameraRailAltitudeOffset === ap.alt ? '#e0f2fe' : '#94a3b8',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                {ap.label}
              </button>
            ))}
          </div>

          {/* Altitude Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.64rem', color: '#64748b' }}>4m</span>
            <input
              type="range"
              min="4"
              max="120"
              step="2"
              value={cameraRailAltitudeOffset || 18}
              onChange={(e) => onChangeCameraRailAltitudeOffset && onChangeCameraRailAltitudeOffset(Number(e.target.value))}
              style={{
                flex: 1,
                accentColor: '#38bdf8',
                cursor: 'pointer'
              }}
            />
            <span style={{ fontSize: '0.64rem', color: '#64748b' }}>120m</span>
          </div>
        </div>

        {/* Drawn Waypoints List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1' }}>
              Drawn Camera Rail ({cameraRailWaypoints.length} Points)
            </span>
            {hasRailWaypoints && (
              <button
                onClick={onClearCameraRailWaypoints}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px'
                }}
              >
                <Trash2 size={12} /> Clear All
              </button>
            )}
          </div>

          {hasRailWaypoints ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {cameraRailWaypoints.map((wp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '7px 10px',
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                        🎥 Waypoint {idx + 1}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.64rem' }}>
                        ({wp.lat?.toFixed(4)}, {wp.lng?.toFixed(4)})
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                        Alt: {wp.altitude}m
                      </span>
                      <button
                        onClick={() => onRemoveCameraRailWaypoint && onRemoveCameraRailWaypoint(idx)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          padding: '2px'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Compile Camera Flight Rail */}
              <button
                id="btn-compile-camera-rail"
                onClick={onCompileCameraRail}
                disabled={cameraRailWaypoints.length < 2}
                style={{
                  width: '100%',
                  marginTop: '10px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  background: cameraRailWaypoints.length >= 2
                    ? 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  color: cameraRailWaypoints.length >= 2 ? '#ffffff' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.84rem',
                  cursor: cameraRailWaypoints.length >= 2 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: cameraRailWaypoints.length >= 2 ? '0 4px 16px rgba(6, 182, 212, 0.4)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Sparkles size={16} />
                <span>
                  {cameraRailWaypoints.length >= 2
                    ? `Compile Camera Rail (${cameraRailWaypoints.length} Points)`
                    : 'Add 2+ Points to Compile Flight Rail'}
                </span>
              </button>
            </>
          ) : (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.72rem',
                lineHeight: 1.5
              }}
            >
              No camera points added yet. Turn on <strong style={{ color: '#38bdf8' }}>Draw Camera Line</strong> and click points on the satellite map to create your flight rail.
            </div>
          )}
        </div>
      </div>

      {/* 3. Bottom Playback & Recording Controls */}
      <div
        style={{
          padding: '14px 18px',
          background: 'rgba(15, 23, 42, 0.95)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {/* Timeline Scrubber */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8', marginBottom: '4px' }}>
            <span>Time: {currentTime.toFixed(2)}s / {duration.toFixed(1)}s</span>
            {hasRailWaypoints && (
              <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                {cameraRailWaypoints.length} Rail Points
              </span>
            )}
          </div>
          <div
            style={{
              position: 'relative',
              height: '6px',
              background: 'rgba(255, 255, 255, 0.12)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.min(100, (currentTime / Math.max(0.1, duration)) * 100)}%`,
                background: 'linear-gradient(90deg, #0284c7, #38bdf8)'
              }}
            />
          </div>
        </div>

        {/* Playback Buttons & Camera Mode Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={onTogglePlay}
              title={isPlaying ? 'Pause' : 'Play'}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: isPlaying ? '#ef4444' : '#10b981',
                border: 'none',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>

            <button
              onClick={onResetPlayback}
              title="Reset Timeline"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Camera View Mode */}
          <select
            value={cameraMode}
            onChange={(e) => onChangeCameraMode && onChangeCameraMode(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.74rem',
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="user_camera_rail" style={{ background: '#0f172a' }}>🎬 User Drawn Rail</option>
            <option value="auto_director" style={{ background: '#0f172a' }}>🎥 Auto Hollywood Director</option>
            <option value="drone_wide" style={{ background: '#0f172a' }}>🚁 Drone Satellite</option>
            <option value="hero_low" style={{ background: '#0f172a' }}>⚡ Hero Low Angle</option>
            <option value="free" style={{ background: '#0f172a' }}>🌐 Free Orbit</option>
          </select>
        </div>

        {/* Primary Record Button */}
        <button
          id="btn-record-cinematic-shot"
          onClick={isRecordingVideo ? onStopRecording : onStartRecording}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            background: isRecordingVideo
              ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
              : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
            border: 'none',
            color: '#ffffff',
            fontWeight: 900,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: isRecordingVideo
              ? '0 0 24px rgba(239, 68, 68, 0.6)'
              : '0 4px 18px rgba(37, 99, 235, 0.45)',
            transition: 'all 0.2s ease'
          }}
        >
          <Video size={18} color="#ffffff" />
          <span>{isRecordingVideo ? '⏹️ Stop & Transcode MP4' : '🎥 Record Cinematic Shot (MP4)'}</span>
        </button>
      </div>
    </div>
  );
}
