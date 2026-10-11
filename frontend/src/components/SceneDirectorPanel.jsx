import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Video,
  Download,
  MapPin,
  Bot,
  Compass,
  Eye,
  CheckCircle2,
  Sliders,
  ChevronRight,
  ChevronLeft,
  X,
  Shield,
  Layers,
  Activity,
  Zap,
  FastForward,
  Edit3,
  FileJson,
  Trash2,
  Plus
} from 'lucide-react';

const PRESET_PROMPTS = [
  {
    id: 'patrol',
    title: 'Sidewalk Security Patrol',
    icon: '🛡️',
    prompt: 'A humanoid robot starts near the cafe, patrols north along the sidewalk past the lofts, inspects the building entrance, looks around for security threats, and waves to the aerial camera.'
  },
  {
    id: 'inspection',
    title: 'Entrance Threshold Inspection',
    icon: '🔍',
    prompt: 'Position humanoid robot at the historic bank entrance, have it inspect the bronze doorway, scan the perimeter 360 degrees, and point towards the skyscraper.'
  },
  {
    id: 'crosswalk',
    title: 'Pedestrian Crosswalk Transit',
    icon: '🚶',
    prompt: 'Robot starts at the pedestrian crosswalk, walks across the intersection along the avenue, pauses at the plaza bench, and waves to pedestrians.'
  },
  {
    id: 'celebrate',
    title: 'Drone Signal & Victory',
    icon: '🎉',
    prompt: 'Robot spawns at the city center plaza, jogs over to the park trees, inspects the pathway, and celebrates with both arms raised.'
  }
];

export function getPromptIntentBadge(promptText = '', idx = 0) {
  const p = (promptText || '').toLowerCase().trim();
  if (!p) {
    return idx === 0 
      ? { label: 'Spawn & Postural Balance', icon: '📍', color: '#38bdf8' }
      : { label: 'Sidewalk Gait Transit', icon: '🚶', color: '#f59e0b' };
  }
  if (/wave|greet|hello|hi|salute|gesture|hail/.test(p)) {
    return { label: 'Wave Greeting', icon: '👋', color: '#10b981' };
  }
  if (/celebrate|cheer|victory|triumph|arms up/.test(p)) {
    return { label: 'Victory Celebration', icon: '🎉', color: '#8b5cf6' };
  }
  if (/look up|gaze|sky|skyscraper|clouds/.test(p)) {
    return { label: 'Skyscraper Gaze', icon: '🏢', color: '#06b6d4' };
  }
  if (/crouch|kneel|duck|stoop|bend/.test(p)) {
    return { label: 'Low Terrain Crouch', icon: '🛡️', color: '#ec4899' };
  }
  if (/inspect|examine|door|latch|entrance|facade|check/.test(p)) {
    return { label: 'Architectural Inspection', icon: '🔍', color: '#f59e0b' };
  }
  if (/scan|look around|survey|360|search/.test(p)) {
    return { label: 'Perimeter Sensor Scan', icon: '👁️', color: '#0ea5e9' };
  }
  if (/jog|run|sprint|dash|fast/.test(p)) {
    return { label: 'Brisk Jogging Locomotion', icon: '🏃', color: '#f97316' };
  }
  if (/drop|spawn|land|fall|touchdown/.test(p)) {
    return { label: 'Spawn & Landing Absorption', icon: '🪂', color: '#38bdf8' };
  }
  return { label: 'Natural Gait Motion', icon: '🚶', color: '#38bdf8' };
}

const CAMERA_SHOT_PRESETS = [
  { id: 'auto_director', label: '🎬 Auto-Director', desc: 'AI-stitched cinematic cuts' },
  { id: 'first_person', label: '👁️ 1st Person POV', desc: 'Humanoid optical sensor POV' },
  { id: 'third_person', label: '🏃 3rd Person OTS', desc: 'Behind shoulder chase' },
  { id: 'hero_low', label: '⚡ Hero Low', desc: 'Low-angle skyscraper hero' },
  { id: 'closeup', label: '🔍 Close-Up', desc: 'Torso & limbs framing' },
  { id: 'wide', label: '🚁 Drone Wide', desc: 'Aerial panoramic sweep' },
  { id: 'dolly', label: '🎥 Side Dolly', desc: 'Parallel sidewalk tracking' },
  { id: 'orbit', label: '🔄 360° Orbit', desc: 'Ascending circular pan' },
  { id: 'free', label: '🌐 Free View', desc: 'Manual camera control' }
];

