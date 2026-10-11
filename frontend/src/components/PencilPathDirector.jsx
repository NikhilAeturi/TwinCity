import React from 'react';
import {
  Pencil,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Video,
  Sparkles,
  Bot,
  MapPin,
  X,
  Plus,
  Compass,
  CheckCircle2,
  Clock,
  Gauge
} from 'lucide-react';

/**
 * PencilPathDirector
 * 
 * Streamlined, minimalist AI Robotics Path Director:
 * 1. Pencil Tool: Click to draw points along the line on the 3D satellite map.
 * 2. Action Textbox for each point on the line: Describe character actions at each location.
 * 3. AI Choreography: Groq API combines actions, calculates physical speeds & distance durations.
 * 4. ▶️ Test Movement: Tests character locomotion & actions in the real satellite environment (free camera).
 * 5. 🎥 Record (MP4): Cinematic camera movement & angles, physical timing, exported directly as MP4.
/**
 * Infers robotics action token from natural language prompt text.
 */
export function inferActionFromPrompt(prompt, fallback = 'WALK') {
  if (!prompt) return fallback;
  const p = prompt.toLowerCase();
  if (p.match(/wave|hi|hello|greet|salute|signal|gesture|hail/)) return 'WAVE';
  if (p.match(/celebrate|cheer|victory|flex|arms up|win|triumph/)) return 'CELEBRATE';
  if (p.match(/drop|land|spawn|touchdown|arrive|appear|descend/)) return 'SPAWN';
  if (p.match(/inspect|examine|door|latch|entrance|check|facade/)) return 'INSPECT';
  if (p.match(/scan|survey|perimeter|search|look around|360|threat/)) return 'SCAN';
  if (p.match(/crouch|duck|kneel|low|stoop|bend/)) return 'CROUCH';
  if (p.match(/look up|sky|roof|tower|skyscraper|clouds/)) return 'LOOK_UP';
  if (p.match(/jog|run|sprint|dash|hurry|fast/)) return 'JOG';
  if (p.match(/jump|leap|vault/)) return 'JUMP';
  if (p.match(/walk|patrol|stride|navigate|go|march|move|stroll/)) return 'WALK';
  return fallback;
}

