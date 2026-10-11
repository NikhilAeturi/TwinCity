import React, { useState } from 'react';
import {
  FileJson, Copy, Check, X,
  Cpu, Layers, Zap, Footprints, Shield, Terminal
} from 'lucide-react';

export default function ActionJsonProtocolModal({
  isOpen,
  onClose,
  activeScene,
  currentFrame,
  customDirectedWaypoints = []
}) {
  const [activeTab, setActiveTab] = useState('ARCHITECTURE'); // 'ARCHITECTURE' | 'INPUT' | 'TIMELINE' | 'LIVE_FRAME'
  const [copiedTab, setCopiedTab] = useState(null);

  if (!isOpen) return null;

  // 1. Prepare JSON payloads
  const inputJson = JSON.stringify(
    {
      city_id: activeScene?.city_id || 'san_francisco',
      directed_waypoints: customDirectedWaypoints.length > 0
        ? customDirectedWaypoints
        : (activeScene?.waypoints || []).map((w, idx) => ({
            step: idx + 1,
            coordinates: { lat: w?.lat ?? 0, lng: w?.lng ?? 0 },
            user_prompt: w?.description || w?.name,
            action_directive: w?.action
          }))
    },
    null,
    2
  );

  const timelineJson = JSON.stringify(
    {
      scene_id: activeScene?.scene_id || 'scene_live',
      title: activeScene?.title || 'Custom Directed Mission',
      total_duration_sec: activeScene?.total_duration_sec || 0,
      fps: activeScene?.fps || 60,
      total_frames: activeScene?.total_frames || 0,
      action_timeline: (activeScene?.waypoints || []).map((w) => ({
        step: w?.step,
        action: w?.action,
        speed_mps: w?.speed,
        duration_sec: w?.duration,
        heading_deg: w?.heading,
        action_intent: w?.description,
        coordinates: { lat: w?.lat ?? 0, lng: w?.lng ?? 0, altitude: w?.altitude ?? 0 }
      })),
      camera_choreography: activeScene?.camera_shots || []
    },
    null,
    2
  );

  const liveFrameJson = JSON.stringify(
    currentFrame || {
      frame: 0,
      time: 0.0,
      action: 'IDLE',
      pos: { lat: 37.7952, lng: -122.4028, altitude: 20.0, altitude_offset: 0.0 },
      heading: 45.0,
      pitch: -2.5,
      roll: 0.0,
      speed: 1.3,
      joints: {
        neck_pitch: 5.0,
        neck_yaw: 0.0,
        spine_pitch: 4.0,
        r_shoulder_pitch: -18.0,
        r_elbow: 25.0,
        l_shoulder_pitch: 18.0,
        l_elbow: 25.0,
        r_hip_pitch: -20.0,
        r_knee: 24.0,
        l_hip_pitch: 20.0,
        l_knee: 6.0
      },
      terrain_telemetry: {
        ground_clamped: true,
        normal_force_n: 735.8,
        slope_deg: -4.2,
        surface_material: 'concrete_sidewalk'
      }
    },
    null,
    2
  );

  const handleCopy = (tabKey, textToCopy) => {
    try {
      navigator.clipboard.writeText(textToCopy);
      setCopiedTab(tabKey);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(3, 7, 18, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        userSelect: 'none',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '880px',
          maxHeight: '88vh',
          background: 'rgba(10, 15, 29, 0.96)',
          border: '1px solid rgba(56, 189, 248, 0.35)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(6, 182, 212, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
            background: 'linear-gradient(90deg, rgba(56, 189, 248, 0.12) 0%, rgba(15, 23, 42, 0) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(6, 182, 212, 0.45)'
              }}
            >
              <FileJson size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em' }}>
                  Humanoid Action JSON Protocol & Execution Pipeline
                </h2>
                <span
                  style={{
                    fontSize: '0.66rem',
                    fontFamily: 'monospace',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(56, 189, 248, 0.2)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    fontWeight: 700
                  }}
                >
                  v2.4 Production
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.74rem', color: '#94a3b8' }}>
                Transparent schema: User Path Cues → AI Compiler → 60 FPS Joint Kinematics
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#cbd5e1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = '#ef4444';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#cbd5e1';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 24px',
            background: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          {[
            { id: 'ARCHITECTURE', label: 'Pipeline Architecture', icon: Layers },
            { id: 'INPUT', label: '1. Directed Cues JSON', icon: Cpu },
            { id: 'TIMELINE', label: '2. Action Timeline JSON', icon: Zap },
            { id: 'LIVE_FRAME', label: '3. Live 60 FPS Frame JSON', icon: Terminal }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: isActive ? '1px solid #38bdf8' : '1px solid transparent',
                  background: isActive ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                  color: isActive ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} color={isActive ? '#38bdf8' : '#94a3b8'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 24px',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.55
          }}
        >
          {activeTab === 'ARCHITECTURE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', fontFamily: 'Inter, sans-serif' }}>
              <div
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  background: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} color="#38bdf8" />
                  How Stunt & Scene Actions Work: From Natural Language Cues to 60 FPS Kinematics
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  TwinCity uses a <strong>deterministic, multi-stage JSON protocol</strong> to execute scene motion.
                  Actors and vehicles do not guess or randomly float; every action is compiled, ground-clamped, and solved into
                  anatomically grounded kinematics.
                </p>
              </div>

              {/* Visual Pipeline Flow */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, display: 'block', marginBottom: '4px' }}>STAGE 1</span>
                    <strong style={{ color: '#ffffff', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>Director Input</strong>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                      User draws path lines and types natural language cues at specific waypoints.
                    </p>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', background: 'rgba(0, 0, 0, 0.4)', padding: '6px 8px', borderRadius: '6px' }}>
                    DirectorInputJSON
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, display: 'block', marginBottom: '4px' }}>STAGE 2</span>
                    <strong style={{ color: '#ffffff', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>AI Prompt Compiler</strong>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                      Parses prompts into discrete states (WALK, JOG, INSPECT, SCAN, WAVE, CELEBRATE).
                    </p>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', background: 'rgba(0, 0, 0, 0.4)', padding: '6px 8px', borderRadius: '6px' }}>
                    ActionTimelineJSON
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, display: 'block', marginBottom: '4px' }}>STAGE 3</span>
                    <strong style={{ color: '#ffffff', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>Biomechanics Engine</strong>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                      LIPM bipedal gait generator computes 16-DOF joint angles, foot lift, and terrain clamping.
                    </p>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', background: 'rgba(0, 0, 0, 0.4)', padding: '6px 8px', borderRadius: '6px' }}>
                    FrameTelemetryJSON
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#38bdf8', fontWeight: 800, display: 'block', marginBottom: '4px' }}>STAGE 4</span>
                    <strong style={{ color: '#ffffff', fontSize: '0.78rem', display: 'block', marginBottom: '4px' }}>Execution Engine</strong>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>
                      Three.js Articulated Twin & Google Maps 3D animate limbs at 60 FPS in real time.
                    </p>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b', background: 'rgba(0, 0, 0, 0.4)', padding: '6px 8px', borderRadius: '6px' }}>
                    60FPS Real-Time Player
                  </div>
                </div>
              </div>

              {/* Key Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Footprints size={15} color="#38bdf8" /> Active Articulated Limbs
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.45 }}>
                    Arms swing reciprocal to legs during locomotion. Knees flex to absorb downhill slopes and landing impacts.
                    Head rotates 360° for surveillance scans, and right arm articulates for greeting waves.
                  </p>
                </div>

                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={15} color="#10b981" /> Ground Clamping & Sidewalk NavMesh
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.45 }}>
                    Zero floating: Feet are continuously anchored relative to ground surface elevation (20.0m + Δz).
                    NavMesh corridors prevent paths from cutting through building structures.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INPUT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Director Waypoint Cues Payload</span>
                <button
                  onClick={() => handleCopy('INPUT', inputJson)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedTab === 'INPUT' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedTab === 'INPUT' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#38bdf8',
                  fontSize: '0.72rem',
                  overflowX: 'auto',
                  lineHeight: 1.55
                }}
              >
                {inputJson}
              </pre>
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span>Compiled Action Timeline & Camera Choreography</span>
                <button
                  onClick={() => handleCopy('TIMELINE', timelineJson)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedTab === 'TIMELINE' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedTab === 'TIMELINE' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#7dd3fc',
                  fontSize: '0.72rem',
                  overflowX: 'auto',
                  lineHeight: 1.55
                }}
              >
                {timelineJson}
              </pre>
            </div>
          )}

          {activeTab === 'LIVE_FRAME' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#94a3b8' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
                  Live 60 FPS Telemetry Frame (Updates with Playback)
                </span>
                <button
                  onClick={() => handleCopy('LIVE_FRAME', liveFrameJson)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '0.7rem',
                    cursor: 'pointer'
                  }}
                >
                  {copiedTab === 'LIVE_FRAME' ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedTab === 'LIVE_FRAME' ? 'Copied' : 'Copy JSON'}</span>
                </button>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.9)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  color: '#34d399',
                  fontSize: '0.72rem',
                  overflowX: 'auto',
                  lineHeight: 1.55
                }}
              >
                {liveFrameJson}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(15, 23, 42, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.74rem',
            color: '#94a3b8'
          }}
        >
          <span>Active Simulation Rate: 60.0 FPS | Joint DOFs: 16 | Terrain Elevation Clamped</span>
          <button
            onClick={onClose}
            style={{
              padding: '7px 18px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              border: 'none',
              color: '#ffffff',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 14px rgba(6, 182, 212, 0.4)'
            }}
          >
            Close Protocol Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

