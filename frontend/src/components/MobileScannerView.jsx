import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  RefreshCw, CheckCircle2, AlertCircle,
  Wifi, Sparkles, Smartphone, ArrowLeft,
  Zap, Play, Square, Video
} from 'lucide-react';

export default function MobileScannerView({ onBackToDashboard }) {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Live stream & connection states
  const [streaming, setStreaming] = useState(false);
  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState({ total_points: 0, frame_number: 0, surfaces: [] });
  const [depthPreview, setDepthPreview] = useState(null);
  const [orientationData, setOrientationData] = useState({ pitch: -22, yaw: 0, roll: 0 });
  const [cameraError, setCameraError] = useState(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [httpsRedirectUrl, setHttpsRedirectUrl] = useState(null);

  // 6-DoF Odometry & Spatial Anchors
  const [cameraPose, setCameraPose] = useState({ position: [0.0, 0.0, 1.25], rotation: { pitch: -22, yaw: 0, roll: 0 } });
  const [motionState, setMotionState] = useState('TRACKING');
  const [spatialAnchors, setSpatialAnchors] = useState([]);

  // Mobile View Modes: 'SPLIT' (Camera + 3D Render) | 'CAMERA' | '3D_ONLY'
  const [mobileDisplayMode, setMobileDisplayMode] = useState('SPLIT');

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const orientationRef = useRef({ pitch: -22, yaw: 0, roll: 0 });

  // 3D Canvas Mount Ref
  const threeMountRef = useRef(null);
  const threeSceneRef = useRef(null);
  const threeCameraRef = useRef(null);
  const threeRendererRef = useRef(null);
  const threeObjectsGroupRef = useRef(null);

  // URLs
  const host = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:5173';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const backendWsUrl = `${wsProtocol}//${host}/ws/phone_feed`;
  const backendHttpUrl = `${window.location.protocol}//${host}`;

  // Fetch HTTPS redirect URL if available
  useEffect(() => {
    fetch(`${backendHttpUrl}/api/network_info`)
      .then(res => res.json())
      .then(data => {
        if (data.phone_https_url) {
          setHttpsRedirectUrl(data.phone_https_url);
        }
      })
      .catch(() => {});
  }, [backendHttpUrl]);


  // 1. Gyroscope orientation listener
  useEffect(() => {
    const handleOrientation = (e) => {
      if (e.beta !== null) {
        const cur = {
          pitch: Math.round(e.beta - 90),
          yaw: Math.round(e.alpha || 0),
          roll: Math.round(e.gamma || 0)
        };
        orientationRef.current = cur;
        setOrientationData(cur);
      }
    };

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', handleOrientation, true);
    }
    return () => {
      if (window.DeviceOrientationEvent) {
        window.removeEventListener('deviceorientation', handleOrientation, true);
      }
    };
  }, []);

  // 2. Initialize Clean 3D Canvas (NO fake table, NO random phone marker)
  useEffect(() => {
    const mount = threeMountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 320;
    const height = mount.clientHeight || 240;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06090e);
    scene.fog = new THREE.FogExp2(0x06090e, 0.015);
    threeSceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.05, 50);
    camera.position.set(0.0, 1.8, 2.8);
    camera.lookAt(0.0, 0.5, 0.0);
    threeCameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    threeRendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    // Studio Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 1.3);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(2, 5, -1);
    scene.add(dirLight);

    const cyanLight = new THREE.PointLight(0x00d2ff, 1.2, 8);
    cyanLight.position.set(0.0, 1.8, 0.0);
    scene.add(cyanLight);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(12, 24, 0x00d2ff, 0x1e293b);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // Dynamic Objects Group for real detected geometry only
    const objGroup = new THREE.Group();
    scene.add(objGroup);
    threeObjectsGroupRef.current = objGroup;

    // Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const w = mount.clientWidth || 320;
      const h = mount.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (mount && renderer.domElement) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mobileDisplayMode]);

  // 3. Render only genuine detected anchors from live scan (no hardcoded fake table/phone)
  useEffect(() => {
    const group = threeObjectsGroupRef.current;
    if (!group) return;

    // Clear prior
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }

    const tableMat = new THREE.MeshStandardMaterial({ color: 0x483524, roughness: 0.4 });
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x222832, roughness: 0.5 });
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x5c4028, roughness: 0.4 });

    // Render only REAL spatial anchors received from backend perception
    spatialAnchors.forEach((anc) => {
      const pos = anc.position || [0, 0, 0];
      if (anc.type === 'table') {
        const table = new THREE.Group();
        table.position.set(pos[0], 0, pos[1]);
        const topMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.8), tableMat);
        topMesh.position.y = (anc.surface_height || 0.74) - 0.025;
        table.add(topMesh);
        group.add(table);
      } else if (anc.type === 'chair') {
        const chair = new THREE.Group();
        chair.position.set(pos[0], 0, pos[1]);
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.44), chairMat);
        seat.position.y = 0.42;
        chair.add(seat);
        group.add(chair);
      } else if (anc.type === 'door') {
        const door = new THREE.Group();
        door.position.set(pos[0], 0, pos[1]);
        const dMesh = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.10, 0.04), doorMat);
        dMesh.position.y = 1.05;
        door.add(dMesh);
        group.add(door);
      }
    });
  }, [spatialAnchors]);

  const streamingRef = useRef(false);
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  // 4. WebSocket setup for continuous live video frames
  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(backendWsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        if (streamingRef.current && !streamIntervalRef.current) {
          streamIntervalRef.current = setInterval(captureAndSendFrame, 65);
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.status === 'ok') {
            setStats({
              total_points: data.total_points,
              frame_number: data.frame,
              surfaces: data.surfaces || []
            });
            if (data.depth_preview) setDepthPreview(data.depth_preview);
            if (data.camera_pose) setCameraPose(data.camera_pose);
            if (data.motion_state) setMotionState(data.motion_state);
            if (data.spatial_anchors) setSpatialAnchors(data.spatial_anchors);
          }
        } catch (e) {
          console.error('Error parsing WS frame response', e);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (streamingRef.current) {
          setTimeout(connectWebSocket, 1000);
        }
      };
      ws.onerror = () => setConnected(false);
    } catch (e) {
      console.error('Could not create WebSocket:', e);
    }
  };

  // 5. Start Real-Time Live Camera Feed
  const startCamera = async () => {
    setCameraError(null);
    try {
      let stream = null;

      // Prefer rear environment camera
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 24 }
        },
        audio: false
      };

      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (e1) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      } else if (navigator?.getUserMedia) {
        stream = await new Promise((res, rej) => navigator.getUserMedia({ video: true }, res, rej));
      } else if (navigator?.webkitGetUserMedia) {
        stream = await new Promise((res, rej) => navigator.webkitGetUserMedia({ video: true }, res, rej));
      }

      if (!stream) {
        throw new Error('Camera access not supported. If on iPhone/Android, open via HTTPS.');
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('autoplay', 'true');
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      setStreaming(true);
      connectWebSocket();

      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      // Stream frames at ~15 FPS continuously
      streamIntervalRef.current = setInterval(captureAndSendFrame, 65);
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError(err.message || 'Permission denied or insecure connection');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setStreaming(false);
  };

  const captureAndSendFrame = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;
    ctx.drawImage(video, 0, 0, 320, 240);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
    const payload = {
      image: dataUrl,
      orientation: orientationRef.current
    };
    wsRef.current.send(JSON.stringify(payload));
  };

  // Auto-start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const handleCommitScan = async () => {
    try {
      setIsCommitting(true);
      const res = await fetch(`${backendHttpUrl}/api/scan/commit`, { method: 'POST' });
      if (res.ok) {
        setCommitted(true);
      }
    } catch (e) {
      console.error('Commit error:', e);
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#07090e',
      color: '#fff',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Mobile Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'rgba(10, 15, 25, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                padding: '6px',
                cursor: 'pointer'
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '0.05em' }}>
            ROBO<span style={{ color: '#00d2ff' }}>TWIN</span> LIVE CAMERA
          </span>
        </div>

        {/* View Mode Switcher */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: '8px',
          padding: '2px'
        }}>
          {['SPLIT', 'CAMERA', '3D_ONLY'].map(mode => (
            <button
              key={mode}
              onClick={() => setMobileDisplayMode(mode)}
              style={{
                background: mobileDisplayMode === mode ? '#00d2ff' : 'transparent',
                color: mobileDisplayMode === mode ? '#07090e' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.65rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>

        {/* Camera Feed Section (Visible in SPLIT or CAMERA mode) */}
        {(mobileDisplayMode === 'SPLIT' || mobileDisplayMode === 'CAMERA') && (
          <div style={{
            position: 'relative',
            flex: mobileDisplayMode === 'SPLIT' ? '0 0 50%' : '1 1 100%',
            background: '#000',
            overflow: 'hidden',
            borderBottom: mobileDisplayMode === 'SPLIT' ? '2px solid rgba(0, 210, 255, 0.3)' : 'none'
          }}>
            {/* Live Video Element */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: streaming ? 'block' : 'none'
              }}
            />

            {/* If not streaming yet, show Start Live Stream button */}
            {!streaming && (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                textAlign: 'center',
                background: '#05070d'
              }}>
                <Video size={42} color="#00d2ff" style={{ marginBottom: '14px' }} />
                <div style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '8px' }}>
                  Real-Time Live Video Feed
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '280px', marginBottom: '18px', lineHeight: 1.45 }}>
                  Continuous video stream to map surfaces and reconstruct your room in 3D.
                </div>

                {cameraError && (
                  <div style={{
                    color: '#f87171',
                    fontSize: '0.74rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    maxWidth: '320px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontWeight: 700 }}>⚠️ {cameraError}</div>
                    <div style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                      iOS Safari and Android Chrome disable camera access on plain HTTP addresses.
                    </div>
                    {httpsRedirectUrl && (
                      <a
                        href={httpsRedirectUrl}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          textDecoration: 'none',
                          padding: '10px 16px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          marginTop: '4px',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                        }}
                      >
                        🔒 Switch to Secure HTTPS (Camera Ready)
                      </a>
                    )}
                  </div>
                )}

                <button
                  onClick={startCamera}
                  style={{
                    background: 'linear-gradient(135deg, #00d2ff, #0077ff)',
                    color: '#07090e',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '12px 24px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(0, 210, 255, 0.35)'
                  }}
                >
                  <Play size={16} fill="#07090e" /> Start Live Camera Stream
                </button>
              </div>
            )}

            {/* Depth Preview overlay thumbnail */}
            {streaming && depthPreview && (
              <div style={{
                position: 'absolute',
                bottom: '12px',
                right: '12px',
                width: '100px',
                height: '75px',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid rgba(0, 210, 255, 0.5)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                background: '#000'
              }}>
                <img src={depthPreview} alt="Depth map" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  left: '4px',
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  color: '#00d2ff'
                }}>
                  DEPTH MAP
                </span>
              </div>
            )}

            {/* Active streaming badge */}
            {streaming && (
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(8px)',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                color: '#10b981'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                STREAMING LIVE
              </div>
            )}
          </div>
        )}

        {/* 3D Digital Twin Render View (Visible in SPLIT or 3D_ONLY mode) */}
        {(mobileDisplayMode === 'SPLIT' || mobileDisplayMode === '3D_ONLY') && (
          <div style={{
            position: 'relative',
            flex: mobileDisplayMode === 'SPLIT' ? '0 0 50%' : '1 1 100%',
            background: '#06090e'
          }}>
            <div ref={threeMountRef} style={{ width: '100%', height: '100%' }} />

            {/* Real-time stats overlay */}
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              display: 'flex',
              gap: '6px',
              zIndex: 10
            }}>
              <div style={{
                background: 'rgba(10, 15, 25, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.68rem',
                color: '#94a3b8'
              }}>
                Points: <strong style={{ color: '#00d2ff' }}>{stats.total_points.toLocaleString()}</strong>
              </div>
              <div style={{
                background: 'rgba(10, 15, 25, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                padding: '5px 10px',
                fontSize: '0.68rem',
                color: '#94a3b8'
              }}>
                Surfaces: <strong style={{ color: '#10b981' }}>{stats.surfaces.length}</strong>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Bottom Floating Bar */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(10, 15, 25, 0.95)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {streaming ? (
            <button
              onClick={stopCamera}
              style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Square size={13} fill="#f87171" /> Stop Stream
            </button>
          ) : (
            <button
              onClick={startCamera}
              style={{
                background: 'linear-gradient(135deg, #00d2ff, #0077ff)',
                color: '#07090e',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '0.74rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <Play size={13} fill="#07090e" /> Start Stream
            </button>
          )}
        </div>

        <button
          onClick={handleCommitScan}
          disabled={isCommitting || committed}
          style={{
            background: committed ? '#10b981' : 'linear-gradient(135deg, #10b981, #059669)',
            border: 'none',
            color: '#fff',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '0.74rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: committed ? 'default' : 'pointer',
            opacity: isCommitting ? 0.7 : 1
          }}
        >
          {committed ? (
            <>
              <CheckCircle2 size={14} /> Scan Saved!
            </>
          ) : (
            <>
              <Sparkles size={14} /> Commit Room Scan
            </>
          )}
        </button>
      </div>
    </div>
  );
}
