import React, { useState, useEffect } from 'react';
import { CheckCircle2, Car, Bot, Plane, ShieldAlert, Sparkles } from 'lucide-react';
import { getOrRenderModelThumbnail, MODEL_VISUAL_PREVIEWS } from '../utils/modelThumbnailRenderer';

/**
 * Returns a stylized vector silhouette illustration for instant visual display
 * while Three.js finishes offscreen WebGL rendering.
 */
function ModelVectorIllustration({ model }) {
  const cat = model.category;
  const id = model.id;

  if (cat === 'drone' || id.includes('drone')) {
    return (
      <svg viewBox="0 0 120 70" width="88" height="52" fill="none">
        {/* Quadcopter Center Body */}
        <circle cx="60" cy="35" r="10" fill="#9333ea" fillOpacity="0.85" stroke="#c084fc" strokeWidth="2" />
        <circle cx="60" cy="35" r="4" fill="#38bdf8" />
        {/* 4 Carbon Arms */}
        <line x1="28" y1="18" x2="52" y2="30" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="92" y1="18" x2="68" y2="30" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="28" y1="52" x2="52" y2="40" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="92" y1="52" x2="68" y2="40" stroke="#a855f7" strokeWidth="3.5" strokeLinecap="round" />
        {/* 4 Rotors */}
        <ellipse cx="24" cy="16" rx="14" ry="5" fill="#c084fc" fillOpacity="0.35" stroke="#e9d5ff" strokeWidth="1.5" />
        <circle cx="24" cy="16" r="2.5" fill="#ffffff" />
        <ellipse cx="96" cy="16" rx="14" ry="5" fill="#c084fc" fillOpacity="0.35" stroke="#e9d5ff" strokeWidth="1.5" />
        <circle cx="96" cy="16" r="2.5" fill="#ffffff" />
        <ellipse cx="24" cy="54" rx="14" ry="5" fill="#c084fc" fillOpacity="0.35" stroke="#e9d5ff" strokeWidth="1.5" />
        <circle cx="24" cy="54" r="2.5" fill="#ffffff" />
        <ellipse cx="96" cy="54" rx="14" ry="5" fill="#c084fc" fillOpacity="0.35" stroke="#e9d5ff" strokeWidth="1.5" />
        <circle cx="96" cy="54" r="2.5" fill="#ffffff" />
      </svg>
    );
  }

  if (cat === 'character' || id.includes('humanoid')) {
    return (
      <svg viewBox="0 0 80 90" width="56" height="64" fill="none">
        {/* Head & Glowing Visor */}
        <rect x="33" y="10" width="14" height="12" rx="3" fill="#334155" stroke="#06b6d4" strokeWidth="1.8" />
        <rect x="35" y="14" width="10" height="3" rx="1" fill="#38bdf8" />
        {/* Torso & Armor */}
        <rect x="28" y="24" width="24" height="24" rx="4" fill="#1e293b" stroke="#0284c7" strokeWidth="1.8" />
        <circle cx="40" cy="34" r="3.5" fill="#38bdf8" />
        {/* Arms */}
        <rect x="18" y="25" width="8" height="22" rx="3" fill="#334155" stroke="#0284c7" strokeWidth="1.2" />
        <rect x="54" y="25" width="8" height="22" rx="3" fill="#334155" stroke="#0284c7" strokeWidth="1.2" />
        {/* Legs */}
        <rect x="30" y="50" width="8" height="28" rx="2" fill="#334155" stroke="#0284c7" strokeWidth="1.5" />
        <rect x="42" y="50" width="8" height="28" rx="2" fill="#334155" stroke="#0284c7" strokeWidth="1.5" />
      </svg>
    );
  }

  if (cat === 'robot' || id.includes('robot')) {
    return (
      <svg viewBox="0 0 90 80" width="64" height="56" fill="none">
        {/* Expressive Dome Head */}
        <path d="M30 36 C30 18 60 18 60 36 Z" fill="#10b981" fillOpacity="0.85" stroke="#34d399" strokeWidth="1.8" />
        <circle cx="40" cy="28" r="2.5" fill="#ffffff" />
        <circle cx="50" cy="28" r="2.5" fill="#ffffff" />
        {/* Body Base */}
        <rect x="26" y="36" width="38" height="22" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="1.5" />
        {/* Drive Wheels */}
        <ellipse cx="22" cy="56" rx="5" ry="12" fill="#334155" stroke="#10b981" strokeWidth="1.5" />
        <ellipse cx="68" cy="56" rx="5" ry="12" fill="#334155" stroke="#10b981" strokeWidth="1.5" />
      </svg>
    );
  }

  if (id === 'prop_barrier') {
    return (
      <svg viewBox="0 0 110 60" width="76" height="42" fill="none">
        <polygon points="15,48 25,18 85,18 95,48" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
        <rect x="25" y="24" width="60" height="6" fill="#f59e0b" />
      </svg>
    );
  }

  if (id === 'prop_traffic_light') {
    return (
      <svg viewBox="0 0 70 90" width="48" height="62" fill="none">
        <rect x="33" y="10" width="4" height="75" fill="#64748b" />
        <rect x="24" y="16" width="22" height="42" rx="4" fill="#0f172a" stroke="#475569" strokeWidth="1.5" />
        <circle cx="35" cy="25" r="4" fill="#ef4444" />
        <circle cx="35" cy="37" r="4" fill="#eab308" />
        <circle cx="35" cy="49" r="4" fill="#22c55e" />
      </svg>
    );
  }

  if (id === 'prop_traffic_cone') {
    return (
      <svg viewBox="0 0 80 80" width="56" height="56" fill="none">
        <polygon points="40,12 24,62 56,62" fill="#f97316" stroke="#ea580c" strokeWidth="1.5" />
        <polygon points="36,28 32,42 48,42 44,28" fill="#ffffff" />
        <rect x="18" y="62" width="44" height="6" rx="2" fill="#1e293b" />
      </svg>
    );
  }

  if (id === 'prop_delivery_crate') {
    return (
      <svg viewBox="0 0 80 80" width="56" height="56" fill="none">
        <rect x="20" y="22" width="40" height="40" rx="3" fill="#b45309" stroke="#f59e0b" strokeWidth="2" />
        <line x1="20" y1="22" x2="60" y2="62" stroke="#78350f" strokeWidth="2.5" />
        <line x1="60" y1="22" x2="20" y2="62" stroke="#78350f" strokeWidth="2.5" />
      </svg>
    );
  }

  if (id === 'prop_debris_cluster') {
    return (
      <svg viewBox="0 0 90 60" width="64" height="42" fill="none">
        <ellipse cx="34" cy="36" rx="12" ry="8" fill="#334155" stroke="#ef4444" strokeWidth="1.5" />
        <polygon points="48,30 68,26 62,42" fill="#64748b" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx="72" cy="38" r="3" fill="#ef4444" />
      </svg>
    );
  }

  // Vehicles (Sedan, SUV, Supercar, Truck, Police)
  const isSupercar = id.includes('sportscar');
  const isTruck = id.includes('truck');
  const isPolice = id.includes('police');
  const isSUV = id.includes('suv');

  const mainColor = isSupercar ? '#f59e0b' : isPolice ? '#3b82f6' : isSUV ? '#64748b' : isTruck ? '#e2e8f0' : '#38bdf8';

  return (
    <svg viewBox="0 0 140 70" width="98" height="50" fill="none">
      {/* Vehicle Silhouette */}
      {isTruck ? (
        <>
          <rect x="20" y="14" width="70" height="34" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
          <path d="M90 26 L110 26 L114 48 L90 48 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
        </>
      ) : isSupercar ? (
        <>
          <path d="M15 42 L35 34 L65 24 L95 24 L120 36 L130 42 L130 48 L15 48 Z" fill="#d97706" stroke="#fbbf24" strokeWidth="1.8" />
          {/* Spoiler */}
          <rect x="12" y="30" width="12" height="3" fill="#fbbf24" />
          <line x1="16" y1="33" x2="16" y2="42" stroke="#fbbf24" strokeWidth="2" />
        </>
      ) : isSUV ? (
        <>
          <path d="M16 44 L28 24 L96 24 L114 36 L124 44 L124 48 L16 48 Z" fill="#334155" stroke="#64748b" strokeWidth="1.8" />
          {/* Roof Rail */}
          <line x1="32" y1="20" x2="90" y2="20" stroke="#94a3b8" strokeWidth="2" />
        </>
      ) : (
        /* Sedan / Police */
        <>
          <path d="M16 44 L34 32 L60 22 L96 22 L116 34 L126 44 L126 48 L16 48 Z" fill={isPolice ? '#1e293b' : '#0284c7'} stroke={mainColor} strokeWidth="1.8" />
          {isPolice && (
            /* Lightbar */
            <>
              <rect x="70" y="17" width="8" height="4" rx="1" fill="#ef4444" />
              <rect x="78" y="17" width="8" height="4" rx="1" fill="#3b82f6" />
            </>
          )}
        </>
      )}

      {/* Automotive Tinted Glass */}
      <polygon points="56,26 92,26 108,36 50,36" fill="#38bdf8" fillOpacity="0.35" stroke="#38bdf8" strokeWidth="1" />

      {/* Wheels */}
      <circle cx="38" cy="48" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="38" cy="48" r="4" fill="#64748b" />
      <circle cx="106" cy="48" r="9" fill="#0f172a" stroke="#94a3b8" strokeWidth="2" />
      <circle cx="106" cy="48" r="4" fill="#64748b" />
    </svg>
  );
}

