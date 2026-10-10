import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, Play, Pause, RotateCcw, FastForward,
  Layers, Terminal, Activity, Eye, ShieldCheck, Compass
} from 'lucide-react';

import Viewport3D from './components/Viewport3D';
import TaskConsole from './components/TaskConsole';
import SceneManager from './components/SceneManager';
import TelemetryPanel from './components/TelemetryPanel';

const API_BASE = 'http://127.0.0.1:8000';
const WS_URL = 'ws://127.0.0.1:8000/ws/stream';

export default function App() {
  const [telemetry, setTelemetry] = useState(null);
  const [sceneConfig, setSceneConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('PLANNER'); // PLANNER | SCENE | TELEMETRY
  const [cameraPreset, setCameraPreset] = useState('ORBIT'); // ORBIT | FOLLOW | DESK | SHELF
  const [showCollisions, setShowCollisions] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  // Fetch initial scene configuration
  const fetchScene = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/scene`);
      if (res.ok) {
        const data = await res.json();
        setSceneConfig(data.scene_config);
        if (data.telemetry) setTelemetry(data.telemetry);
      }
    } catch (err) {
      console.warn('Backend not ready yet, retrying...', err);
    }
  };

  useEffect(() => {
    fetchScene();

    // Establish WebSocket Connection for telemetry streaming
    const connectWs = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetry(data);
          if (typeof data.is_paused === 'boolean') {
            setIsPaused(data.is_paused);
          }
        } catch (e) {
          console.error('Error parsing telemetry JSON', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        setTimeout(connectWs, 2000); // Auto reconnect
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    };

    connectWs();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Execution Handlers
  const handleExecuteTask = async (prompt) => {
    try {
      const res = await fetch(`${API_BASE}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (res.ok) {
        const data = await res.json();
        // Update local plan immediately
        setTelemetry(prev => ({
          ...prev,
          task: {
            active: true,
            plan: data.plan,
            current_step: 0,
            completed: false,
            success: false,
            progress: 0,
            status_message: 'Executing planned skills in MuJoCo...'
          }
        }));
      }
    } catch (err) {
      console.error('Task execution request failed', err);
    }
  };

  const handleTogglePause = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/control/pause`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setIsPaused(data.paused);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    try {
      await fetch(`${API_BASE}/api/scene/reset`, { method: 'POST' });
      fetchScene();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpeedChange = async (mult) => {
    try {
      setSpeedMultiplier(mult);
      await fetch(`${API_BASE}/api/control/speed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: mult })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateObject = async (id, position) => {
    try {
      const res = await fetch(`${API_BASE}/api/scene/object`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, position })
      });
      if (res.ok) {
        fetchScene();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="robotwin-app">
      {/* Top Navigation Bar */}
      <header className="top-nav" id="top-navigation">
        <div className="brand-section">
          <div className="brand-icon">
            <Cpu size={20} color="#fff" />
          </div>
          <div className="brand-title">
            RoboTwin <span className="brand-tag">PHYSICS SIMULATOR</span>
          </div>
        </div>

        {/* Global Telemetry Chips */}
        <div className="nav-stats">
          <div className="stat-chip" id="chip-connection-status">
            <span
              className="status-dot"
              style={{
                background: wsConnected ? '#10b981' : '#f59e0b',
                boxShadow: wsConnected ? '0 0 8px #10b981' : '0 0 8px #f59e0b'
              }}
            />
            <span>{wsConnected ? 'LIVE STREAM (30 FPS)' : 'CONNECTING...'}</span>
          </div>
          <div className="stat-chip">
            <span>SOLVER: <strong style={{ color: '#00d2ff' }}>MuJoCo 3.15</strong></span>
          </div>
          <div className="stat-chip">
            <span>ROBOT: <strong style={{ color: '#fff' }}>29-DoF ARTICULATED</strong></span>
          </div>
        </div>

        {/* Playback & Sim Controls */}
        <div className="nav-actions">
          <button
            className={`btn ${isPaused ? 'btn-primary' : ''}`}
            onClick={handleTogglePause}
            id="btn-nav-pause-play"
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            className="btn btn-danger"
            onClick={handleReset}
            id="btn-nav-reset-sim"
          >
            <RotateCcw size={14} /> Reset
          </button>

          <div style={{ display: 'flex', gap: '2px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px' }}>
            {[0.5, 1.0, 2.0].map(s => (
              <button
                key={s}
                className={`btn ${speedMultiplier === s ? 'btn-active' : ''}`}
                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                onClick={() => handleSpeedChange(s)}
                id={`btn-speed-${s}x`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="workspace">
        {/* 3D Simulation Viewport */}
        <Viewport3D
          telemetry={telemetry}
          sceneConfig={sceneConfig}
          showCollisions={showCollisions}
          cameraPreset={cameraPreset}
          setCameraPreset={setCameraPreset}
        />

        {/* Right Sidebar Control Panel */}
        <aside className="sidebar" id="control-sidebar">
          {/* Navigation Tabs */}
          <div className="panel-tabs">
            <button
              className={`tab-btn ${activeTab === 'PLANNER' ? 'active' : ''}`}
              onClick={() => setActiveTab('PLANNER')}
              id="tab-task-planner"
            >
              <Terminal size={14} />
              AI Task Planner
            </button>
            <button
              className={`tab-btn ${activeTab === 'SCENE' ? 'active' : ''}`}
              onClick={() => setActiveTab('SCENE')}
              id="tab-scene-manager"
            >
              <Layers size={14} />
              2-Layer Scene
            </button>
            <button
              className={`tab-btn ${activeTab === 'TELEMETRY' ? 'active' : ''}`}
              onClick={() => setActiveTab('TELEMETRY')}
              id="tab-telemetry-panel"
            >
              <Activity size={14} />
              Telemetry
            </button>
          </div>

          {/* Active Tab Content */}
          <div className="panel-content">
            {activeTab === 'PLANNER' && (
              <TaskConsole
                telemetry={telemetry}
                onExecuteTask={handleExecuteTask}
              />
            )}

            {activeTab === 'SCENE' && (
              <SceneManager
                sceneConfig={sceneConfig}
                showCollisions={showCollisions}
                setShowCollisions={setShowCollisions}
                onUpdateObject={handleUpdateObject}
                onResetScene={handleReset}
              />
            )}

            {activeTab === 'TELEMETRY' && (
              <TelemetryPanel
                telemetry={telemetry}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
