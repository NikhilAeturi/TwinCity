import React, { useState, useEffect, useMemo } from 'react';
import {
  Clapperboard,
  MapPin,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Video,
  Camera,
  Layers,
  Flame,
  CheckCircle2,
  Crosshair,
  Sliders,
  Radio,
  Download,
  AlertCircle
} from 'lucide-react';

/**
 * ScreenplayDirectorPanel - Natural Language 3D Physics Scene Director.
 * Translates user prompt into certified open-source 3D models (vehicles, drones, props),
 * simulates multi-body Newtonian collisions or 6-DoF multirotor aerodynamics,
 * grounded at the user's chosen stage coordinates on the 3D map.
 */
export default function ScreenplayDirectorPanel({
  stagePos,
  isPickingStagePos,
  onTogglePickStagePos,
  onRecenterStagePos,
  onGenerateScreenplay,
  isGenerating,
  activeScene,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime = 0,
  playbackSpeed = 1.0,
  onChangePlaybackSpeed,
  isRecordingVideo = false,
  onStartRecording,
  onStopRecording,
  cameraMode = 'auto_director',
  onChangeCameraMode,
  onClose
}) {
  const [prompt, setPrompt] = useState('car crash into two cars at high speed');



  // Dynamic preview of resolved 3D models based on current prompt
  const resolvedModelPreview = useMemo(() => {
    const p = prompt.toLowerCase();
    const isDrone = p.includes('drone') || p.includes('quadcopter') || p.includes('uav') || p.includes('flies in air') || p.includes('flying');
    const isThreeCars = p.includes('two cars') || p.includes('2 cars') || p.includes('three cars') || p.includes('3 cars') || p.includes('pileup') || p.includes('crash into two');
    const isBarrier = p.includes('barrier') || p.includes('wall') || p.includes('concrete');
    const isTruck = p.includes('truck') || p.includes('semi') || p.includes('delivery');
    const isPolice = p.includes('police') || p.includes('cop') || p.includes('pursuit') || p.includes('chase');

    if (isDrone && !p.includes('crash')) {
      return {
        type: 'drone_flight',
        label: 'Autonomous Multirotor Flight',
        physics: '6-DoF Aerodynamics (Lift, Pitch Dive & Banked Turn)',
        models: [
          { name: 'Stunt Quadcopter UAV', file: 'drone_quadcopter.glb', tag: 'Aerial Drone' }
        ]
      };
    }

    if (isBarrier && (isTruck || p.includes('crash') || p.includes('hit'))) {
      return {
        type: 'truck_barrier_crash',
        label: 'Heavy Commercial Impact',
        physics: '5.2-Ton Freight Momentum + Jersey Barrier Topple',
        models: [
          { name: 'Freight Box Truck (5200 kg)', file: 'vehicle_truck.glb', tag: 'Collider' },
          { name: 'Concrete Jersey Barrier (2500 kg)', file: 'prop_barrier.glb', tag: 'Obstacle' },
          { name: 'Collision Debris Cluster', file: 'prop_debris_cluster.glb', tag: 'Scatter' }
        ]
      };
    }

    if (isThreeCars) {
      return {
        type: 'three_car_crash',
        label: '3-Car Pileup Collision',
        physics: 'Inelastic Multi-Body Restitution (e=0.22) & Secondary T-Bone Ricochet',
        models: [
          { name: 'Sapphire Executive Sedan', file: 'vehicle_sedan.glb', tag: 'Collider 1' },
          { name: 'Tactical Full-Size SUV', file: 'vehicle_suv.glb', tag: 'Target 1' },
          { name: 'Metropolitan Police Interceptor', file: 'vehicle_police.glb', tag: 'Target 2' },
          { name: 'Kinetic Debris Scatter', file: 'prop_debris_cluster.glb', tag: 'Scatter' }
        ]
      };
    }

    return {
      type: 'two_car_crash',
      label: 'Two-Vehicle Collision',
      physics: 'Newtonian Impulse Exchange & Rotational Yaw Spinout',
      models: [
        { name: isPolice ? 'Police Interceptor' : 'Executive Sedan', file: isPolice ? 'vehicle_police.glb' : 'vehicle_sedan.glb', tag: 'Lead Vehicle' },
        { name: isTruck ? 'Freight Box Truck' : 'Tactical SUV', file: isTruck ? 'vehicle_truck.glb' : 'vehicle_suv.glb', tag: 'Crossing Target' },
        { name: 'Collision Debris Cluster', file: 'prop_debris_cluster.glb', tag: 'Scatter' }
      ]
    };
  }, [prompt]);

  const handleTriggerSimulate = () => {
    if (!prompt.trim() || isGenerating) return;
    onGenerateScreenplay?.(prompt);
  };

  const duration = activeScene?.total_duration_sec || activeScene?.duration || 6.0;

  return (
    <div
      id="screenplay-director-panel"
      style={{
        position: 'fixed',
        left: '88px',
        top: '16px',
        bottom: '16px',
        width: '410px',
        background: 'rgba(9, 14, 26, 0.95)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        borderRadius: '20px',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(245, 158, 11, 0.15)',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      {/* 1. Header */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.12) 0%, rgba(0, 0, 0, 0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 16px rgba(245, 158, 11, 0.5)'
            }}
          >
            <Clapperboard size={20} color="#0f172a" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Screenplay AI Director
            </div>
            <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: 500 }}>
              Physical Simulation with 3D Models
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#94a3b8',
            width: '28px',
            height: '28px',
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

      {/* 2. Scrollable Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* A. Scene Stage Anchor Card ("and it happens at the place that i put the scene") */}
        <div
          style={{
            background: isPickingStagePos ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 23, 42, 0.65)',
            border: isPickingStagePos ? '1.5px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            transition: 'all 0.2s ease',
            boxShadow: isPickingStagePos ? '0 0 20px rgba(245, 158, 11, 0.25)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} color={isPickingStagePos ? '#fbbf24' : '#38bdf8'} />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Scene Stage Anchor Point
              </span>
            </div>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                color: isPickingStagePos ? '#fbbf24' : '#10b981',
                background: isPickingStagePos ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.15)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}
            >
              {isPickingStagePos ? '📍 PICKING ON MAP' : 'ANCHORED'}
            </span>
          </div>

          <div
            style={{
              fontSize: '0.74rem',
              color: '#94a3b8',
              fontFamily: 'monospace',
              background: 'rgba(0, 0, 0, 0.35)',
              padding: '6px 10px',
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between'
            }}
          >
            <span>LAT: <strong style={{ color: '#e2e8f0' }}>{stagePos?.lat?.toFixed(5) || '37.79520'}</strong></span>
            <span>LNG: <strong style={{ color: '#e2e8f0' }}>{stagePos?.lng?.toFixed(5) || '-122.40280'}</strong></span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              id="btn-pick-stage-location"
              onClick={onTogglePickStagePos}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '10px',
                border: isPickingStagePos ? '1px solid #fbbf24' : '1px solid rgba(255, 255, 255, 0.15)',
                background: isPickingStagePos ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' : 'rgba(255, 255, 255, 0.08)',
                color: isPickingStagePos ? '#0f172a' : '#f8fafc',
                fontWeight: 800,
                fontSize: '0.76rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              <Crosshair size={14} />
              {isPickingStagePos ? 'Click on 3D Map to Anchor' : '🎯 Pick Location on Map'}
            </button>

            <button
              onClick={onRecenterStagePos}
              title="Reset Stage Origin to Viewport Center"
              style={{
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <RotateCcw size={13} />
              Center
            </button>
          </div>
        </div>

        {/* B. Describe Scene Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label
              htmlFor="screenplay-prompt-input"
              style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                color: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Sparkles size={15} color="#fbbf24" />
              Describe Scene
            </label>
            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>Natural Language</span>
          </div>

          <textarea
            id="screenplay-prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. car crash into two cars at high speed, or drone flies in air through city corridor..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '12px',
              padding: '12px 14px',
              color: '#f8fafc',
              fontSize: '0.82rem',
              lineHeight: 1.45,
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5)'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.66rem', color: '#64748b', marginTop: '2px' }}>
            <span>Natural language AI scene prompt</span>
            <span>Zero hardcoded presets</span>
          </div>
        </div>

        {/* C. Live AI 3D Model Resolver Preview */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} color="#10b981" />
              Resolved 3D Models in Catalog
            </span>
            <span style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 700 }}>
              {resolvedModelPreview.models.length} Models
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {resolvedModelPreview.models.map((mod, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.85rem' }}>
                    {mod.file.includes('drone') ? '🚁' : mod.file.includes('truck') ? '🚚' : mod.file.includes('barrier') ? '🚧' : mod.file.includes('debris') ? '💥' : '🏎️'}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f8fafc' }}>
                      {mod.name}
                    </div>
                    <div style={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {mod.file}
                    </div>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    color: '#fbbf24',
                    background: 'rgba(245, 158, 11, 0.15)',
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {mod.tag}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: '0.68rem',
              color: '#94a3b8',
              lineHeight: 1.3,
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '6px',
              fontStyle: 'italic'
            }}
          >
            ⚡ {resolvedModelPreview.physics}
          </div>
        </div>

        {/* D. Main Action Button: Simulate Screenplay */}
        <button
          id="btn-simulate-screenplay"
          onClick={handleTriggerSimulate}
          disabled={isGenerating}
          style={{
            background: isGenerating
              ? 'rgba(245, 158, 11, 0.5)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            border: 'none',
            borderRadius: '14px',
            padding: '14px 20px',
            color: '#0f172a',
            fontSize: '0.88rem',
            fontWeight: 900,
            cursor: isGenerating ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.35)',
            transition: 'all 0.2s ease'
          }}
        >
          {isGenerating ? (
            <>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #0f172a',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              Simulating 3D Physics Scene...
            </>
          ) : (
            <>
              <Clapperboard size={18} strokeWidth={2.5} />
              Simulate Scene with AI
            </>
          )}
        </button>

        {/* E. Active Scene Playback & Director Controls */}
        {activeScene && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>
                  {activeScene.title || 'Screenplay Simulation'}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                  {activeScene.total_frames || 360} Frames @ 60 FPS | {duration.toFixed(1)}s
                </div>
              </div>
              <span
                style={{
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  color: '#fbbf24',
                  background: 'rgba(245, 158, 11, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}
              >
                60 FPS ACTIVE
              </span>
            </div>

            {/* Scrubber & Timeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                id="btn-screenplay-play-pause"
                onClick={onTogglePlay}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isPlaying ? '#ef4444' : '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: isPlaying ? '0 0 14px rgba(239, 68, 68, 0.4)' : '0 0 14px rgba(16, 185, 129, 0.4)'
                }}
              >
                {isPlaying ? <Pause size={17} /> : <Play size={17} />}
              </button>

              <button
                id="btn-screenplay-reset"
                onClick={onResetPlayback}
                title="Restart simulation"
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <RotateCcw size={15} />
              </button>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8' }}>
                  <span>{currentTime.toFixed(2)}s</span>
                  <span>{duration.toFixed(1)}s</span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(100, (currentTime / duration) * 100)}%`,
                      background: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                      transition: 'width 0.05s linear'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Speed Multiplier Chips */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Speed:</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {[0.5, 1.0, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => onChangePlaybackSpeed?.(s)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: playbackSpeed === s ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: playbackSpeed === s ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                      color: playbackSpeed === s ? '#fbbf24' : '#cbd5e1',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            {/* Cinematic Camera Cuts Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Camera size={13} color="#38bdf8" />
                Director Camera Shot
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {[
                  { id: 'auto_director', label: '🎬 Auto Cuts' },
                  { id: 'wide', label: '🚁 Drone Overhead' },
                  { id: 'closeup', label: '💥 Impact Closeup' },
                  { id: 'third_person', label: '🏎️ Chase Cam' },
                  { id: 'hero_low', label: '🎥 Hero Low' },
                  { id: 'free', label: '🌐 Free Orbit' }
                ].map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => onChangeCameraMode?.(cam.id)}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: cameraMode === cam.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
                      background: cameraMode === cam.id ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                      color: cameraMode === cam.id ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 60 FPS Video Recording */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '10px' }}>
              <button
                id="btn-record-screenplay-video"
                onClick={isRecordingVideo ? onStopRecording : onStartRecording}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: '10px',
                  border: isRecordingVideo ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                  background: isRecordingVideo
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
                  color: isRecordingVideo ? '#fca5a5' : '#f8fafc',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: '#ef4444',
                    boxShadow: '0 0 8px #ef4444'
                  }}
                />
                {isRecordingVideo ? 'Stop & Save 60 FPS Video' : '🔴 Record 60 FPS Screenplay MP4'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
