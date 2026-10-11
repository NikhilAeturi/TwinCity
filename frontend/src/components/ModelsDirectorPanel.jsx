import React, { useState, useEffect } from 'react';
import {
  Box,
  Layers,
  Sparkles,
  Activity,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  Car,
  Bot,
  Plane,
  ShieldAlert,
  Search
} from 'lucide-react';
import ModelCardItem from './ModelCardItem';
import Model3DStudioViewer from './Model3DStudioViewer';

// Certified 13 Models Fallback if backend catalog is loading
const FALLBACK_CATALOG = [
  {
    id: 'vehicle_sedan',
    name: 'Sapphire Executive Sedan',
    category: 'vehicle',
    type: 'car',
    src: '/models/vehicle_sedan.glb',
    mass_kg: 1500,
    max_speed_mps: 45,
    dimensions: { length: 4.6, width: 1.85, height: 1.45 },
    physics: {
      model: 'Ackermann Bicycle Dynamics',
      mass_kg: 1500,
      max_speed_mps: 45,
      accel_mps2: 5.2,
      braking_decel_mps2: 8.5,
      description: 'Mid-size passenger chassis with rear anti-roll bar, ABS disc brakes, and moderate body roll in tight corners.'
    }
  },
  {
    id: 'vehicle_suv',
    name: 'Tactical Full-Size SUV',
    category: 'vehicle',
    type: 'suv',
    src: '/models/vehicle_suv.glb',
    mass_kg: 2300,
    max_speed_mps: 40,
    dimensions: { length: 4.9, width: 1.98, height: 1.78 },
    physics: {
      model: 'High-Inertia 4x4 Multi-Body',
      mass_kg: 2300,
      max_speed_mps: 40,
      accel_mps2: 4.4,
      braking_decel_mps2: 7.5,
      description: 'High center-of-gravity utility vehicle with substantial momentum and pronounced nose dive during hard braking.'
    }
  },
  {
    id: 'vehicle_sportscar',
    name: 'Apex GT Aerodynamic Supercar',
    category: 'vehicle',
    type: 'sportscar',
    src: '/models/vehicle_sportscar.glb',
    mass_kg: 1350,
    max_speed_mps: 65,
    dimensions: { length: 4.6, width: 2.02, height: 1.18 },
    physics: {
      model: 'High-Downforce Ground-Effect',
      mass_kg: 1350,
      max_speed_mps: 65,
      accel_mps2: 8.8,
      braking_decel_mps2: 11.0,
      description: 'Low center-of-gravity track chassis with racing compound tire friction and minimal body lean.'
    }
  },
  {
    id: 'vehicle_truck',
    name: 'Freight Logistics Box Truck',
    category: 'vehicle',
    type: 'truck',
    src: '/models/vehicle_truck.glb',
    mass_kg: 5200,
    max_speed_mps: 32,
    dimensions: { length: 6.8, width: 2.4, height: 3.1 },
    physics: {
      model: 'Commercial Heavy Transport',
      mass_kg: 5200,
      max_speed_mps: 32,
      accel_mps2: 2.8,
      braking_decel_mps2: 6.0,
      description: 'Heavy commercial payload transport with extended braking distance and high rollover sensitivity.'
    }
  },
  {
    id: 'vehicle_police',
    name: 'Metropolitan Police Interceptor',
    category: 'vehicle',
    type: 'police',
    src: '/models/vehicle_police.glb',
    mass_kg: 1750,
    max_speed_mps: 55,
    dimensions: { length: 4.8, width: 1.88, height: 1.55 },
    physics: {
      model: 'Reinforced Pursuit Interceptor',
      mass_kg: 1750,
      max_speed_mps: 55,
      accel_mps2: 6.8,
      braking_decel_mps2: 10.0,
      description: 'Tuned police interceptor equipped with push bumper, heavy duty sway bars, and pursuit ABS.'
    }
  },
  {
    id: 'humanoid_pedestrian',
    name: 'TwinCity 29-DoF Stunt Actor',
    category: 'character',
    type: 'humanoid',
    src: '/models/humanoid_walk.glb',
    mass_kg: 85,
    max_speed_mps: 6.5,
    dimensions: { length: 0.6, width: 0.8, height: 2.0 },
    physics: {
      model: 'LIPM Bipedal Gait & ZMP',
      mass_kg: 85,
      max_speed_mps: 6.5,
      accel_mps2: 3.2,
      braking_decel_mps2: 4.5,
      description: 'Articulated stunt performer and character actor with bipedal locomotion and action choreography.'
    }
  },
  {
    id: 'robot_expressive',
    name: 'Three.js Expressive Mobile Robot',
    category: 'robot',
    type: 'mobile_robot',
    src: '/models/RobotExpressive.glb',
    mass_kg: 42,
    max_speed_mps: 4.8,
    dimensions: { length: 0.85, width: 0.82, height: 1.15 },
    physics: {
      model: 'Differential Drive Kinematics',
      mass_kg: 42,
      max_speed_mps: 4.8,
      accel_mps2: 2.4,
      braking_decel_mps2: 3.8,
      description: 'Open source Three.js expressive autonomous ground rover with differential dual-wheel drive and zero turn radius.'
    }
  },
  {
    id: 'drone_quadcopter',
    name: 'Autonomous Stunt Quadcopter Drone',
    category: 'drone',
    type: 'quadcopter',
    src: '/models/drone_quadcopter.glb',
    mass_kg: 3.8,
    max_speed_mps: 28,
    dimensions: { length: 0.72, width: 0.72, height: 0.28 },
    physics: {
      model: '6-DoF Multirotor Thrust Dynamics',
      mass_kg: 3.8,
      max_speed_mps: 28,
      accel_mps2: 7.5,
      braking_decel_mps2: 6.8,
      description: 'Agile 4-rotor brushless aerial drone capable of aggressive forward pitch acceleration and banked turns.'
    }
  },
  {
    id: 'prop_barrier',
    name: 'Concrete Jersey Crash Barrier',
    category: 'prop',
    type: 'barrier',
    src: '/models/prop_barrier.glb',
    mass_kg: 2500,
    dimensions: { length: 3.2, width: 0.65, height: 1.0 },
    physics: {
      model: 'Rigid Body Coulomb Friction',
      mass_kg: 2500,
      description: 'Massive concrete reinforced barrier designed to deflect speeding vehicles back into roadway.'
    }
  },
  {
    id: 'prop_traffic_light',
    name: 'Urban Traffic Light Mast',
    category: 'prop',
    type: 'signal',
    src: '/models/prop_traffic_light.glb',
    mass_kg: 400,
    dimensions: { length: 0.5, width: 2.8, height: 5.5 },
    physics: {
      model: 'Cantilever Mast Arm',
      mass_kg: 400,
      description: 'Structural steel traffic signal mast standing 5.5m above ground elevation.'
    }
  },
  {
    id: 'prop_traffic_cone',
    name: 'OSHA Safety Traffic Cone',
    category: 'prop',
    type: 'hazard',
    src: '/models/prop_traffic_cone.glb',
    mass_kg: 4.5,
    dimensions: { length: 0.42, width: 0.42, height: 0.72 },
    physics: {
      model: 'Low-Inertia Tip-Over Obstacle',
      mass_kg: 4.5,
      description: 'Weighted base flexible rubber hazard marker with high-visibility reflector.'
    }
  },
  {
    id: 'prop_delivery_crate',
    name: 'Heavy Industrial Cargo Crate',
    category: 'prop',
    type: 'cargo',
    src: '/models/prop_delivery_crate.glb',
    mass_kg: 180,
    dimensions: { length: 1.2, width: 1.2, height: 1.2 },
    physics: {
      model: 'Heavy Slidable Freight Crate',
      mass_kg: 180,
      description: 'Reinforced corner composite freight crate suitable for robotics manipulation or vehicle impact.'
    }
  },
  {
    id: 'prop_debris_cluster',
    name: 'Accident Collision Debris Field',
    category: 'prop',
    type: 'debris',
    src: '/models/prop_debris_cluster.glb',
    mass_kg: 80,
    dimensions: { length: 2.0, width: 2.0, height: 0.4 },
    physics: {
      model: 'Dispersed Kinetic Scatter',
      mass_kg: 80,
      description: 'Multi-part collision scatter offering uneven rolling resistance to crossing vehicles.'
    }
  }
];

