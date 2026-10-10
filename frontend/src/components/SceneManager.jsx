import React, { useState } from 'react';
import { Upload, Box, Layers, Eye, Check, RefreshCw } from 'lucide-react';

export default function SceneManager({
  sceneConfig,
  showCollisions,
  setShowCollisions,
  onUpdateObject,
  onResetScene
}) {
  const [selectedObjectId, setSelectedObjectId] = useState('water_bottle_1');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploading, setUploading] = useState(false);

  const objects = sceneConfig?.objects || [];
  const visualScan = sceneConfig?.visual_scan || {};

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/upload_scan', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setUploadStatus(`Success: Uploaded ${data.filename}`);
    } catch (err) {
      setUploadStatus('Upload failed. Check server connection.');
    } finally {
      setUploading(false);
    }
  };

  const selectedObj = objects.find(o => o.id === selectedObjectId);

  const handleCoordChange = (axisIndex, newVal) => {
    if (!selectedObj) return;
    const pos = [...(selectedObj.position || [0, 0, 0])];
    pos[axisIndex] = parseFloat(newVal);
    onUpdateObject(selectedObj.id, pos);
  };

  return (
    <div className="glass-card" id="scene-manager-card">
      <div className="card-header">
        <span className="card-title">
          <Layers size={16} color="#00d2ff" />
          Two-Layer Environment Model
        </span>
        <button
          className="btn"
          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
          onClick={onResetScene}
          id="btn-reset-scene-props"
        >
          <RefreshCw size={12} /> Reset
        </button>
      </div>

      {/* Layer Architecture Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <div style={{
          background: 'rgba(0, 210, 255, 0.05)',
          border: '1px solid rgba(0, 210, 255, 0.2)',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
            Layer 1: Visual Mesh
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px' }}>
            {visualScan.mesh_filename || 'room_scan.glb'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Source: {visualScan.source || 'Polycam LiDAR'}
          </div>
        </div>

        <div style={{
          background: 'rgba(16, 185, 129, 0.05)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          borderRadius: '8px',
          padding: '10px'
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--accent-emerald)', fontWeight: 700, textTransform: 'uppercase' }}>
            Layer 2: Physics Shapes
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px' }}>
            {objects.length} Collision Geoms
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            MuJoCo Contact Primitives
          </div>
        </div>
      </div>

      {/* Collision Wireframe Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
          <Box size={16} color={showCollisions ? '#00d2ff' : 'var(--text-muted)'} />
          <span>Show Physics Collision Wireframes</span>
        </div>
        <input
          type="checkbox"
          checked={showCollisions}
          onChange={(e) => setShowCollisions(e.target.checked)}
          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
          id="toggle-collision-wireframes"
        />
      </div>

      {/* Phone Scan Upload Box */}
      <div style={{
        border: '1px dashed rgba(255, 255, 255, 0.15)',
        borderRadius: '8px',
        padding: '12px',
        textAlign: 'center',
        background: 'rgba(13, 18, 29, 0.4)'
      }}>
        <Upload size={20} color="var(--accent-cyan)" style={{ margin: '0 auto 6px' }} />
        <div style={{ fontSize: '0.78rem', fontWeight: 600 }}>Import Phone 3D Room Scan</div>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
          Accepts Polycam / LiDAR (.gltf, .glb, .obj)
        </div>
        <label className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
          <input
            type="file"
            accept=".gltf,.glb,.obj"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            id="file-scan-upload"
          />
          {uploading ? 'Processing Scan...' : 'Upload Phone Scan'}
        </label>
        {uploadStatus && (
          <div style={{ fontSize: '0.72rem', color: 'var(--accent-emerald)', marginTop: '6px' }}>
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Object Registry & Coordinate Adjuster */}
      <div>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
          Scene Object Coordinates & Affordances
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {objects.map(obj => (
            <div
              key={obj.id}
              className="object-item"
              style={{
                borderColor: selectedObjectId === obj.id ? 'var(--accent-cyan)' : 'var(--border-subtle)',
                background: selectedObjectId === obj.id ? 'rgba(0, 210, 255, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer'
              }}
              onClick={() => setSelectedObjectId(obj.id)}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{obj.name}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Type: {obj.geometry} | {obj.movable ? 'Movable' : 'Static'}
                </div>
              </div>
              <div className="object-coords">
                [{obj.position ? obj.position.map(n => n.toFixed(2)).join(', ') : '0, 0, 0'}]
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coordinate Fine-tuner for Selected Object */}
      {selectedObj && (
        <div style={{
          background: 'rgba(13, 18, 29, 0.7)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '12px'
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
            Fine-tune {selectedObj.name} Position (Meters)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>X (Forward)</label>
              <input
                type="number"
                step="0.05"
                value={selectedObj.position?.[0] ?? 0}
                onChange={(e) => handleCoordChange(0, e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Y (Lateral)</label>
              <input
                type="number"
                step="0.05"
                value={selectedObj.position?.[1] ?? 0}
                onChange={(e) => handleCoordChange(1, e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Z (Height)</label>
              <input
                type="number"
                step="0.05"
                value={selectedObj.position?.[2] ?? 0}
                onChange={(e) => handleCoordChange(2, e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  padding: '4px 6px',
                  borderRadius: '4px',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