export default function PencilPathDirector({
  isDirectRouteMode,
  onToggleDirectRouteMode,
  customDirectedWaypoints = [],
  onAddDirectWaypoint,
  onUpdateDirectWaypoint,
  onRemoveDirectWaypoint,
  onClearDirectedWaypoints,
  onCompileAndDirect,
  isGenerating,
  activeScene,
  isPlaying,
  onTogglePlay,
  onResetPlayback,
  currentTime = 0,
  isRecordingVideo,
  onStartRecording,
  onStopRecording,
  cameraMode,
  onChangeCameraMode,
  onClose
}) {
  const totalDuration = activeScene?.total_duration_sec || 0;
  const hasWaypoints = customDirectedWaypoints.length > 0;
  const isSceneCompiled = Boolean(activeScene && activeScene.waypoints?.length === customDirectedWaypoints.length);

  return (
    <div
      style={{
        position: 'fixed',
        left: '86px',
        top: '16px',
        bottom: '16px',
        width: '380px',
        maxHeight: 'calc(100vh - 32px)',
        background: 'rgba(8, 14, 28, 0.96)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '20px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 28px rgba(56, 189, 248, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Bar: Pencil Toggle + Clear + Close */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isDirectRouteMode
                ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                : 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isDirectRouteMode
                ? '0 0 16px rgba(245, 158, 11, 0.5)'
                : '0 0 14px rgba(6, 182, 212, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            <Pencil size={18} color="#ffffff" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.01em' }}>
              Pencil Path Director
            </div>
            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
              Real Satellite 3D Environment
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {hasWaypoints && (
            <button
              onClick={onClearDirectedWaypoints}
              title="Clear Drawn Path"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Trash2 size={15} />
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
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
      </div>

      {/* 2. Primary Pencil Tool Toggle Button */}
      <div style={{ padding: '14px 18px 10px 18px' }}>
        <button
          id="btn-pencil-toggle"
          onClick={onToggleDirectRouteMode}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '12px',
            border: isDirectRouteMode
              ? '2px solid #f59e0b'
              : '1px solid rgba(56, 189, 248, 0.4)',
            background: isDirectRouteMode
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25) 0%, rgba(217, 119, 6, 0.35) 100%)'
              : 'linear-gradient(135deg, rgba(2, 132, 199, 0.2) 0%, rgba(6, 182, 212, 0.25) 100%)',
            color: isDirectRouteMode ? '#fef3c7' : '#e0f2fe',
            fontWeight: 800,
            fontSize: '0.86rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            cursor: 'pointer',
            boxShadow: isDirectRouteMode
              ? '0 0 20px rgba(245, 158, 11, 0.35), inset 0 0 10px rgba(245, 158, 11, 0.2)'
              : 'none',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <Pencil size={18} color={isDirectRouteMode ? '#f59e0b' : '#38bdf8'} strokeWidth={2.5} />
          <span>
            {isDirectRouteMode ? '✏️ Pencil Active — Click Map to Plot' : '✏️ Activate Pencil Tool'}
          </span>
          <span
            style={{
              fontSize: '0.7rem',
              padding: '2px 8px',
              borderRadius: '6px',
              background: isDirectRouteMode ? '#f59e0b' : 'rgba(56, 189, 248, 0.25)',
              color: isDirectRouteMode ? '#000' : '#38bdf8',
              fontWeight: 900
            }}
          >
            {customDirectedWaypoints.length} pts
          </span>
        </button>

        {isDirectRouteMode && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: '0.72rem',
              color: '#fde68a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ fontSize: '0.9rem' }}>🎯</span>
            <span>Click anywhere on the satellite sidewalks/roads to add points along your route line.</span>
          </div>
        )}
      </div>

      {/* 3. Waypoint Cards List with Action Textboxes */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 18px 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {!hasWaypoints ? (
          <div
            style={{
              padding: '32px 18px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.4)',
              border: '1px dashed rgba(255, 255, 255, 0.15)',
              borderRadius: '14px',
              color: '#94a3b8',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8'
              }}
            >
              <Pencil size={20} />
            </div>
            <div>
              <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
                No Path Points Yet
              </div>
              <div style={{ fontSize: '0.74rem', lineHeight: 1.4 }}>
                Click the <strong>Activate Pencil Tool</strong> button above, then click on the satellite city map to plot your points.
              </div>
            </div>
          </div>
        ) : (
          customDirectedWaypoints.map((wp, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === customDirectedWaypoints.length - 1 && customDirectedWaypoints.length > 1;
            const ptLabel = isFirst ? 'Point 1 (Start)' : isLast ? `Point ${idx + 1} (Destination)` : `Point ${idx + 1}`;
            
            // Check if scene has AI-compiled metadata for this step
            const compiledStep = activeScene?.compiled_timeline?.[idx] || activeScene?.waypoints?.[idx];

            return (
              <div
                key={`wp-${idx}-${wp?.lat ?? 0}-${wp?.lng ?? 0}`}
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Point Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 7px',
                        borderRadius: '6px',
                        background: isFirst
                          ? 'rgba(56, 189, 248, 0.2)'
                          : isLast
                          ? 'rgba(16, 185, 129, 0.2)'
                          : 'rgba(245, 158, 11, 0.2)',
                        color: isFirst ? '#38bdf8' : isLast ? '#10b981' : '#f59e0b',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        fontFamily: 'monospace'
                      }}
                    >
                      {ptLabel}
                    </span>
                    <span style={{ fontSize: '0.64rem', color: '#64748b', fontFamily: 'monospace' }}>
                      {wp?.lat != null ? Number(wp.lat).toFixed(4) : '0.0000'}°, {wp?.lng != null ? Number(wp.lng).toFixed(4) : '0.0000'}°
                    </span>
                  </div>

                  <button
                    onClick={() => onRemoveDirectWaypoint(idx)}
                    title="Remove Waypoint"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px'
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* The Action Textbox on the line */}
                <div>
                  <textarea
                    rows={2}
                    value={wp.prompt || ''}
                    onChange={(e) => {
                      const newPrompt = e.target.value;
                      const detected = inferActionFromPrompt(newPrompt, isFirst ? 'SPAWN' : 'WALK');
                      onUpdateDirectWaypoint(idx, { prompt: newPrompt, action: detected });
                    }}
                    placeholder={
                      isFirst
                        ? 'Describe initial character action (e.g. spawn and scan surroundings)'
                        : 'Describe movement / action to this location (e.g. wave hi, walk along sidewalk, inspect entrance)'
                    }
                    style={{
                      width: '100%',
                      background: 'rgba(2, 6, 23, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      color: '#f8fafc',
                      fontSize: '0.78rem',
                      fontFamily: 'inherit',
                      lineHeight: 1.35,
                      resize: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* AI-compiled telemetry badge with live detected action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.68rem',
                    background: 'rgba(2, 6, 23, 0.55)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(56, 189, 248, 0.22)',
                    color: '#94a3b8'
                  }}
                >
                  <span style={{ color: '#38bdf8', fontWeight: 800 }}>
                    ⚡ AI Action: {wp.action || (compiledStep?.action) || inferActionFromPrompt(wp.prompt, isFirst ? 'SPAWN' : 'WALK')}
                  </span>
                  <span style={{ color: '#cbd5e1', fontFamily: 'monospace' }}>
                    {compiledStep?.speed_mps !== undefined ? `${compiledStep.speed_mps} m/s` : ''}
                    {compiledStep?.duration_sec !== undefined ? ` • ${compiledStep.duration_sec}s` : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. AI Compilation Status & Engine Note */}
      <div
        style={{
          padding: '8px 18px',
          background: 'rgba(15, 23, 42, 0.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.7rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8' }}>
          <Sparkles size={13} />
          <span style={{ fontWeight: 700 }}>Groq AI Choreographer</span>
        </div>
        <span style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.64rem' }}>
          qwen/qwen3.8-27b
        </span>
      </div>

      {/* 5. Playback Timeline Scrubber (when compiled) */}
      {totalDuration > 0 && (
        <div style={{ padding: '8px 18px 4px 18px', background: 'rgba(10, 16, 32, 0.7)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.68rem', color: '#94a3b8', marginBottom: '4px' }}>
            <span style={{ fontFamily: 'monospace', color: '#38bdf8', fontWeight: 700 }}>
              {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
            </span>
            <span style={{ fontSize: '0.64rem', color: '#64748b' }}>
              60 FPS Biomechanics
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '4px',
              background: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                width: `${Math.min(100, (currentTime / totalDuration) * 100)}%`,
                height: '100%',
                background: isRecordingVideo
                  ? '#ef4444'
                  : 'linear-gradient(90deg, #38bdf8, #10b981)',
                transition: 'width 0.05s linear'
              }}
            />
          </div>
        </div>
      )}

      {/* 6. The Two Core Action Buttons: TEST & RECORD */}
      <div
        style={{
          padding: '14px 18px 18px 18px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.9)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {/* BUTTON A: TEST MOVEMENT */}
          <button
            id="btn-test-movement"
            disabled={!hasWaypoints || isGenerating || isRecordingVideo}
            onClick={() => {
              if (isPlaying) {
                onTogglePlay?.();
              } else {
                // Testing movement: compile if needed, keep camera in FREE mode so user can freely monitor robot from any angle!
                onChangeCameraMode?.('free');
                onCompileAndDirect?.({ mode: 'test' });
              }
            }}
            style={{
              padding: '13px 10px',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.5)',
              background: isPlaying && !isRecordingVideo
                ? 'rgba(245, 158, 11, 0.25)'
                : 'linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(6, 182, 212, 0.4) 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: !hasWaypoints || isGenerating || isRecordingVideo ? 'not-allowed' : 'pointer',
              opacity: !hasWaypoints || isGenerating || isRecordingVideo ? 0.5 : 1,
              boxShadow: isPlaying && !isRecordingVideo
                ? '0 0 16px rgba(245, 158, 11, 0.4)'
                : '0 4px 14px rgba(6, 182, 212, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {isPlaying && !isRecordingVideo ? (
              <>
                <Pause size={16} />
                <span>Pause Test</span>
              </>
            ) : (
              <>
                <Play size={16} fill="#ffffff" />
                <span>Test Movement</span>
              </>
            )}
          </button>

          {/* BUTTON B: RECORD (MP4) */}
          <button
            id="btn-record-mp4"
            disabled={!hasWaypoints || isGenerating}
            onClick={() => {
              if (isRecordingVideo) {
                onStopRecording?.();
              } else {
                // Recording: engage dynamic camera angles & track robot, export MP4
                onChangeCameraMode?.('auto_director');
                onStartRecording?.();
              }
            }}
            style={{
              padding: '13px 10px',
              borderRadius: '12px',
              border: isRecordingVideo
                ? '2px solid #ef4444'
                : '1px solid rgba(239, 68, 68, 0.55)',
              background: isRecordingVideo
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(185, 28, 28, 0.9) 100%)'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.3) 0%, rgba(220, 38, 38, 0.4) 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: !hasWaypoints || isGenerating ? 'not-allowed' : 'pointer',
              opacity: !hasWaypoints || isGenerating ? 0.5 : 1,
              boxShadow: isRecordingVideo
                ? '0 0 24px rgba(239, 68, 68, 0.7)'
                : '0 4px 14px rgba(239, 68, 68, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            {isRecordingVideo ? (
              <>
                <span
                  style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: '#ffffff',
                    animation: 'pulse 1s infinite'
                  }}
                />
                <span>Stop & Export</span>
              </>
            ) : (
              <>
                <Video size={16} />
                <span>Record (MP4)</span>
              </>
            )}
          </button>
        </div>

        {/* Small Mode Helper Text */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.66rem', color: '#64748b' }}>
          <span>• Test: Free manual camera</span>
          <span>• Record: Cinematic auto angles</span>
        </div>
      </div>
    </div>
  );
}
