import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Send, CheckCircle2, Play, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

export default function TaskConsole({ telemetry, onExecuteTask }) {
  const [prompt, setPrompt] = useState('Walk to the desk, pick up the bottle, and place it on the shelf');
  const [submitting, setSubmitting] = useState(false);

  const task = telemetry?.task;
  const plan = task?.plan;
  const currentStep = task?.current_step ?? -1;
  const isCompleted = task?.completed;
  const isSuccess = task?.success;

  // Trigger celebratory confetti on benchmark success
  useEffect(() => {
    if (isCompleted && isSuccess) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isCompleted, isSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim() || submitting) return;
    setSubmitting(true);
    await onExecuteTask(prompt);
    setSubmitting(false);
  };

  const handleChipClick = (suggestion) => {
    setPrompt(suggestion);
    onExecuteTask(suggestion);
  };

  return (
    <div className="glass-card" id="task-console-card">
      <div className="card-header">
        <span className="card-title">
          <Sparkles size={16} color="#00d2ff" />
          AI Task Planner & Skill Grounding
        </span>
        <span className="brand-tag">SayCan Engine</span>
      </div>

      {/* Prompt Bar */}
      <form onSubmit={handleSubmit} className="prompt-box">
        <div className="input-container">
          <input
            type="text"
            className="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Command robot in natural language..."
            id="task-prompt-input"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            id="btn-execute-task"
          >
            <Send size={14} />
            {submitting ? 'Planning...' : 'Execute'}
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="prompt-chips">
          <button
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick('Walk to the desk, pick up the bottle, and place it on the shelf')}
            id="chip-pick-and-place"
          >
            🦾 Benchmark: Pick & Place Bottle
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick('Walk to desk')}
            id="chip-walk-desk"
          >
            🚶 Walk to Desk
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick('Pick up the bottle')}
            id="chip-pick-bottle"
          >
            🫱 Grasp Bottle
          </button>
          <button
            type="button"
            className="chip-btn"
            onClick={() => handleChipClick('Walk to shelf')}
            id="chip-walk-shelf"
          >
            📦 Navigate to Shelf
          </button>
        </div>
      </form>

      {/* Live Status Banner */}
      <div
        className="status-banner"
        style={{
          background: isSuccess
            ? 'rgba(16, 185, 129, 0.12)'
            : isCompleted
            ? 'rgba(239, 68, 68, 0.12)'
            : 'rgba(0, 210, 255, 0.08)',
          border: `1px solid ${
            isSuccess
              ? 'rgba(16, 185, 129, 0.3)'
              : isCompleted
              ? 'rgba(239, 68, 68, 0.3)'
              : 'rgba(0, 210, 255, 0.2)'
          }`,
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: isSuccess ? '#34d399' : isCompleted ? '#f87171' : '#38bdf8'
        }}
        id="task-status-banner"
      >
        {isSuccess ? (
          <CheckCircle2 size={16} />
        ) : (
          <div className="status-dot" />
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>
            {task?.status_message || 'Awaiting command...'}
          </div>
        </div>
        {task?.active && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', opacity: 0.8 }}>
            {Math.round((task.progress || 0) * 100)}%
          </div>
        )}
      </div>

      {/* Structured SayCan Skill Pipeline */}
      {plan?.steps && plan.steps.length > 0 && (
        <div className="plan-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Action Pipeline ({plan.steps.length} Skills)
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Est. ~{plan.estimated_duration_sec}s
            </span>
          </div>

          <div className="step-list" id="task-step-list">
            {plan.steps.map((s, idx) => {
              const isCurrent = idx === currentStep;
              const isDone = idx < currentStep || isCompleted;
              const isPending = idx > currentStep && !isCompleted;

              return (
                <div
                  key={s.step}
                  className={`step-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                  id={`step-item-${s.step}`}
                >
                  <div className="step-badge">{s.step}</div>
                  <div className="step-details">
                    <div className="step-title">
                      <span>{s.skill}</span>
                      <ArrowRight size={12} color="var(--text-muted)" />
                      <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                        {JSON.stringify(s.params)}
                      </span>
                    </div>
                    <div className="step-desc">{s.description}</div>
                  </div>
                  <div>
                    <span
                      className={`step-status-tag ${
                        isDone
                          ? 'status-success'
                          : isCurrent
                          ? 'status-running'
                          : 'status-pending'
                      }`}
                    >
                      {isDone ? 'DONE' : isCurrent ? 'RUNNING' : 'PENDING'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
