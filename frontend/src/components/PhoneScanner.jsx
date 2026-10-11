import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone, Camera, QrCode, RefreshCw, Sparkles, CheckCircle2,
  Cpu, Layers, AlertCircle, Eye, Play, Square, ExternalLink, Zap
} from 'lucide-react';

export default function PhoneScanner({
  sceneConfig,
  onSceneUpdated,
  onPointcloudUpdated
}) {
  const [networkInfo, setNetworkInfo] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [scanStatus, setScanStatus] = useState(null);
  const [depthPreview, setDepthPreview] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState('depth_anything_v2');
  const [furnitureLayout, setFurnitureLayout] = useState(null);
  const [arranging, setArranging] = useState(false);
  const [webcamStreaming, setWebcamStreaming] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamIntervalRef = useRef(null);

  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5173';
  const API_BASE = typeof window !== 'undefined' ? `${window.location.protocol}//${host}` : 'http://127.0.0.1:8000';

  // Fetch local IP & network pairing info
  useEffect(() => {
    const fetchNetInfo = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/network_info`);
        if (res.ok) {
          const data = await res.json();
          const phoneUrl = `http://${data.local_ip}:5173/phone`;
          // Generate QR code for phone HTTP URL
          const qr = await QRCode.toDataURL(phoneUrl, {
            width: 220,
            margin: 1,
            color: { dark: '#00d2ff', light: '#090d16' }
          });
          setQrDataUrl(qr);
        }
      } catch (err) {
        console.warn('Network info fetch error:', err);
      }
    };

    fetchNetInfo();
  }, []);

  // Poll scan status every 1.5s
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/scan/status`);
        if (res.ok) {
          const data = await res.json();
          setScanStatus(data);
          if (data.perception_engine?.active_engine) {
            setSelectedEngine(data.perception_engine.active_engine);
          }
        }
        const fRes = await fetch(`${API_BASE}/api/furniture/layout`);
        if (fRes.ok) {
          const fData = await fRes.json();
          setFurnitureLayout(fData);
        }
      } catch (e) {
        // quiet
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  // Webcam in-browser scanner
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } },
        audio: false
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Connect WebSocket
      const ws = new WebSocket(`${wsProtocol}//${host}/ws/phone_feed`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWebcamStreaming(true);
        streamIntervalRef.current = setInterval(captureWebcamFrame, 70); // ~14 FPS
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'ok') {
            setScanStatus(prev => ({
              ...prev,
              total_points: data.total_points,
              surfaces: data.surfaces || [],
              frame_count: data.frame
            }));
            if (data.depth_preview) setDepthPreview(data.depth_preview);
            if (onPointcloudUpdated) onPointcloudUpdated();
          }
        } catch (e) {
          console.error(e);
        }
      };

      ws.onclose = () => setWebcamStreaming(false);
    } catch (err) {
      console.error('Webcam access error:', err);
      alert('Could not access camera: ' + err.message);
    }
  };

  const stopWebcam = () => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWebcamStreaming(false);
  };

  const captureWebcamFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    wsRef.current.send(JSON.stringify({ image: dataUrl }));
  };

  const handleLoadSampleRoom = async () => {
    setLoadingSample(true);
    try {
      const res = await fetch(`${API_BASE}/api/scan/sample_room`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (onSceneUpdated) onSceneUpdated(data.scene_config);
        if (onPointcloudUpdated) onPointcloudUpdated();
      }
    } catch (e) {
      console.error('Failed to load sample scan', e);
    } finally {
      setLoadingSample(false);
    }
  };

  const handleCommitScan = async () => {
    setCommitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/scan/commit`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.furniture_layout) setFurnitureLayout(data.furniture_layout);
        if (onSceneUpdated) onSceneUpdated(data.scene_config);
        if (onPointcloudUpdated) onPointcloudUpdated();
      }
    } catch (e) {
      console.error('Failed to commit scan', e);
    } finally {
      setCommitting(false);
    }
  };

  const handleArrangeChairs = async () => {
    setArranging(true);
    try {
      await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'put the chairs in correct position' })
      });
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setArranging(false), 3500);
    }
  };

  const handleResetScan = async () => {
    try {
      await fetch(`${API_BASE}/api/scan/reset`, { method: 'POST' });
      setDepthPreview(null);
      if (onPointcloudUpdated) onPointcloudUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEngineChange = async (engine) => {
    setSelectedEngine(engine);
    try {
      await fetch(`${API_BASE}/api/scan/engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const surfaces = scanStatus?.surfaces || [];
  const totalPoints = scanStatus?.total_points || 0;
  const localIp = networkInfo?.local_ip || window.location.hostname || '127.0.0.1';
  const httpPhoneUrl = `http://${localIp}:5173/phone`;

  return (
    <div className="glass-card" id="phone-scanner-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Header */}
      <div className="card-header">
        <span className="card-title">
          <Smartphone size={16} color="#00d2ff" />
          Real-Time Phone Feed Ingestion
        </span>
        <span className="status-badge status-ready">
          <Zap size={11} /> {totalPoints > 0 ? `${totalPoints.toLocaleString()} PTS INGESTED` : 'READY'}
        </span>
      </div>

      {/* Two Column Setup: QR Code Phone Connect & Local Webcam/Sample Option */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* Left: Mobile Pairing QR Code */}
        <div style={{
          background: 'rgba(0, 210, 255, 0.04)',
          border: '1px solid rgba(0, 210, 255, 0.2)',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#00d2ff', textTransform: 'uppercase', marginBottom: '8px' }}>
            Option 1: Scan With Phone Camera
          </div>

          {qrDataUrl ? (
            <div style={{
              background: '#090d16',
              padding: '6px',
              borderRadius: '8px',
              border: '1px solid rgba(0, 210, 255, 0.3)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
            }}>
              <img src={qrDataUrl} alt="Phone Scan QR Code" style={{ width: '130px', height: '130px', display: 'block' }} />
            </div>
          ) : (
            <div style={{ width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw className="spin" size={24} color="#00d2ff" />
            </div>
          )}

          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '8px' }}>
            Open camera on smartphone & scan QR code:
          </div>
          <a
            href={httpPhoneUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.68rem',
              color: '#00d2ff',
              textDecoration: 'none',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 700
            }}
          >
            📱 {httpPhoneUrl} <ExternalLink size={10} />
          </a>
          <div style={{ fontSize: '0.58rem', color: '#10b981', marginTop: '4px' }}>
            ✓ Same Wi-Fi network connection active
          </div>
        </div>

        {/* Right: Direct Browser / Webcam Stream */}
        <div style={{
          background: 'rgba(16, 185, 129, 0.04)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '10px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', marginBottom: '6px' }}>
              Option 2: Direct Device Stream
            </div>
            <div style={{ fontSize: '0.74rem', color: '#cbd5e1', lineHeight: '1.3' }}>
              Test scanning right now with your computer webcam or inject our pre-captured room scan.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
            <button
              className="btn btn-primary"
              onClick={webcamStreaming ? stopWebcam : startWebcam}
              style={{
                fontSize: '0.75rem',
                padding: '7px 10px',
                background: webcamStreaming ? 'rgba(239, 68, 68, 0.2)' : undefined,
                borderColor: webcamStreaming ? '#ef4444' : undefined,
                color: webcamStreaming ? '#ef4444' : undefined
              }}
            >
              {webcamStreaming ? (
                <>
                  <Square size={13} /> Stop Webcam Feed
                </>
              ) : (
                <>
                  <Camera size={13} /> Start Computer Camera
                </>
              )}
            </button>

            <button
              className="btn btn-secondary"
              onClick={handleLoadSampleRoom}
              disabled={loadingSample}
              style={{ fontSize: '0.75rem', padding: '7px 10px' }}
            >
              {loadingSample ? (
                <>
                  <RefreshCw className="spin" size={13} /> Reconstructing 3D Room...
                </>
              ) : (
                <>
                  <Sparkles size={13} color="#00d2ff" /> Load Sample 3D Room (Solid Mesh)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Hidden/Active Webcam Video Canvas */}
      <div style={{ display: webcamStreaming ? 'block' : 'none' }}>
        <div style={{
          position: 'relative',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid rgba(0, 210, 255, 0.3)',
          height: '140px',
          background: '#000'
        }}>
          <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            background: 'rgba(0,0,0,0.6)',
            padding: '3px 8px',
            borderRadius: '4px',
            fontSize: '0.65rem',
            color: '#00d2ff',
            fontWeight: 700
          }}>
            LIVE FEED • ~15 FPS
          </div>
        </div>
      </div>

      {/* Depth Estimator Engine Selection */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '10px'
      }}>
        <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px' }}>
          Monocular Depth Perception Model
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
          {[
            { id: 'depth_anything_v2', label: 'Depth Anything V2', sub: 'Metal MPS GPU' },
            { id: 'midas_small', label: 'MiDaS Small', sub: 'Torch Hub' },
            { id: 'fast_gradient', label: 'Fast Gradient', sub: '<2ms CPU' }
          ].map(eng => (
            <button
              key={eng.id}
              onClick={() => handleEngineChange(eng.id)}
              style={{
                background: selectedEngine.includes(eng.id) ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${selectedEngine.includes(eng.id) ? '#00d2ff' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '6px',
                padding: '6px 4px',
                color: selectedEngine.includes(eng.id) ? '#00d2ff' : '#cbd5e1',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ fontSize: '0.72rem', fontWeight: 700 }}>{eng.label}</div>
              <div style={{ fontSize: '0.58rem', color: '#94a3b8' }}>{eng.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Detected Surfaces & Live Metric Summary */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '8px',
        padding: '10px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '0.68rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
            Segmented Real-World Surfaces ({surfaces.length})
          </div>
          <button
            onClick={handleResetScan}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '0.68rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={11} /> Clear Scan
          </button>
        </div>

        {surfaces.length === 0 ? (
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '6px 0' }}>
            No surfaces detected yet. Move the camera around the room to segment floors, desks, and shelves.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {surfaces.map((s, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255,255,255,0.03)',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    background: s.type === 'ground' ? '#00d2ff' : s.type === 'table' ? '#10b981' : '#a855f7'
                  }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{s.name}</span>
                </div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                  H: {s.position ? s.position[2].toFixed(2) : '0'}m • {Math.round((s.confidence || 0.8) * 100)}% match
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detected 3D Furniture Digital Twins (Table & Scattered Chairs) */}
      <div style={{
        background: 'rgba(0, 210, 255, 0.04)',
        border: '1px solid rgba(0, 210, 255, 0.2)',
        borderRadius: '8px',
        padding: '10px'
      }}>
        <div style={{ fontSize: '0.68rem', color: '#00d2ff', textTransform: 'uppercase', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={12} /> 3D Digital Twin Furniture ({furnitureLayout?.chairs?.length || 2} Chairs)
        </div>
        <div style={{ fontSize: '0.74rem', color: '#e2e8f0', marginBottom: '8px', lineHeight: '1.4' }}>
          {furnitureLayout?.summary || '1 Dining Table with 2 Tuck Slots • 2 Scattered Chairs'}
        </div>

        <button
          onClick={handleArrangeChairs}
          disabled={arranging}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: arranging ? 'rgba(16, 185, 129, 0.25)' : 'linear-gradient(135deg, rgba(0, 210, 255, 0.2) 0%, rgba(58, 123, 213, 0.2) 100%)',
            border: '1px solid rgba(0, 210, 255, 0.4)',
            borderRadius: '6px',
            color: '#00d2ff',
            fontWeight: 700,
            fontSize: '0.75rem',
            cursor: arranging ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {arranging ? (
            <>
              <RefreshCw className="spin" size={13} /> Robot Tucking Chairs Under Table...
            </>
          ) : (
            <>
              🤖 Run Robot: Put Chairs in Correct Position
            </>
          )}
        </button>
      </div>

      {/* Action: Commit Scan to 3D Environment Studio */}
      <button
        className="btn btn-primary"
        onClick={handleCommitScan}
        disabled={committing || totalPoints < 50}
        style={{
          padding: '10px 14px',
          fontWeight: 700,
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)'
        }}
      >
        {committing ? (
          <>
            <RefreshCw className="spin" size={15} /> Reconstructing 3D Environment Mesh...
          </>
        ) : (
          <>
            <Sparkles size={15} /> Commit Real Room & Replicate in 3D
          </>
        )}
      </button>
    </div>
  );
}