export default function SceneDirectorPanel({
  activeScene,
  onGenerateScene,
  isGenerating,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime,
  totalDuration,
  onSeekTime,
  playbackSpeed,
  onChangePlaybackSpeed,
  cameraMode,
  onChangeCameraMode,
  isPositioningRobot,
  onTogglePositionRobot,
  isRecordingVideo,
  onStartRecording,
  onStopRecording,
  onExportTrajectory,
  activeActionName,
  robotTelemetry,
  onClose,
  onClearScene,
  // Direct Route & Custom Path props
  isDirectRouteMode = false,
  onToggleDirectRouteMode,
  customDirectedWaypoints = [],
  onAddDirectWaypoint,
  onUpdateDirectWaypoint,
  onRemoveDirectWaypoint,
  onClearDirectedWaypoints,
  onDirectCustomPath,
  onOpenJsonProtocolModal
}) {
  const [directorTab, setDirectorTab] = useState(customDirectedWaypoints.length > 0 ? 'DIRECT_PATH' : 'PROMPT');
  const [promptText, setPromptText] = useState(
    'A humanoid robot starts near the cafe, patrols north along the sidewalk past the lofts, inspects the doorway, looks around for security threats, and waves to the camera.'
  );

  // If user enters direct route mode from toolbar, switch to DIRECT_PATH tab
  useEffect(() => {
    if (isDirectRouteMode) {
      setDirectorTab('DIRECT_PATH');
    }
  }, [isDirectRouteMode]);

  const handleSelectPreset = (preset) => {
    setPromptText(preset.prompt);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!promptText.trim() || isGenerating) return;
    onGenerateScene(promptText.trim());
  };

  const handleCompileDirectPath = () => {
    if (customDirectedWaypoints.length === 0 || isGenerating) return;
    if (onDirectCustomPath) {
      onDirectCustomPath(customDirectedWaypoints);
    }
  };

  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  return (
    <div
      className="scene-director-panel"
      style={{
        position: 'fixed',
        left: '88px',
        bottom: '24px',
        width: '470px',
        maxHeight: 'calc(100vh - 48px)',
        background: 'rgba(10, 15, 29, 0.95)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(56, 189, 248, 0.28)',
        borderRadius: '20px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.75), 0 0 30px rgba(6, 182, 212, 0.15)',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(6, 182, 212, 0.5)'
            }}
          >
            <Bot size={18} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#f8fafc' }}>
              AI Scene Director
            </h3>
            <p style={{ margin: 0, fontSize: '0.68rem', color: '#38bdf8', fontWeight: 600 }}>
              Natural Language Urban Choreography
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* JSON Protocol Inspector Button */}
          {onOpenJsonProtocolModal && (
            <button
              onClick={onOpenJsonProtocolModal}
              title="Inspect Action JSON Protocol"
              style={{
                padding: '6px 10px',
                borderRadius: '10px',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(56, 189, 248, 0.12)',
                color: '#38bdf8',
                fontSize: '0.7rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                transition: 'all 0.15s ease'
              }}
            >
              <FileJson size={13} color="#38bdf8" />
              <span>JSON Protocol</span>
            </button>
          )}

          {/* Position Robot Toggle Button */}
          <button
            onClick={onTogglePositionRobot}
            title={isPositioningRobot ? 'Click on map to drop robot' : 'Enable click-to-place robot'}
            style={{
              padding: '6px 10px',
              borderRadius: '10px',
              border: isPositioningRobot ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
              background: isPositioningRobot ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.06)',
              color: isPositioningRobot ? '#38bdf8' : '#cbd5e1',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <MapPin size={13} color={isPositioningRobot ? '#38bdf8' : '#94a3b8'} />
            <span>{isPositioningRobot ? 'PICKING' : 'Position'}</span>
          </button>

          {/* Minimize / Collapse to Sidebar Button */}
          {onClose && (
            <button
              onClick={onClose}
              title="Minimize to Sidebar (Click to collapse)"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                background: 'rgba(255, 255, 255, 0.06)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#38bdf8';
                e.currentTarget.style.background = 'rgba(56, 189, 248, 0.2)';
                e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#cbd5e1';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.14)';
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher: AI Prompt vs Direct Path & Prompts */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          padding: '4px 8px',
          background: 'rgba(15, 23, 42, 0.7)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          gap: '6px'
        }}
      >
        <button
          onClick={() => setDirectorTab('PROMPT')}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: directorTab === 'PROMPT' ? '1px solid #38bdf8' : '1px solid transparent',
            background: directorTab === 'PROMPT' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
            color: directorTab === 'PROMPT' ? '#38bdf8' : '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: directorTab === 'PROMPT' ? 800 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Sparkles size={13} color={directorTab === 'PROMPT' ? '#38bdf8' : '#94a3b8'} />
          <span>✨ AI Prompt</span>
        </button>

        <button
          onClick={() => setDirectorTab('DIRECT_PATH')}
          style={{
            padding: '7px 10px',
            borderRadius: '8px',
            border: directorTab === 'DIRECT_PATH' ? '1px solid #f59e0b' : '1px solid transparent',
            background: directorTab === 'DIRECT_PATH' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
            color: directorTab === 'DIRECT_PATH' ? '#f59e0b' : '#94a3b8',
            fontSize: '0.74rem',
            fontWeight: directorTab === 'DIRECT_PATH' ? 800 : 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'all 0.15s ease'
          }}
        >
          <Edit3 size={13} color={directorTab === 'DIRECT_PATH' ? '#f59e0b' : '#94a3b8'} />
          <span>✏️ Direct Path ({customDirectedWaypoints.length})</span>
        </button>
      </div>

      {/* Scrollable Content Body */}
      <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* MODE 1: PROMPT CHOREOGRAPHER */}
        {directorTab === 'PROMPT' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={13} color="#38bdf8" />
                <span>Describe the Scene & Actions:</span>
              </label>
              <span style={{ fontSize: '0.65rem', color: '#64748b' }}>OpenStreetMap Grounded</span>
            </div>

            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={3}
              placeholder="e.g. Robot starts at cafe, walks to brick building, inspects the doorway, and waves..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                background: 'rgba(15, 23, 42, 0.75)',
                color: '#f8fafc',
                fontSize: '0.8rem',
                lineHeight: 1.45,
                resize: 'none',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            {/* Quick Presets */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.04)',
                    color: '#94a3b8',
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{p.icon}</span>
                  <span>{p.title}</span>
                </button>
              ))}
            </div>

            {/* Generate Button */}
            <button
              type="submit"
              disabled={isGenerating}
              style={{
                marginTop: '4px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                background: isGenerating
                  ? 'rgba(56, 189, 248, 0.3)'
                  : 'linear-gradient(135deg, #0284c7 0%, #06b6d4 50%, #10b981 100%)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: isGenerating ? 'none' : '0 4px 18px rgba(6, 182, 212, 0.45)',
                transition: 'all 0.2s ease'
              }}
            >
              <Zap size={15} color="#ffffff" />
              <span>{isGenerating ? 'AI Generating Scene & Path...' : '⚡ Generate AI Scene'}</span>
            </button>
          </form>
        )}

        {/* MODE 2: DIRECT PATH & PROMPTS */}
        {directorTab === 'DIRECT_PATH' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Direct Route Mode Toggle Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={onToggleDirectRouteMode}
                style={{
                  flex: 1,
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: isDirectRouteMode ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.14)',
                  background: isDirectRouteMode
                    ? 'rgba(245, 158, 11, 0.22)'
                    : 'rgba(255, 255, 255, 0.05)',
                  color: isDirectRouteMode ? '#f59e0b' : '#cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: isDirectRouteMode ? '0 0 16px rgba(245, 158, 11, 0.35)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <Edit3 size={14} color={isDirectRouteMode ? '#f59e0b' : '#94a3b8'} />
                <span>
                  {isDirectRouteMode
                    ? '🎨 Drawing Active (Click Map to Add Points)'
                    : '✏️ Enable Drawing on 3D Map'}
                </span>
              </button>

              {customDirectedWaypoints.length > 0 && onClearDirectedWaypoints && (
                <button
                  type="button"
                  onClick={onClearDirectedWaypoints}
                  title="Clear all drawn waypoints"
                  style={{
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.35)',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#f87171',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={13} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.71rem', color: '#94a3b8', lineHeight: 1.45 }}>
              Click on the sidewalks in the 3D city to plot your humanoid route.
              Assign specific action prompts at each point (e.g. walk, inspect doorway, wave).
            </p>

            {/* List of Drawn Waypoints with Per-Point Prompts */}
            {customDirectedWaypoints.length === 0 ? (
              <div
                style={{
                  padding: '24px 16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f59e0b'
                  }}
                >
                  <Edit3 size={18} />
                </div>
                <strong style={{ fontSize: '0.78rem', color: '#f8fafc' }}>
                  No Waypoints Plotted Yet
                </strong>
                <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', maxWidth: '300px' }}>
                  Click "Enable Drawing on 3D Map" above, then click on sidewalks to plot your path.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  paddingRight: '2px'
                }}
              >
                {customDirectedWaypoints.map((wp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.85)',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#f59e0b',
                            color: '#090e1a',
                            fontSize: '0.62rem',
                            fontWeight: 900,
                            fontFamily: 'monospace'
                          }}
                        >
                          PT {idx + 1}
                        </span>
                        <span style={{ fontSize: '0.68rem', fontFamily: 'monospace', color: '#cbd5e1' }}>
                          {wp.lat?.toFixed(4)}, {wp.lng?.toFixed(4)}
                        </span>
                      </div>

                      {onRemoveDirectWaypoint && (
                        <button
                          type="button"
                          onClick={() => onRemoveDirectWaypoint(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: '2px'
                          }}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Natural Language Scene & Action Description */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.62rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Scene & Humanoid Action
                        </span>
                        {(() => {
                          const intent = getPromptIntentBadge(wp.prompt, idx);
                          return (
                            <span style={{
                              fontSize: '0.6rem',
                              padding: '1px 7px',
                              borderRadius: '10px',
                              background: `${intent.color}20`,
                              color: intent.color,
                              border: `1px solid ${intent.color}40`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 600
                            }}>
                              {intent.icon} {intent.label}
                            </span>
                          );
                        })()}
                      </div>
                      <input
                        type="text"
                        value={wp.prompt || ''}
                        onChange={(e) =>
                          onUpdateDirectWaypoint && onUpdateDirectWaypoint(idx, { prompt: e.target.value })
                        }
                        placeholder={idx === 0 ? "e.g. Spawn on sidewalk and inspect surroundings" : "e.g. Wave hello to drone camera, inspect building doorway..."}
                        style={{
                          width: '100%',
                          padding: '7px 9px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255, 255, 255, 0.16)',
                          background: 'rgba(0, 0, 0, 0.5)',
                          color: '#f8fafc',
                          fontSize: '0.74rem',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'border-color 0.2s ease'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Compile Direct Path Button */}
            <button
              type="button"
              onClick={handleCompileDirectPath}
              disabled={customDirectedWaypoints.length === 0 || isGenerating}
              style={{
                marginTop: '4px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                background:
                  customDirectedWaypoints.length === 0 || isGenerating
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'linear-gradient(135deg, #d97706 0%, #f59e0b 50%, #10b981 100%)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: customDirectedWaypoints.length === 0 || isGenerating ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow:
                  customDirectedWaypoints.length > 0 && !isGenerating
                    ? '0 4px 18px rgba(245, 158, 11, 0.45)'
                    : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              <Zap size={15} color="#ffffff" />
              <span>
                {isGenerating
                  ? 'Compiling 60 FPS Path & Kinematics...'
                  : `⚡ Compile & Direct Scene (${customDirectedWaypoints.length} Points)`}
              </span>
            </button>
          </div>
        )}

        {/* 3. Active Scene Timeline Overview */}
        {activeScene && (
          <div
            style={{
              padding: '14px',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>
                  {activeScene.title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8' }}>
                  {activeScene.total_duration_sec}s • {activeScene.total_frames} frames @ 60 FPS
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Live Action Badge */}
                <div

                  style={{
                    padding: '4px 10px',
                    borderRadius: '20px',
                    background: 'rgba(56, 189, 248, 0.18)',
                    border: '1px solid #38bdf8',
                    color: '#38bdf8',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#38bdf8',
                      boxShadow: '0 0 6px #38bdf8'
                    }}
                  />
                  <span>{activeActionName || 'STANDBY'}</span>
                </div>

                {/* Reset / Start Over Button */}
                {onClearScene && (
                  <button
                    onClick={onClearScene}
                    title="Clear previous scene and start fresh"
                    style={{
                      padding: '4px 9px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.35)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#f87171',
                      fontSize: '0.66rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                      e.currentTarget.style.borderColor = '#ef4444';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                      e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
                    }}
                  >
                    <RotateCcw size={11} />
                    <span>Start Over</span>
                  </button>
                )}
              </div>
            </div>

            {/* Action sequence steps pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {activeScene.waypoints.map((wp, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    background: activeActionName === wp.action ? 'rgba(56, 189, 248, 0.35)' : 'rgba(255, 255, 255, 0.06)',
                    color: activeActionName === wp.action ? '#38bdf8' : '#94a3b8',
                    border: activeActionName === wp.action ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)'
                  }}
                >
                  {wp.action}: {wp.name.split(' ')[0]}
                </div>
              ))}
            </div>

            {/* 4. Timeline Slider & Scrubber */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#cbd5e1', fontWeight: 600 }}>
                <span>{currentTime.toFixed(1)}s</span>
                <span style={{ color: '#64748b' }}>/ {totalDuration.toFixed(1)}s</span>
              </div>

              <input
                type="range"
                min="0"
                max={totalDuration || 1}
                step="0.05"
                value={currentTime}
                onChange={(e) => onSeekTime(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer',
                  accentColor: '#38bdf8'
                }}
              />
            </div>

            {/* Playback Controls & Speed */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={onTogglePlay}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    border: 'none',
                    background: isPlaying ? '#ef4444' : '#38bdf8',
                    color: '#090e1a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: isPlaying ? '0 0 12px rgba(239, 68, 68, 0.4)' : '0 0 12px rgba(56, 189, 248, 0.4)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isPlaying ? <Pause size={18} fill="#090e1a" /> : <Play size={18} fill="#090e1a" />}
                </button>

                <button
                  onClick={onResetPlayback}
                  title="Rewind to start"
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    color: '#cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={15} />
                </button>

                {/* Playback Speed selector */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px' }}>
                  {[0.5, 1.0, 2.0].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onChangePlaybackSpeed(spd)}
                      style={{
                        padding: '3px 6px',
                        borderRadius: '6px',
                        border: 'none',
                        background: playbackSpeed === spd ? '#38bdf8' : 'transparent',
                        color: playbackSpeed === spd ? '#090e1a' : '#94a3b8',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        cursor: 'pointer'
                      }}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Camera Mode Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '8px',
                    background: cameraMode === 'auto_director' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: cameraMode === 'auto_director' ? '#38bdf8' : '#cbd5e1',
                    border: cameraMode === 'auto_director' ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)'
                  }}
                >
                  {cameraMode === 'auto_director' ? '🎬 AUTO-DIRECTOR' : `🎥 ${cameraMode.toUpperCase()}`}
                </span>
              </div>
            </div>

            {/* Multi-Angle Cinematic Camera Switcher */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '4px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>🎥</span>
                  <span>Cinematic Camera Angle:</span>
                </span>
                <span
                  style={{
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    color: cameraMode === 'auto_director' ? '#38bdf8' : '#94a3b8'
                  }}
                >
                  {cameraMode === 'auto_director' ? '⚡ AI Auto-Stitch Active' : 'Manual Override'}
                </span>
              </div>

              {/* Grid of Camera Angle Buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                {CAMERA_SHOT_PRESETS.map((cam) => {
                  const isActive =
                    cameraMode === cam.id ||
                    (cam.id === 'third_person' && cameraMode === 'chase') ||
                    (cam.id === 'wide' && cameraMode === 'drone_wide') ||
                    (cam.id === 'first_person' && cameraMode === 'first_person_pov') ||
                    (cam.id === 'hero_low' && cameraMode === 'hero_low_angle') ||
                    (cam.id === 'closeup' && cameraMode === 'action_closeup') ||
                    (cam.id === 'dolly' && cameraMode === 'side_dolly');

                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => onChangeCameraMode(cam.id)}
                      title={cam.desc}
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        border: isActive ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                        background: isActive
                          ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(6, 182, 212, 0.15) 100%)'
                          : 'rgba(255, 255, 255, 0.04)',
                        color: isActive ? '#38bdf8' : '#cbd5e1',
                        fontSize: '0.67rem',
                        fontWeight: isActive ? 800 : 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        boxShadow: isActive ? '0 0 10px rgba(56, 189, 248, 0.25)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cam.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AI Stitched Shot List Timeline */}
            {activeScene?.camera_shots && activeScene.camera_shots.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '4px',
                  paddingTop: '8px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span>🎞️</span>
                    <span>AI Stitched Shot List ({activeScene.camera_shots.length} Cuts):</span>
                  </span>
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Click to jump</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '5px',
                    maxHeight: '135px',
                    overflowY: 'auto',
                    paddingRight: '2px'
                  }}
                >
                  {activeScene.camera_shots.map((shot, idx) => {
                    const isShotActive = shot.start_time <= currentTime && currentTime < shot.end_time;
                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          onSeekTime(shot.start_time);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: isShotActive ? '1px solid #00f2fe' : '1px solid rgba(255, 255, 255, 0.07)',
                          background: isShotActive ? 'rgba(0, 242, 254, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: isShotActive ? '0 0 12px rgba(0, 242, 254, 0.25)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 800,
                              padding: '2px 5px',
                              borderRadius: '4px',
                              background: isShotActive ? '#00f2fe' : 'rgba(255, 255, 255, 0.1)',
                              color: isShotActive ? '#090e1a' : '#cbd5e1'
                            }}
                          >
                            CUT {idx + 1}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.69rem', fontWeight: 700, color: isShotActive ? '#00f2fe' : '#f8fafc' }}>
                              {shot.label || shot.angle}
                            </span>
                            <span style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                              {shot.lens} • {shot.description}
                            </span>
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontFamily: 'monospace',
                            color: isShotActive ? '#00f2fe' : '#64748b',
                            fontWeight: 600
                          }}
                        >
                          {shot.start_time.toFixed(1)}s - {shot.end_time.toFixed(1)}s
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. One-Click Recording & Trajectory Export */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={isRecordingVideo ? onStopRecording : onStartRecording}
            style={{
              padding: '10px',
              borderRadius: '12px',
              border: isRecordingVideo ? '1px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.4)',
              background: isRecordingVideo ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
              color: isRecordingVideo ? '#ffffff' : '#f87171',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s ease',
              boxShadow: isRecordingVideo ? '0 0 16px rgba(239, 68, 68, 0.5)' : 'none'
            }}
          >
            <Video size={14} color={isRecordingVideo ? '#ffffff' : '#f87171'} />
            <span>{isRecordingVideo ? '⏹ Stop Video' : '⏺ Record Take (MP4)'}</span>
          </button>

          <button
            onClick={onExportTrajectory}
            disabled={!activeScene}
            style={{
              padding: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.06)',
              color: activeScene ? '#cbd5e1' : '#64748b',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: activeScene ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Download size={14} color={activeScene ? '#38bdf8' : '#64748b'} />
            <span>Export Data (.JSON)</span>
          </button>
        </div>
      </div>

      {/* Floating Biomechanical & Terrain Physics Telemetry Footer */}
      {robotTelemetry && (
        <div
          style={{
            padding: '10px 16px',
            background: 'rgba(15, 23, 42, 0.94)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: '5px',
            fontSize: '0.67rem',
            fontFamily: 'monospace',
            color: '#94a3b8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>🤖 ATLAS-G1</span>
              <span>HDG: {robotTelemetry.heading}°</span>
              <span style={{ color: robotTelemetry.pitch < 0 ? '#f59e0b' : '#38bdf8' }}>
                PITCH: {robotTelemetry.pitch?.toFixed(1)}°
              </span>
            </div>
            <div>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background:
                    robotTelemetry.terrain?.slope_category === 'DOWNHILL'
                      ? 'rgba(239, 68, 68, 0.2)'
                      : robotTelemetry.terrain?.slope_category === 'UPHILL'
                      ? 'rgba(16, 185, 129, 0.2)'
                      : 'rgba(56, 189, 248, 0.1)',
                  color:
                    robotTelemetry.terrain?.slope_category === 'DOWNHILL'
                      ? '#f87171'
                      : robotTelemetry.terrain?.slope_category === 'UPHILL'
                      ? '#34d399'
                      : '#38bdf8',
                  fontWeight: 800,
                  fontSize: '0.62rem'
                }}
              >
                SLOPE: {robotTelemetry.terrain?.slope_deg?.toFixed(1) || '0.0'}° [
                {robotTelemetry.terrain?.slope_category || 'LEVEL'}]
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#64748b', fontSize: '0.63rem' }}>
            <span>
              ELEV: <strong style={{ color: '#e2e8f0' }}>{robotTelemetry.altitude?.toFixed(2)}m</strong> (ROAD:{' '}
              {robotTelemetry.terrain?.ground_z?.toFixed(2) || robotTelemetry.groundAltitude?.toFixed(2) || '20.00'}m)
            </span>
            <span>
              FEET:{' '}
              <strong style={{ color: robotTelemetry.terrain?.foot_contact?.left_grounded ? '#34d399' : '#94a3b8' }}>
                L:{robotTelemetry.terrain?.foot_contact?.left_grounded ? 'GROUND' : 'SWING'}
              </strong>{' '}
              |{' '}
              <strong style={{ color: robotTelemetry.terrain?.foot_contact?.right_grounded ? '#34d399' : '#94a3b8' }}>
                R:{robotTelemetry.terrain?.foot_contact?.right_grounded ? 'GROUND' : 'SWING'}
              </strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