export default function ModelsDirectorPanel({
  models = [],
  selectedModelId,
  onSelectModel,
  onClose
}) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPhysicsTuning, setShowPhysicsTuning] = useState(false);
  const [show3DInspector, setShow3DInspector] = useState(true);
  const [customPhysics, setCustomPhysics] = useState({});

  // Use passed models or fallback catalog
  const catalogList = (models && models.length > 0) ? models : FALLBACK_CATALOG;

  // Resolve current active model object
  const activeModel = catalogList.find(m => m.id === selectedModelId) || catalogList[0] || null;
  const phys = { ...(activeModel?.physics || {}), ...customPhysics };

  // Sync custom physics state when model selection changes
  useEffect(() => {
    if (activeModel?.physics) {
      setCustomPhysics({
        mass_kg: activeModel.physics.mass_kg || activeModel.mass_kg || 1500,
        max_speed_mps: activeModel.physics.max_speed_mps || activeModel.max_speed_mps || 45,
        accel_mps2: activeModel.physics.accel_mps2 || 5.0,
        braking_decel_mps2: activeModel.physics.braking_decel_mps2 || 8.0
      });
    }
  }, [activeModel?.id]);

  // Counts by category
  const counts = {
    all: catalogList.length,
    vehicles: catalogList.filter(m => m.category === 'vehicle').length,
    robotics: catalogList.filter(m => m.category === 'character' || m.category === 'robot').length,
    drones: catalogList.filter(m => m.category === 'drone').length,
    props: catalogList.filter(m => m.category === 'prop').length
  };

  // Filter models by category and search query
  const filteredModels = catalogList.filter(m => {
    const matchesCat =
      activeCategory === 'all' ||
      (activeCategory === 'vehicles' && m.category === 'vehicle') ||
      (activeCategory === 'robotics' && (m.category === 'character' || m.category === 'robot')) ||
      (activeCategory === 'drones' && m.category === 'drone') ||
      (activeCategory === 'props' && m.category === 'prop');

    const q = searchQuery.toLowerCase().trim();
    const matchesQuery = !q ||
      m.name.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q) ||
      (m.tags && m.tags.some(t => t.toLowerCase().includes(q)));

    return matchesCat && matchesQuery;
  });

  // Available actions based on model category
  const availableActions = activeModel?.physics?.supported_actions || [
    'SPAWN', 'MOVE', 'ACCELERATE', 'CRUISE', 'DECELERATE', 'STOP'
  ];

  return (
    <div
      className="models-director-panel"
      style={{
        position: 'fixed',
        left: '86px',
        top: '16px',
        bottom: '16px',
        width: '450px',
        maxHeight: 'calc(100vh - 32px)',
        background: 'rgba(8, 14, 28, 0.96)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85), 0 0 36px rgba(16, 185, 129, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9998,
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        userSelect: 'none',
        overflow: 'hidden'
      }}
    >
      {/* 1. Header Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.88)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.55)'
            }}
          >
            <Box size={22} color="#ffffff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              3D Models & Physics
            </div>
            <div style={{ fontSize: '0.70rem', color: '#10b981', fontWeight: 600 }}>
              Certified 3D Physics Catalog & Motion Director
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          title="Close Models Director"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#94a3b8',
            width: '32px',
            height: '32px',
            borderRadius: '9px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.color = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Scrollable Content Container */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Search Bar on TOP of Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search
              size={14}
              color="#64748b"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              placeholder="Search models (e.g. sedan, sports car, robot, drone)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 34px 9px 34px',
                borderRadius: '10px',
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                fontSize: '0.76rem',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Category Filter Pills (Now directly underneath search bar) */}
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              paddingBottom: '2px'
            }}
          >
            {[
              { id: 'all', label: 'All', icon: Layers, count: counts.all },
              { id: 'vehicles', label: 'Vehicles', icon: Car, count: counts.vehicles },
              { id: 'robotics', label: 'Robots', icon: Bot, count: counts.robotics },
              { id: 'drones', label: 'Drones', icon: Plane, count: counts.drones },
              { id: 'props', label: 'Props', icon: ShieldAlert, count: counts.props }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: '8px',
                    border: isActive ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.08)',
                    background: isActive ? 'rgba(16, 185, 129, 0.24)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? '#34d399' : '#94a3b8',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      padding: '1px 5px',
                      borderRadius: '10px',
                      background: isActive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255,255,255,0.08)',
                      color: isActive ? '#ffffff' : '#94a3b8'
                    }}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Model Cards Catalog Carousel / Proper Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                CATALOG ({filteredModels.length} MODELS)
              </span>
            </div>
            <span style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={11} />
              <span>Certified 3D Physics Mesh</span>
            </span>
          </div>

          {/* Proper 2-Column Grid of 3D Models */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridAutoRows: '178px',
              gap: '10px',
              maxHeight: '380px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            {filteredModels.map(model => (
              <ModelCardItem
                key={model.id}
                model={model}
                isSelected={model.id === selectedModelId}
                onSelect={() => onSelectModel(model.id)}
              />
            ))}
          </div>
        </div>

        {/* 3. Selected Model Interactive 3D Studio & Physics Spec Card */}
        {activeModel && (
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1.5px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(16, 185, 129, 0.15)'
            }}
          >
            {/* Header: Name and Physics Model */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Activity size={16} color="#10b981" />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                    {activeModel.name}
                  </div>
                  <div style={{ fontSize: '0.64rem', color: '#94a3b8' }}>
                    Certified Model • {activeModel.category.toUpperCase()}
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.64rem',
                  fontFamily: 'monospace',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontWeight: 700
                }}
              >
                {activeModel.physics?.model || 'Newtonian Dynamics'}
              </span>
            </div>

            {/* Live Interactive 3D Turntable / Studio Preview */}
            {show3DInspector && (
              <Model3DStudioViewer model={activeModel} />
            )}

            {/* Live Physics Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.4)',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 600 }}>MASS</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f8fafc' }}>
                  {phys.mass_kg || 1500} kg
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 600 }}>TOP SPEED</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#38bdf8' }}>
                  {phys.max_speed_mps ? `${Math.round(phys.max_speed_mps * 2.237)} mph` : 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 600 }}>ACCEL</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#10b981' }}>
                  {phys.accel_mps2 || 5.0} m/s²
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 600 }}>BRAKING</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f43f5e' }}>
                  {phys.braking_decel_mps2 || 8.5} m/s²
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.45 }}>
              {activeModel.physics?.description || 'Calibrated 3D physics body with ground elevation and inertia.'}
            </p>

            {/* Physics Tuning Toggle */}
            <button
              onClick={() => setShowPhysicsTuning(prev => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: '#38bdf8',
                fontSize: '0.70rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '2px 0'
              }}
            >
              <Sliders size={12} />
              <span>{showPhysicsTuning ? 'Hide Custom Physics Tuners' : 'Customize Physics Parameters'}</span>
              {showPhysicsTuning ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showPhysicsTuning && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  background: 'rgba(0,0,0,0.3)',
                  padding: '10px',
                  borderRadius: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.70rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Mass (kg): {phys.mass_kg}</span>
                  <input
                    type="range"
                    min="1"
                    max="6000"
                    step="25"
                    value={phys.mass_kg || 1500}
                    onChange={(e) => setCustomPhysics(prev => ({ ...prev, mass_kg: Number(e.target.value) }))}
                    style={{ width: '130px', accentColor: '#10b981' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.70rem' }}>
                  <span style={{ color: '#cbd5e1' }}>Max Speed (m/s): {phys.max_speed_mps}</span>
                  <input
                    type="range"
                    min="2"
                    max="70"
                    step="1"
                    value={phys.max_speed_mps || 25}
                    onChange={(e) => setCustomPhysics(prev => ({ ...prev, max_speed_mps: Number(e.target.value) }))}
                    style={{ width: '130px', accentColor: '#38bdf8' }}
                  />
                </div>
              </div>
            )}

            {/* Supported Physical Behaviors & Kinematics */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                background: 'rgba(0, 0, 0, 0.3)',
                padding: '10px 12px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Supported Physical Actions ({availableActions.length})
                </span>
                <span style={{ fontSize: '0.62rem', color: '#10b981', fontFamily: 'monospace' }}>
                  AI Scene Directable
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                {availableActions.map(action => (
                  <span
                    key={action}
                    style={{
                      fontSize: '0.64rem',
                      fontWeight: 700,
                      padding: '3px 7px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.12)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#34d399',
                      fontFamily: 'monospace',
                      letterSpacing: '0.02em'
                    }}
                  >
                    {action}
                  </span>
                ))}
              </div>
            </div>

            {/* Active Model Status for Scene Director */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.12) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: '#f8fafc'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} color="#10b981" />
                <div>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#f8fafc' }}>
                    Active Actor in Scene Director
                  </div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8' }}>
                    {activeModel.name} is ready for prompt orchestration
                  </div>
                </div>
              </div>

              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 800,
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.2)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}
              >
                READY
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
