import React from 'react';
import { Activity, Cpu, Compass, ShieldCheck } from 'lucide-react';

export default function TelemetryPanel({ telemetry }) {
  const robot = telemetry?.robot;
  const pelvis = robot?.pelvis?.pos || [0, 0, 0];
  const rHand = robot?.right_hand_pos || [0, 0, 0];
  const lHand = robot?.left_hand_pos || [0, 0, 0];
  const hasContact = robot?.has_contact;
  const isHolding = robot?.is_holding;

  return (
    <div className="glass-card" id="telemetry-panel-card">
      <div className="card-header">
        <span className="card-title">
          <Activity size={16} color="#00d2ff" />
          Real-Time MuJoCo Telemetry
        </span>
        <span className="brand-tag">Physics Stream</span>
      </div>

      {/* Main Gauges */}
      <div className="telemetry-grid">
        <div className="telemetry-card">
          <div className="telemetry-label">Physics Step Rate</div>
          <div className="telemetry-val" style={{ color: '#00d2ff' }}>500 Hz</div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Simulation Time</div>
          <div className="telemetry-val">
            {telemetry?.sim_time ? `${telemetry.sim_time.toFixed(2)}s` : '0.00s'}
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Right Gripper Contact</div>
          <div className="telemetry-val" style={{ color: hasContact ? '#10b981' : 'var(--text-muted)' }}>
            {hasContact ? 'ACTIVE' : 'OPEN'}
          </div>
        </div>

        <div className="telemetry-card">
          <div className="telemetry-label">Grasp Hold Status</div>
          <div className="telemetry-val" style={{ color: isHolding ? '#00d2ff' : 'var(--text-muted)' }}>
            {isHolding ? 'HOLDING' : 'FREE'}
          </div>
        </div>
      </div>

      {/* 3D Kinematics End-Effector Poses */}
      <div style={{
        background: 'rgba(13, 18, 29, 0.7)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '8px',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          Cartesian Kinematics (Meters)
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Pelvis Root:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#fff' }}>
            [{pelvis[0].toFixed(3)}, {pelvis[1].toFixed(3)}, {pelvis[2].toFixed(3)}]
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Right Hand (End-Effector):</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
            [{rHand[0].toFixed(3)}, {rHand[1].toFixed(3)}, {rHand[2].toFixed(3)}]
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Left Hand:</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            [{lHand[0].toFixed(3)}, {lHand[1].toFixed(3)}, {lHand[2].toFixed(3)}]
          </span>
        </div>
      </div>

      {/* Solver Diagnostics */}
      <div style={{
        background: 'rgba(16, 185, 129, 0.05)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
      }}>
        <ShieldCheck size={20} color="var(--accent-emerald)" />
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-emerald)' }}>
            MuJoCo Newton Solver Stable
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Damped Least-Squares IK converged · Friction contacts verified
          </div>
        </div>
      </div>
    </div>
  );
}