export default function ModelCardItem({ model, isSelected, onSelect }) {
  const [renderedThumb, setRenderedThumb] = useState(null);
  const [isHovered, setIsHovered] = useState(false);

  const meta = MODEL_VISUAL_PREVIEWS[model.id] || {
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
    badge: model.category.toUpperCase()
  };

  useEffect(() => {
    let active = true;
    getOrRenderModelThumbnail(model.id, model.src, model.category)
      .then((url) => {
        if (active && url) {
          setRenderedThumb(url);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [model.id, model.src]);

  const categoryColor =
    model.category === 'vehicle' ? '#38bdf8' :
    model.category === 'drone' ? '#c084fc' :
    model.category === 'character' || model.category === 'robot' ? '#10b981' :
    '#f59e0b';

  const massKg = model.mass_kg || model.physics?.mass_kg || 1500;
  const speedMph = model.max_speed_mps
    ? Math.round(model.max_speed_mps * 2.237)
    : model.default_speed_mps
    ? Math.round(model.default_speed_mps * 2.237)
    : null;

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        borderRadius: '14px',
        minHeight: '178px',
        height: '178px',
        border: isSelected
          ? '1.8px solid #10b981'
          : isHovered
          ? '1px solid rgba(16, 185, 129, 0.45)'
          : '1px solid rgba(255, 255, 255, 0.08)',
        background: isSelected
          ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.22) 0%, rgba(15, 23, 42, 0.85) 100%)'
          : isHovered
          ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(15, 23, 42, 0.75) 100%)'
          : 'rgba(15, 23, 42, 0.6)',
        boxShadow: isSelected
          ? '0 0 20px rgba(16, 185, 129, 0.35), inset 0 0 12px rgba(16, 185, 129, 0.15)'
          : isHovered
          ? '0 8px 24px rgba(0, 0, 0, 0.5)'
          : 'none',
        transform: isHovered && !isSelected ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none'
      }}
    >
      {/* 1. TOP RENDER CONTAINER */}
      <div
        style={{
          width: '100%',
          height: '112px',
          minHeight: '112px',
          maxHeight: '112px',
          flexShrink: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(ellipse at 50% 65%, rgba(16, 185, 129, 0.12) 0%, rgba(9, 14, 26, 0.95) 85%)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          overflow: 'hidden'
        }}
      >
        {/* Category Pill Tag (Top Left) */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            left: '8px',
            zIndex: 3,
            fontSize: '0.58rem',
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: '5px',
            background: 'rgba(15, 23, 42, 0.85)',
            border: `1px solid ${categoryColor}40`,
            color: categoryColor,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <span
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: categoryColor,
              boxShadow: `0 0 6px ${categoryColor}`
            }}
          />
          <span>{model.category}</span>
        </div>

        {/* Selected Checkmark (Top Right) */}
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              zIndex: 3,
              background: '#10b981',
              borderRadius: '50%',
              width: '18px',
              height: '18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.8)'
            }}
          >
            <CheckCircle2 size={13} color="#07090e" strokeWidth={3} />
          </div>
        )}

        {/* 3D Model Render Image */}
        {renderedThumb ? (
          <img
            src={renderedThumb}
            alt={model.name}
            style={{
              width: '92%',
              height: '92%',
              objectFit: 'contain',
              zIndex: 2,
              filter: 'drop-shadow(0 8px 12px rgba(0, 0, 0, 0.75))',
              transform: isHovered ? 'scale(1.08)' : 'scale(1.0)',
              transition: 'transform 0.25s ease'
            }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              transform: isHovered ? 'scale(1.06)' : 'scale(1.0)',
              transition: 'transform 0.25s ease'
            }}
          >
            <ModelVectorIllustration model={model} />
          </div>
        )}

        {/* Studio Pedestal / Ground Glow */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            width: '60%',
            height: '6px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.35) 0%, rgba(0, 0, 0, 0) 70%)',
            zIndex: 1
          }}
        />
      </div>

      {/* 2. UNDER THAT IMAGE: MODEL NAME & SPECS */}
      <div
        style={{
          flex: 1,
          flexShrink: 0,
          padding: '9px 11px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '4px',
          background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'transparent'
        }}
      >
        {/* Specific Model Name */}
        <div
          title={model.name}
          style={{
            fontSize: '0.76rem',
            fontWeight: 800,
            color: isSelected ? '#ffffff' : '#f1f5f9',
            lineHeight: 1.25,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.01em'
          }}
        >
          {model.name}
        </div>

        {/* Specs Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '2px',
            fontSize: '0.64rem',
            color: '#94a3b8'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>⚖️</span>
            <span style={{ fontWeight: 600, color: '#cbd5e1' }}>{massKg} kg</span>
          </span>

          {speedMph ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>⚡</span>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>{speedMph} mph</span>
            </span>
          ) : (
            <span style={{ fontSize: '0.60rem', color: '#64748b', textTransform: 'uppercase' }}>
              Rigid Body
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
