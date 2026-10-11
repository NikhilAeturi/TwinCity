import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Crosshair,
  Edit3,
  FileJson,
  Sparkles,
  Navigation
} from 'lucide-react';

// 0.25 Mile Radius in Meters: 1/4 of 1609.344m = 402.34 meters (Diameter = 804.68 meters)
export const QUARTER_MILE_METERS = 402.34;
export const PLANE_SIZE = QUARTER_MILE_METERS * 2; // 804.68 meters across

export const DEFAULT_CITIES = [
  {
    id: 'san_francisco',
    name: 'San Francisco',
    district: 'Downtown Financial District',
    landmark: 'Transamerica Pyramid & Market St',
    flag: '🇺🇸',
    lat: 37.7952,
    lng: -122.4028,
    groundAltitude: 20,
    altitude: 240,
    tilt: 67.5,
    heading: 45.0,
    range: 480
  },
  {
    id: 'manhattan',
    name: 'New York City',
    district: 'Midtown Manhattan',
    landmark: 'Empire State & Times Square',
    flag: '🇺🇸',
    lat: 40.7580,
    lng: -73.9855,
    groundAltitude: 20,
    altitude: 260,
    tilt: 67.5,
    heading: 35.0,
    range: 580
  },
  {
    id: 'chicago',
    name: 'Chicago',
    district: 'The Loop & Riverfront',
    landmark: 'Willis Tower & Wacker Drive',
    flag: '🇺🇸',
    lat: 41.8887,
    lng: -87.6264,
    groundAltitude: 182,
    altitude: 230,
    tilt: 67.5,
    heading: 25.0,
    range: 520
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    district: 'Shinjuku Skyscraper Hub',
    landmark: 'Tokyo Metropolitan & Neon Avenues',
    flag: '🇯🇵',
    lat: 35.6895,
    lng: 139.6917,
    groundAltitude: 35,
    altitude: 250,
    tilt: 67.5,
    heading: 60.0,
    range: 620
  },
  {
    id: 'paris',
    name: 'Paris',
    district: 'Champ de Mars & Seine',
    landmark: 'Eiffel Tower & Trocadéro',
    flag: '🇫🇷',
    lat: 48.8584,
    lng: 2.2945,
    groundAltitude: 35,
    altitude: 180,
    tilt: 67.5,
    heading: 40.0,
    range: 550
  },
  {
    id: 'london',
    name: 'London',
    district: 'Southwark & City',
    landmark: 'The Shard & River Thames',
    flag: '🇬🇧',
    lat: 51.5045,
    lng: -0.0865,
    groundAltitude: 15,
    altitude: 210,
    tilt: 67.5,
    heading: 30.0,
    range: 580
  }
];



/**
 * Calculates a point at a given distance (meters) and bearing (radians) on earth.
 */
function getGeodesicPoint(lat, lng, distMeters, bearingRad, alt = 0) {
  const d = distMeters / 6378137;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) +
    Math.cos(lat1) * Math.sin(d) * Math.cos(bearingRad)
  );
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRad) * Math.sin(d) * Math.cos(lat1),
    Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
  );
  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
    altitude: alt
  };
}

/**
 * Generates horizontal circumference coordinates lying flat on the earth's surface.
 */
function generateCircumference(lat, lng, radiusMeters = 402.34, numPoints = 64, alt = 0) {
  const coords = [];
  for (let i = 0; i <= numPoints; i++) {
    const brng = (i * 2 * Math.PI) / numPoints;
    coords.push(getGeodesicPoint(lat, lng, radiusMeters, brng, alt));
  }
  return coords;
}

/**
 * Generates simple 4-vertex quadrilateral sector quads covering the annular zone between innerRadius and outerRadius.
 */
function generateSectorQuads(lat, lng, innerRadius, outerRadius, numPoints) {
  const quads = [];
  for (let i = 0; i < numPoints; i++) {
    const b1 = (i * 2 * Math.PI) / numPoints;
    const b2 = ((i + 1) * 2 * Math.PI) / numPoints;

    const in1 = getGeodesicPoint(lat, lng, innerRadius, b1, 0);
    const out1 = getGeodesicPoint(lat, lng, outerRadius, b1, 0);
    const out2 = getGeodesicPoint(lat, lng, outerRadius, b2, 0);
    const in2 = getGeodesicPoint(lat, lng, innerRadius, b2, 0);

    quads.push([in1, out1, out2, in2, in1]);
  }
  return quads;
}

/**
 * Creates a Google Maps 3D Flattener element (<gmp-flattener>) to remove 3D buildings,
 * flora, and structures within the specified polygon boundary.
 */
function createFlattener(pathCoords) {
  let fl = null;
  const FlattenerClass = window.google?.maps?.maps3d?.FlattenerElement;

  if (typeof FlattenerClass === 'function') {
    try {
      fl = new FlattenerClass({ path: pathCoords });
    } catch (e) {
      console.warn('FlattenerClass init note:', e);
    }
  }

  if (!fl) {
    fl = document.createElement('gmp-flattener');
  }

  try {
    fl.path = pathCoords;
  } catch (e) {}

  try {
    const pathStr = (pathCoords || [])
      .filter(c => c && c.lat !== undefined)
      .map(c => `${c.lat},${c.lng},0`)
      .join(' ');
    fl.setAttribute('path', pathStr);
  } catch (e) {}

  return fl;
}

/**
 * Creates a Google Maps 3D Ground Polygon element (<gmp-polygon-3d>) clamped to ground
 * with fill color to paint surrounding terrain.
 */
function createGroundPolygon(pathCoords, fillColor = '#181b22') {
  let poly = null;
  const PolygonClass = window.google?.maps?.maps3d?.Polygon3DElement;
  const AltMode = window.google?.maps?.maps3d?.AltitudeMode;

  if (typeof PolygonClass === 'function') {
    try {
      poly = new PolygonClass({
        altitudeMode: AltMode?.CLAMP_TO_GROUND || 'CLAMP_TO_GROUND',
        fillColor: fillColor,
        strokeColor: fillColor,
        strokeWidth: 0,
        outerCoordinates: pathCoords
      });
    } catch (e) {
      console.warn('PolygonClass init note:', e);
    }
  }

  if (!poly) {
    poly = document.createElement('gmp-polygon-3d');
  }

  poly.setAttribute('altitude-mode', 'clamp-to-ground');
  poly.setAttribute('fill-color', fillColor);
  poly.setAttribute('stroke-color', fillColor);
  poly.setAttribute('stroke-width', '0');

  try {
    poly.path = pathCoords;
    poly.outerCoordinates = pathCoords;
  } catch (e) {}

  return poly;
}

/**
 * Converts metric offsets (dx = East, dy = North) from center to lat/lng coordinates.
 */
function metersToLatLng(centerLat, centerLng, dxMeters, dyMeters, alt = 0) {
  const dLat = dyMeters / 111320;
  const cosLat = Math.max(0.01, Math.cos((centerLat * Math.PI) / 180));
  const dLng = dxMeters / (111320 * cosLat);
  return {
    lat: centerLat + dLat,
    lng: centerLng + dLng,
    altitude: alt
  };
}

/**
 * Creates a Google Maps 3D Polyline element (<gmp-polyline-3d>) at absolute fixed altitude.
 */
function createPolyline(coordinates, strokeColor = 'rgba(255, 255, 255, 0.2)', strokeWidth = 1.5, altitude = 20, altMode = 'ABSOLUTE') {
  let line = null;
  const PolylineClass = window.google?.maps?.maps3d?.Polyline3DElement;
  const AltModeEnum = window.google?.maps?.maps3d?.AltitudeMode;
  const resolvedAltMode = AltModeEnum?.[altMode] || altMode;

  const coordsWithAlt = (coordinates || [])
    .filter(c => c && (c.lat !== undefined || c.latitude !== undefined))
    .map(c => ({
      lat: c.lat ?? c.latitude ?? 0,
      lng: c.lng ?? c.longitude ?? 0,
      altitude: c.altitude !== undefined ? c.altitude : altitude
    }));

  if (typeof PolylineClass === 'function') {
    try {
      line = new PolylineClass({
        path: coordsWithAlt,
        coordinates: coordsWithAlt,
        strokeColor: strokeColor,
        strokeWidth: strokeWidth,
        altitudeMode: resolvedAltMode
      });
    } catch (e) {
      console.warn('PolylineClass init note:', e);
    }
  }

  if (!line) {
    line = document.createElement('gmp-polyline-3d');
  }

  try {
    line.setAttribute('altitude-mode', altMode.toLowerCase());
    line.setAttribute('stroke-color', strokeColor);
    line.setAttribute('stroke-width', String(strokeWidth));
    const pathStr = coordsWithAlt.map(c => `${c.lat},${c.lng},${c.altitude}`).join(' ');
    line.setAttribute('path', pathStr);
  } catch (e) {}

  try {
    line.path = coordsWithAlt;
    line.coordinates = coordsWithAlt;
  } catch (e) {}

  return line;
}

/**
 * Generates the authentic Blender 3D Viewport Floor Grid elements enclosing the 0.25-mile model.
 */
function generateBlenderGridElements(centerLat, centerLng, baseAltitude = 20) {
  const elements = [];
  const L = 650;
  const step = 65;
  const z = baseAltitude;

  for (let x = -L; x <= L; x += step) {
    const isYAxis = Math.abs(x) < 1;
    const color = isYAxis ? '#22c55e' : 'rgba(255, 255, 255, 0.22)';
    const width = isYAxis ? 3.5 : 1.2;
    const yExt = isYAxis ? L * 1.3 : L;
    const p1 = metersToLatLng(centerLat, centerLng, x, -yExt, z);
    const p2 = metersToLatLng(centerLat, centerLng, x, yExt, z);
    elements.push(createPolyline([p1, p2], color, width, z, 'ABSOLUTE'));
  }

  for (let y = -L; y <= L; y += step) {
    const isXAxis = Math.abs(y) < 1;
    const color = isXAxis ? '#ef4444' : 'rgba(255, 255, 255, 0.22)';
    const width = isXAxis ? 3.5 : 1.2;
    const xExt = isXAxis ? L * 1.3 : L;
    const p1 = metersToLatLng(centerLat, centerLng, -xExt, y, z);
    const p2 = metersToLatLng(centerLat, centerLng, xExt, y, z);
    elements.push(createPolyline([p1, p2], color, width, z, 'ABSOLUTE'));
  }

  const boxCorners = [
    metersToLatLng(centerLat, centerLng, -L, -L, z),
    metersToLatLng(centerLat, centerLng, L, -L, z),
    metersToLatLng(centerLat, centerLng, L, L, z),
    metersToLatLng(centerLat, centerLng, -L, L, z),
    metersToLatLng(centerLat, centerLng, -L, -L, z)
  ];
  elements.push(createPolyline(boxCorners, '#e58c2b', 3.5, z, 'ABSOLUTE'));

  const cursorCircle = generateCircumference(centerLat, centerLng, 14, 32, z);
  elements.push(createPolyline(cursorCircle, '#ef4444', 2.5, z, 'ABSOLUTE'));

  const chX1 = metersToLatLng(centerLat, centerLng, -24, 0, z);
  const chX2 = metersToLatLng(centerLat, centerLng, 24, 0, z);
  const chY1 = metersToLatLng(centerLat, centerLng, 0, -24, z);
  const chY2 = metersToLatLng(centerLat, centerLng, 0, 24, z);
  elements.push(createPolyline([chX1, chX2], '#f59e0b', 2, z, 'ABSOLUTE'));
  elements.push(createPolyline([chY1, chY2], '#f59e0b', 2, z, 'ABSOLUTE'));

  return elements;
}

/**
 * Creates a horizontal 0.25-mile cyan circular selection polygon on the ground.
 */
function createSelectionPolygon(lat, lng) {
  const circleCoords = generateCircumference(lat, lng, QUARTER_MILE_METERS, 64);
  let poly = null;
  const PolygonClass = window.google?.maps?.maps3d?.Polygon3DElement;
  const AltMode = window.google?.maps?.maps3d?.AltitudeMode;

  if (typeof PolygonClass === 'function') {
    try {
      poly = new PolygonClass({
        altitudeMode: AltMode?.CLAMP_TO_GROUND || 'CLAMP_TO_GROUND',
        strokeColor: '#00f2fe',
        strokeWidth: 4,
        fillColor: 'rgba(0, 242, 254, 0.22)',
        outerCoordinates: circleCoords
      });
    } catch (e) {
      console.warn('PolygonClass init note:', e);
    }
  }

  if (!poly) {
    poly = document.createElement('gmp-polygon-3d');
  }

  poly.setAttribute('altitude-mode', 'clamp-to-ground');
  poly.setAttribute('stroke-color', '#00f2fe');
  poly.setAttribute('stroke-width', '4');
  poly.setAttribute('fill-color', 'rgba(0, 242, 254, 0.22)');

  try {
    poly.path = circleCoords;
    poly.outerCoordinates = circleCoords;
  } catch (e) {}

  poly.style.pointerEvents = 'none';
  return poly;
}

/**
 * Authentic Blender 3D Viewport Orientation Gizmo & Navigation Tools.
 */
function BlenderGizmo({
  heading = 45,
  tilt = 60,
  onOrbit,
  onSnapView,
  onZoom,
  onPan,
  onTogglePerspective,
  onRecenter,
  isPerspective = true
}) {
  const [isGizmoDragging, setIsGizmoDragging] = useState(false);
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startHeading: 0,
    startTilt: 0,
    hasMoved: false
  });

  const handleGizmoPointerDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    setIsGizmoDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startHeading: heading,
      startTilt: tilt,
      hasMoved: false
    };
  };

  const handleGizmoPointerMove = (e) => {
    if (!isGizmoDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      dragRef.current.hasMoved = true;
    }
    const newHeading = (dragRef.current.startHeading + dx * 0.7 + 360) % 360;
    const newTilt = Math.max(0.1, Math.min(85, dragRef.current.startTilt + dy * 0.5));
    onOrbit?.(newHeading, newTilt);
  };

  const handleGizmoPointerUp = (e) => {
    if (isGizmoDragging) {
      setIsGizmoDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const cx = 46;
  const cy = 46;
  const R = 32;

  const hRad = (heading * Math.PI) / 180;
  const tRad = (tilt * Math.PI) / 180;

  const cosH = Math.cos(hRad);
  const sinH = Math.sin(hRad);
  const cosT = Math.cos(tRad);
  const sinT = Math.sin(tRad);

  const axes = [
    {
      id: '+x',
      name: 'Right (X)',
      color: '#ea3939',
      bgColor: '#ea3939',
      label: 'X',
      view: 'east',
      sx: cosH,
      sy: -cosT * sinH,
      sz: -sinT * sinH,
      isPositive: true
    },
    {
      id: '-x',
      name: 'Left (-X)',
      color: '#7f1d1d',
      bgColor: '#7f1d1d',
      label: '',
      view: 'west',
      sx: -cosH,
      sy: cosT * sinH,
      sz: sinT * sinH,
      isPositive: false
    },
    {
      id: '+y',
      name: 'Front (Y)',
      color: '#48b738',
      bgColor: '#48b738',
      label: 'Y',
      view: 'north',
      sx: -sinH,
      sy: -cosT * cosH,
      sz: -sinT * cosH,
      isPositive: true
    },
    {
      id: '-y',
      name: 'Back (-Y)',
      color: '#14532d',
      bgColor: '#14532d',
      label: '',
      view: 'south',
      sx: sinH,
      sy: cosT * cosH,
      sz: sinT * cosH,
      isPositive: false
    },
    {
      id: '+z',
      name: 'Top (Z)',
      color: '#3984ea',
      bgColor: '#3984ea',
      label: 'Z',
      view: 'top',
      sx: 0,
      sy: sinT,
      sz: cosT,
      isPositive: true
    },
    {
      id: '-z',
      name: 'Bottom (-Z)',
      color: '#1e3a8a',
      bgColor: '#1e3a8a',
      label: '',
      view: 'bottom',
      sx: 0,
      sy: -sinT,
      sz: -cosT,
      isPositive: false
    }
  ];

  const sortedAxes = [...axes].sort((a, b) => a.sz - b.sz);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        userSelect: 'none'
      }}
    >
      <div
        style={{
          width: '92px',
          height: '92px',
          position: 'relative',
          cursor: isGizmoDragging ? 'grabbing' : 'grab',
          userSelect: 'none'
        }}
        onPointerDown={handleGizmoPointerDown}
        onPointerMove={handleGizmoPointerMove}
        onPointerUp={handleGizmoPointerUp}
        title="Blender 3D Orientation Gizmo • Drag sphere to orbit • Click X, Y, Z to snap view"
      >
        <svg width="92" height="92" viewBox="0 0 92 92" style={{ overflow: 'visible' }}>
          <circle
            cx={cx}
            cy={cy}
            r={R + 7}
            fill="rgba(15, 23, 42, 0.78)"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="1.2"
          />

          {sortedAxes.map((axis) => {
            const px = cx + R * axis.sx;
            const py = cy - R * axis.sy;
            const isBack = axis.sz < -0.15;

            if (!axis.isPositive) {
              return (
                <g key={axis.id}>
                  <line
                    x1={cx}
                    y1={cy}
                    x2={px}
                    y2={py}
                    stroke={axis.color}
                    strokeWidth="1.2"
                    strokeDasharray="2,2"
                    opacity={isBack ? 0.35 : 0.75}
                  />
                  <circle
                    cx={px}
                    cy={py}
                    r="4.5"
                    fill={axis.bgColor}
                    stroke="rgba(255, 255, 255, 0.25)"
                    strokeWidth="1"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSnapView?.(axis.view);
                    }}
                  />
                </g>
              );
            }

            return (
              <g key={axis.id}>
                <line
                  x1={cx}
                  y1={cy}
                  x2={px}
                  y2={py}
                  stroke={axis.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  opacity={isBack ? 0.6 : 1}
                />
                <circle
                  cx={px}
                  cy={py}
                  r="8"
                  fill={axis.bgColor}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.6))"
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnapView?.(axis.view);
                  }}
                />
                <text
                  x={px}
                  y={py + 3.2}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="900"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  pointerEvents="none"
                >
                  {axis.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

/**
 * Creates a Google Maps 3D Marker element (<gmp-marker-3d>).
 */
function create3DMarker(lat, lng, alt = 20, label = 'Waypoint', extruded = true) {
  let marker = null;
  const MarkerClass = window.google?.maps?.maps3d?.Marker3DElement;
  const AltMode = window.google?.maps?.maps3d?.AltitudeMode;

  if (typeof MarkerClass === 'function') {
    try {
      marker = new MarkerClass({
        position: { lat, lng, altitude: alt },
        altitudeMode: AltMode?.ABSOLUTE || 'ABSOLUTE',
        extruded: extruded,
        label: label
      });
    } catch (e) {
      console.warn('Marker3DElement init note:', e);
    }
  }

  if (!marker) {
    marker = document.createElement('gmp-marker-3d');
    marker.setAttribute('altitude-mode', 'absolute');
    if (extruded) marker.setAttribute('extruded', 'true');
    marker.setAttribute('label', label);
    try {
      marker.position = { lat, lng, altitude: alt };
    } catch (e) {}
  }

  return marker;
}

/**
 * Creates a Google Maps 3D Model element (<gmp-model-3d>) for the humanoid robot.
 * Uses RELATIVE_TO_GROUND so the robot's feet are clamped firmly to the real physical street/sidewalk surface.
 * Scale is 0.48 calibrated to real-life 2.2m humanoid proportions in urban 3D tiles.
 */
function createRobotModel(lat, lng, alt = 0.1, heading = 0, scale = 0.48, src = '/models/humanoid_robot.glb') {
  let model = null;
  const ModelClass = window.google?.maps?.maps3d?.Model3DElement;
  const AltMode = window.google?.maps?.maps3d?.AltitudeMode;
  const resolvedAltMode = (alt > 2.0)
    ? (AltMode?.RELATIVE_TO_MESH || AltMode?.RELATIVE_TO_GROUND || 'RELATIVE_TO_MESH')
    : (AltMode?.RELATIVE_TO_MESH || AltMode?.CLAMP_TO_GROUND || AltMode?.RELATIVE_TO_GROUND || 'RELATIVE_TO_GROUND');

  const resolvedSrc = typeof window !== 'undefined' && window.location
    ? new URL(src, window.location.origin).href
    : src;

  if (typeof ModelClass === 'function') {
    try {
      model = new ModelClass({
        src: resolvedSrc,
        position: { lat, lng, altitude: alt },
        scale: scale,
        orientation: { heading, tilt: 0, roll: 0 },
        altitudeMode: resolvedAltMode
      });
    } catch (e) {
      console.warn('Model3DElement init note:', e);
    }
  }

  if (!model) {
    model = document.createElement('gmp-model-3d');
    model.setAttribute('src', resolvedSrc);
    model.setAttribute('scale', String(scale));
    model.setAttribute('altitude-mode', 'relative-to-mesh');
    try {
      model.position = { lat, lng, altitude: alt };
      model.orientation = { heading, tilt: 0, roll: 0 };
    } catch (e) {}
  }

  return model;
}

/**
 * Computes exact camera transform for any cinematic shot angle.
 * Safely calibrated to prevent ground-clipping and extreme close-up photogrammetry blur.
 */
function computeCameraShotTransform(mode, pose, currentTime = 0, cameraShots = null) {
  const safePose = pose || {
    lat: 37.7952,
    lng: -122.4028,
    heading: 0,
    altitudeOffset: 0.0
  };

  let activeAngle = (mode || 'free').toLowerCase();
  let activeShotLabel = mode ? mode.toUpperCase() : 'FREE';
  let cutNumber = 1;

  if (mode === 'auto_director') {
    if (cameraShots && cameraShots.length > 0) {
      for (let i = 0; i < cameraShots.length; i++) {
        const s = cameraShots[i];
        if (s.start_time <= currentTime && currentTime < s.end_time) {
          activeAngle = (s.angle || '3rd_person').toLowerCase();
          activeShotLabel = s.label || s.angle;
          cutNumber = i + 1;
          break;
        }
      }
      if (activeAngle === 'auto_director') {
        const lastShot = cameraShots[cameraShots.length - 1];
        activeAngle = (lastShot.angle || '3rd_person').toLowerCase();
        activeShotLabel = lastShot.label || lastShot.angle;
        cutNumber = cameraShots.length;
      }
    } else {
      activeAngle = '3rd_person';
      activeShotLabel = '3rd Person Tracking';
    }
  }

  let centerAltOffset = 1.4;
  let heading = safePose.heading || 0;
  let tilt = 66.0;
  let range = 18.0;

  switch (activeAngle) {
    case 'forward_lead':
    case 'first_person_pov':
    case 'first_person':
    case 'head_on':
    case 'lead':
    case 'reverse_chase':
      // Reverse tracking camera ahead of vehicle looking backward down open avenue
      centerAltOffset = 1.2;
      heading = ((safePose.heading || 0) + 180.0) % 360;
      tilt = 66.0;
      range = 16.0;
      activeShotLabel = 'Forward Leading Cam';
      break;

    case 'hero_low':
    case 'hero_low_angle':
    case 'hero_follow':
    case 'hero':
    case 'low_angle':
      // Cinematic low 3/4 heroic angle: low curb height with upward gaze at hood & architecture
      centerAltOffset = 0.8;
      heading = ((safePose.heading || 0) - 24.0 + 360) % 360;
      tilt = 72.0;
      range = 14.5;
      activeShotLabel = 'Hero Low 3/4 Follow';
      break;

    case 'action_closeup':
    case 'closeup':
    case 'drift_spin':
    case 'tight':
      // Medium telephoto action profile: frames vehicle drift and collision dynamics
      centerAltOffset = 1.0;
      heading = ((safePose.heading || 0) + 26.0) % 360;
      tilt = 67.0;
      range = 12.0;
      activeShotLabel = 'Action Medium Profile';
      break;

    case 'drone_overhead':
    case 'drone_survey':
    case 'drone_wide':
    case 'aerial':
    case 'birds_eye':
    case 'wide':
      // Elevated aerial crane / survey jib
      centerAltOffset = 12.0;
      heading = ((safePose.heading || 0) - 15.0 + 360) % 360;
      tilt = 48.0;
      range = 42.0;
      activeShotLabel = 'Aerial Drone Survey';
      break;

    case 'side_dolly':
    case 'dolly':
    case 'profile':
      // Parallel street sidewalk dolly tracking
      centerAltOffset = 1.2;
      heading = ((safePose.heading || 0) + 55.0) % 360;
      tilt = 64.0;
      range = 15.5;
      activeShotLabel = 'Sidewalk Dolly Tracking';
      break;

    case 'orbit_ascent':
    case 'orbit':
    case 'corridor_sweep':
      // Dynamic sweep around vehicle during stunt
      centerAltOffset = 2.0;
      heading = ((safePose.heading || 0) + Math.sin(currentTime * 1.6) * 32.0 + 360) % 360;
      tilt = 63.0;
      range = 17.0;
      activeShotLabel = 'Corridor Orbit Sweep';
      break;

    case 'impact':
    case 'impact_closeup':
    case 'crash':
      // Low witness camera at collision zone
      centerAltOffset = 0.8;
      heading = ((safePose.heading || 0) + 110.0) % 360;
      tilt = 71.0;
      range = 13.0;
      activeShotLabel = 'Crash Impact Witness';
      break;

    case '3rd_person':
    case 'third_person_chase':
    case 'third_person':
    case 'chase':
    default:
      // Over-the-shoulder chase tracking
      centerAltOffset = 1.4;
      heading = safePose.heading || 0;
      tilt = 66.0;
      range = 18.0;
      activeShotLabel = '3rd Person Chase Tracking';
      break;
  }

  const BASE_GROUND_OFFSET = 0.55;

  return {
    center: {
      lat: safePose.lat ?? 37.7952,
      lng: safePose.lng ?? -122.4028,
      altitude: (safePose.altitudeOffset || 0.0) + BASE_GROUND_OFFSET + centerAltOffset,
      altitudeMode: 'RELATIVE_TO_GROUND'
    },
    heading,
    tilt,
    range,
    shotLabel: activeShotLabel,
    activeAngle,
    cutNumber
  };
}


export default function CityViewport({
  isSelectingLocation = false,
  setIsSelectingLocation,
  sceneCenter,
  setSceneCenter,
  cameraAngle,
  setCameraAngle,
  isLocationConfirmed = false,
  setIsLocationConfirmed,
  // AI Scene Director & Humanoid Robot props
  activeScene = null,
  currentTime = 0,
  isPlaying = false,
  cameraMode = 'auto_director',
  onChangeCameraMode,
  isPositioningRobot = false,
  onDropRobotPosition,
  onUpdateCurrentFrame,
  placedRobotPos = null,
  getCanvasRef,
  // User Interactive Route Directing & JSON Transparency props
  isDirectRouteMode = false,
  onToggleDirectRouteMode,
  customDirectedWaypoints = [],
  onAddDirectWaypoint,
  onRemoveDirectWaypoint,
  onClearDirectedWaypoints,
  onDirectCustomPath,
  onOpenJsonProtocolModal,
  isRecordingVideo = false,
  // Camera Rail Directing Props
  isDrawCameraRailMode = false,
  onAddCameraRailWaypoint,
  cameraRailWaypoints = [],
  cameraRailFrames = [],
  cameraRailAltitudeOffset = 18.0,
  // 3D Model Catalog & Object Motion Directing Props
  isPlacingModel = false,
  onDropPlacedModel,
  placedModelPos = null,
  isDrawObjectPathMode = false,
  onAddObjectWaypoint,
  objectWaypoints = [],
  // Screenplay AI Scene Director Props
  isPickingScreenplayStage = false,
  onDropScreenplayStage,
  screenplayStagePos = null,
  activeTab = null
}) {
  const mapContainerRef = useRef(null);
  const mapElementRef = useRef(null);
  const horizontalZoneRef = useRef(null);
  const activeMaskElementsRef = useRef([]);

  const currentPoseRef = useRef(null);
  const currentFrameRef = useRef(null);

  const confirmedZoneCenterRef = useRef(null);
  const activeGridElementsRef = useRef([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [isOrbiting, setIsOrbiting] = useState(false);
  const [isGridVisible, setIsGridVisible] = useState(true);
  const [gridAltitudeOffset, setGridAltitudeOffset] = useState(0);
  const [aiLensMode, setAiLensMode] = useState('cinema_35mm'); // 'cinema_35mm' | 'golden_hour' | 'hdr_clarity' | 'off'
  const [showVisualOverlays, setShowVisualOverlays] = useState(true);

  // Cinematic Cut Tracking State & Refs
  const lastCutAngleRef = useRef(null);
  const flightEndTimeRef = useRef(0);
  const [activeCutInfo, setActiveCutInfo] = useState({ label: '', angle: '', cutNumber: 1 });

  // Scene Director dynamic 3D element refs
  const activeRobotModelRef = useRef(null);
  const activeModelGlbRef = useRef('/models/humanoid_idle.glb');
  const activeRobotMarkerRef = useRef(null);
  const activeTrajectoryPolylineRef = useRef(null);
  const activeWaypointMarkersRef = useRef([]);
  const activePulseRingRef = useRef(null);

  // Camera Rail 3D elements and multi-actor map refs
  const activeCameraRailPolylineRef = useRef(null);
  const activeCameraRailMarkersRef = useRef([]);
  const activeMultiActorsMapRef = useRef({});

  const isDrawCameraRailModeRef = useRef(isDrawCameraRailMode);
  useEffect(() => {
    isDrawCameraRailModeRef.current = isDrawCameraRailMode;
  }, [isDrawCameraRailMode]);

  const onAddCameraRailWaypointRef = useRef(onAddCameraRailWaypoint);
  useEffect(() => {
    onAddCameraRailWaypointRef.current = onAddCameraRailWaypoint;
  }, [onAddCameraRailWaypoint]);

  const cameraRailAltitudeOffsetRef = useRef(cameraRailAltitudeOffset);
  useEffect(() => {
    cameraRailAltitudeOffsetRef.current = cameraRailAltitudeOffset;
  }, [cameraRailAltitudeOffset]);

  const [latestFrameForTwin, setLatestFrameForTwin] = useState(null);

  const isPositioningRobotRef = useRef(isPositioningRobot);
  useEffect(() => {
    isPositioningRobotRef.current = isPositioningRobot;
  }, [isPositioningRobot]);

  const isDirectRouteModeRef = useRef(isDirectRouteMode);
  useEffect(() => {
    isDirectRouteModeRef.current = isDirectRouteMode;
  }, [isDirectRouteMode]);

  const onAddDirectWaypointRef = useRef(onAddDirectWaypoint);
  useEffect(() => {
    onAddDirectWaypointRef.current = onAddDirectWaypoint;
  }, [onAddDirectWaypoint]);

  const onDropRobotPositionRef = useRef(onDropRobotPosition);
  useEffect(() => {
    onDropRobotPositionRef.current = onDropRobotPosition;
  }, [onDropRobotPosition]);

  const onUpdateCurrentFrameRef = useRef(onUpdateCurrentFrame);
  useEffect(() => {
    onUpdateCurrentFrameRef.current = onUpdateCurrentFrame;
  }, [onUpdateCurrentFrame]);

  const isPlacingModelRef = useRef(isPlacingModel);
  useEffect(() => {
    isPlacingModelRef.current = isPlacingModel;
  }, [isPlacingModel]);

  const onDropPlacedModelRef = useRef(onDropPlacedModel);
  useEffect(() => {
    onDropPlacedModelRef.current = onDropPlacedModel;
  }, [onDropPlacedModel]);

  const isDrawObjectPathModeRef = useRef(isDrawObjectPathMode);
  useEffect(() => {
    isDrawObjectPathModeRef.current = isDrawObjectPathMode;
  }, [isDrawObjectPathMode]);

  const onAddObjectWaypointRef = useRef(onAddObjectWaypoint);
  useEffect(() => {
    onAddObjectWaypointRef.current = onAddObjectWaypoint;
  }, [onAddObjectWaypoint]);

  const isPickingScreenplayStageRef = useRef(isPickingScreenplayStage);
  useEffect(() => {
    isPickingScreenplayStageRef.current = isPickingScreenplayStage;
  }, [isPickingScreenplayStage]);

  const onDropScreenplayStageRef = useRef(onDropScreenplayStage);
  useEffect(() => {
    onDropScreenplayStageRef.current = onDropScreenplayStage;
  }, [onDropScreenplayStage]);

  const isSelectingLocationRef = useRef(isSelectingLocation);
  useEffect(() => {
    isSelectingLocationRef.current = isSelectingLocation;
  }, [isSelectingLocation]);

  useEffect(() => {
    if (getCanvasRef) {
      getCanvasRef.current = () => {
        const map = mapElementRef.current;
        if (!map) return null;
        // Recursively inspect map shadow root for Google Maps 3D WebGL canvas
        const findCanvas = (node) => {
          if (!node) return null;
          if (node.tagName === 'CANVAS' && node.id !== 'humanoid-kinematics-canvas') return node;
          if (node.shadowRoot) {
            const res = findCanvas(node.shadowRoot);
            if (res) return res;
          }
          const children = node.children || node.childNodes || [];
          for (let i = 0; i < children.length; i++) {
            const res = findCanvas(children[i]);
            if (res) return res;
          }
          return null;
        };

        return findCanvas(map.shadowRoot) || findCanvas(map);
      };
    }
  }, [getCanvasRef]);

  const currentTimeRef = useRef(currentTime);
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  const activeSceneRef = useRef(activeScene);
  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);

  const currentCenter = (sceneCenter && sceneCenter.lat !== undefined)
    ? sceneCenter
    : (DEFAULT_CITIES?.[0] || { lat: 37.7952, lng: -122.4028, altitude: 240, tilt: 67.5, heading: 45.0, range: 480 });
  const currentCenterRef = useRef(currentCenter);
  useEffect(() => {
    currentCenterRef.current = currentCenter;
  }, [currentCenter]);

  const isLocationConfirmedRef = useRef(isLocationConfirmed);
  useEffect(() => {
    isLocationConfirmedRef.current = isLocationConfirmed;
  }, [isLocationConfirmed]);

  const cameraStateRef = useRef({
    lat: currentCenter.lat ?? 37.7952,
    lng: currentCenter.lng ?? -122.4028,
    altitude: currentCenter.altitude || 200,
    tilt: cameraAngle?.tilt ?? 60.0,
    heading: cameraAngle?.heading ?? 45.0,
    range: cameraAngle?.range ?? 480
  });

  const [hudCamera, setHudCamera] = useState({
    lat: currentCenter.lat ?? 37.7952,
    lng: currentCenter.lng ?? -122.4028,
    altitude: currentCenter.altitude || 200,
    tilt: cameraAngle?.tilt ?? 60.0,
    heading: cameraAngle?.heading ?? 45.0,
    range: cameraAngle?.range ?? 480
  });

  // Re-creates the 0.25-mile cyan circular selection zone at (lat, lng)
  // Replacing the element forces Google Maps 3D WebGL to re-triangulate and render at the new position immediately
  const updateSelectionCircle = useCallback((lat, lng) => {
    if (lat === undefined || lng === undefined) return;
    const map = mapElementRef.current;
    if (!map) return;

    if (horizontalZoneRef.current) {
      try {
        if (horizontalZoneRef.current.parentNode) {
          horizontalZoneRef.current.parentNode.removeChild(horizontalZoneRef.current);
        }
      } catch (e) {}
      horizontalZoneRef.current = null;
    }

    if (isLocationConfirmedRef.current) return;

    const newZone = createSelectionPolygon(lat, lng);
    try {
      map.appendChild(newZone);
      horizontalZoneRef.current = newZone;
    } catch (e) {
      console.warn('Failed to append selection zone:', e);
    }
  }, []);

  const updateSelectionCircleRef = useRef(updateSelectionCircle);
  useEffect(() => {
    updateSelectionCircleRef.current = updateSelectionCircle;
  }, [updateSelectionCircle]);

  // 1. Initialize Google Maps 3D Photorealistic Map Element
  useEffect(() => {
    let isMounted = true;

    async function init3DMap() {
      let attempts = 0;
      while (!window.google?.maps?.importLibrary && attempts < 30) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }

      if (window.google?.maps?.importLibrary) {
        try {
          await window.google.maps.importLibrary('maps3d');
        } catch (err) {
          console.warn('Waiting for maps3d library note:', err);
        }
      }
      if (!customElements.get('gmp-map-3d')) {
        try {
          await customElements.whenDefined('gmp-map-3d');
        } catch (err) {
          console.error('Waiting for gmp-map-3d error:', err);
        }
      }

      if (!isMounted || !mapContainerRef.current) return;
      mapContainerRef.current.innerHTML = '';

      const center = currentCenterRef.current?.lat !== undefined
        ? currentCenterRef.current
        : (currentCenter?.lat !== undefined ? currentCenter : DEFAULT_CITIES[0]);
      const tilt = cameraAngle?.tilt ?? 67.5;
      const heading = cameraAngle?.heading ?? 45.0;
      const range = cameraAngle?.range ?? 480;

      // Create Google Maps 3D element (streams real-life photorealistic 3D buildings)
      const map3d = document.createElement('gmp-map-3d');
      map3d.setAttribute('mode', 'SATELLITE');
      map3d.mode = 'SATELLITE';
      map3d.setAttribute('center', `${center.lat},${center.lng},${center.altitude || 200}`);
      map3d.setAttribute('tilt', String(tilt));
      map3d.setAttribute('heading', String(heading));
      map3d.setAttribute('range', String(range));
      map3d.style.width = '100%';
      map3d.style.height = '100%';
      map3d.style.position = 'absolute';
      map3d.style.inset = '0';

      // Keep cameraStateRef updated on animation completion
      map3d.addEventListener('gmp-animationend', () => {
        if (map3d.center) {
          const lat = typeof map3d.center.lat === 'function' ? map3d.center.lat() : map3d.center.lat;
          const lng = typeof map3d.center.lng === 'function' ? map3d.center.lng() : map3d.center.lng;
          const alt = typeof map3d.center.altitude === 'function' ? map3d.center.altitude() : (map3d.center.altitude ?? cameraStateRef.current.altitude);
          cameraStateRef.current.lat = lat ?? cameraStateRef.current.lat;
          cameraStateRef.current.lng = lng ?? cameraStateRef.current.lng;
          cameraStateRef.current.altitude = alt ?? cameraStateRef.current.altitude;
          cameraStateRef.current.tilt = map3d.tilt ?? cameraStateRef.current.tilt;
          cameraStateRef.current.heading = map3d.heading ?? cameraStateRef.current.heading;
          cameraStateRef.current.range = map3d.range ?? cameraStateRef.current.range;
          setHudCamera({
            lat: cameraStateRef.current.lat,
            lng: cameraStateRef.current.lng,
            altitude: Math.round(cameraStateRef.current.altitude),
            tilt: Math.round(cameraStateRef.current.tilt),
            heading: Math.round(cameraStateRef.current.heading),
            range: Math.round(cameraStateRef.current.range)
          });
        }
      });

      // Click on satellite map to reposition extraction point or drop robot
      map3d.addEventListener('gmp-click', (e) => {
        const pos = e.position || e.detail?.position || e.latLng || e.detail?.latLng;
        if (!pos) return;
        const lat = typeof pos.lat === 'function' ? pos.lat() : pos.lat;
        const lng = typeof pos.lng === 'function' ? pos.lng() : pos.lng;
        const alt = typeof pos.altitude === 'function' ? pos.altitude() : (pos.altitude || 20);

        // If in "Position Robot" mode, drop robot here immediately!
        if (isPositioningRobotRef.current) {
          if (lat !== undefined && lng !== undefined) {
            onDropRobotPositionRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(alt || 20),
              heading: 45
            });
            return;
          }
        }

        // If in "Draw Camera Rail" mode, add waypoint along camera flight line!
        if (isDrawCameraRailModeRef.current) {
          if (lat !== undefined && lng !== undefined) {
            onAddCameraRailWaypointRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(Number(alt || 20) + (cameraRailAltitudeOffsetRef.current || 18.0))
            });
            return;
          }
        }

        // If in "Direct Route" mode, add waypoint along path!
        if (isDirectRouteModeRef.current) {
          if (lat !== undefined && lng !== undefined) {
            onAddDirectWaypointRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(alt || 20)
            });
            return;
          }
        }

        // If in "Place 3D Model" mode, drop placed model at clicked coordinate!
        if (isPlacingModelRef.current) {
          if (lat !== undefined && lng !== undefined) {
            onDropPlacedModelRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(alt || 20),
              heading: 45
            });
            return;
          }
        }

        // If in "Draw Object Motion Path" mode, add waypoint for active object!
        if (isDrawObjectPathModeRef.current) {
          if (lat !== undefined && lng !== undefined) {
            onAddObjectWaypointRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(alt || 20)
            });
            return;
          }
        }

        // If in "Pick Screenplay Stage" mode, drop stage anchor at clicked coordinate!
        if (isPickingScreenplayStageRef.current) {
          if (lat !== undefined && lng !== undefined) {
            const currentViewHeading = Math.round(map3d.heading ?? cameraStateRef.current.heading ?? 0);
            onDropScreenplayStageRef.current?.({
              lat: Number(lat),
              lng: Number(lng),
              altitude: Math.round(alt || 20),
              heading: currentViewHeading
            });
            return;
          }
        }

        // Only reposition custom location if "Pin Custom Location on 3D Map" is explicitly active!
        if (!isSelectingLocationRef.current) return;
        if (isLocationConfirmedRef.current) return;

        if (lat !== undefined && lng !== undefined) {
          // Immediately move the selection circle to the clicked coordinate!
          updateSelectionCircleRef.current?.(lat, lng);

          setSceneCenter({
            lat: Number(lat),
            lng: Number(lng),
            altitude: Math.max(100, Math.round(alt)),
            groundAltitude: Math.round(alt || 0),
            name: `Custom Location (${Number(lat).toFixed(4)}°, ${Number(lng).toFixed(4)}°)`
          });

          // Turn off picking mode once point is anchored
          setIsSelectingLocation?.(false);

          if (typeof map3d.flyCameraTo === 'function') {
            map3d.flyCameraTo({
              endCamera: {
                center: { lat: Number(lat), lng: Number(lng), altitude: alt },
                tilt: map3d.tilt || 67.5,
                heading: map3d.heading || 45,
                range: map3d.range || 480
              },
              durationMillis: 1100
            });
          }
        }
      });

      // Horizontal 0.25-Mile Selection Indicator (only created in selection mode)
      if (!isLocationConfirmed) {
        try {
          const initialZone = createSelectionPolygon(center.lat, center.lng);
          if (initialZone) {
            map3d.appendChild(initialZone);
            horizontalZoneRef.current = initialZone;
          }
        } catch (e) {
          console.warn('Failed to append initialZone:', e);
        }
      }

      mapContainerRef.current.appendChild(map3d);
      mapElementRef.current = map3d;
      setIsMapLoaded(true);
    }

    init3DMap();

    return () => {
      isMounted = false;
      if (mapContainerRef.current) {
        mapContainerRef.current.innerHTML = '';
      }
      mapElementRef.current = null;
      horizontalZoneRef.current = null;
      activeMaskElementsRef.current = [];

      // Cleanup all dynamic scene director elements
      if (activeRobotModelRef.current && activeRobotModelRef.current.parentNode) {
        activeRobotModelRef.current.parentNode.removeChild(activeRobotModelRef.current);
      }
      activeRobotModelRef.current = null;
      if (activeRobotMarkerRef.current && activeRobotMarkerRef.current.parentNode) {
        activeRobotMarkerRef.current.parentNode.removeChild(activeRobotMarkerRef.current);
      }
      activeRobotMarkerRef.current = null;
      if (activeTrajectoryPolylineRef.current && activeTrajectoryPolylineRef.current.parentNode) {
        activeTrajectoryPolylineRef.current.parentNode.removeChild(activeTrajectoryPolylineRef.current);
      }
      activeTrajectoryPolylineRef.current = null;
      activeWaypointMarkersRef.current.forEach(m => {
        try { if (m && m.parentNode) m.parentNode.removeChild(m); } catch (e) {}
      });
      activeWaypointMarkersRef.current = [];
      if (activePulseRingRef.current && activePulseRingRef.current.parentNode) {
        activePulseRingRef.current.parentNode.removeChild(activePulseRingRef.current);
      }
      activePulseRingRef.current = null;
    };
  }, []);

  // 2. Real-time Camera Sync Loop (Syncs Blender Gizmo rotation with native 60 FPS WebGL map movement)
  useEffect(() => {
    if (!isMapLoaded) return;
    let rafId;
    let lastHeading = -999;
    let lastTilt = -999;
    let lastRange = -999;

    const checkCamera = () => {
      const map = mapElementRef.current;
      if (map) {
        const h = map.heading ?? cameraStateRef.current.heading;
        const t = map.tilt ?? cameraStateRef.current.tilt;
        const r = map.range ?? cameraStateRef.current.range;

        if (Math.abs(h - lastHeading) > 0.1 || Math.abs(t - lastTilt) > 0.1 || Math.abs(r - lastRange) > 2) {
          lastHeading = h;
          lastTilt = t;
          lastRange = r;
          cameraStateRef.current.heading = h;
          cameraStateRef.current.tilt = t;
          cameraStateRef.current.range = r;
          if (map.center) {
            const lat = typeof map.center.lat === 'function' ? map.center.lat() : map.center.lat;
            const lng = typeof map.center.lng === 'function' ? map.center.lng() : map.center.lng;
            const alt = typeof map.center.altitude === 'function' ? map.center.altitude() : map.center.altitude;
            if (lat !== undefined) cameraStateRef.current.lat = lat;
            if (lng !== undefined) cameraStateRef.current.lng = lng;
            if (alt !== undefined) cameraStateRef.current.altitude = alt;
          }

          setHudCamera({
            heading: Math.round(h * 10) / 10,
            tilt: Math.round(t * 10) / 10,
            range: Math.round(r),
            lat: cameraStateRef.current.lat,
            lng: cameraStateRef.current.lng,
            altitude: Math.round(cameraStateRef.current.altitude)
          });
        }
      }
      rafId = requestAnimationFrame(checkCamera);
    };

    rafId = requestAnimationFrame(checkCamera);
    return () => cancelAnimationFrame(rafId);
  }, [isMapLoaded]);

  // 3. Automatically fly camera to preview city whenever sceneCenter changes (preset buttons or map pick)
  const lastFlownCenterRef = useRef(null);

  useEffect(() => {
    const map = mapElementRef.current;
    if (!map || !sceneCenter || sceneCenter.lat === undefined) return;

    // Detect actual coordinate change
    const curKey = `${Number(sceneCenter.lat).toFixed(4)}_${Number(sceneCenter.lng).toFixed(4)}`;
    if (lastFlownCenterRef.current === curKey) return;
    lastFlownCenterRef.current = curKey;

    // Update selection circle if in location picking mode
    if (!isLocationConfirmed && typeof updateSelectionCircle === 'function') {
      updateSelectionCircle(sceneCenter.lat, sceneCenter.lng);
    }

    const targetAlt = Number(sceneCenter.altitude || 240);
    const targetTilt = Number(cameraAngle?.tilt ?? 64.0);
    const targetHeading = Number(cameraAngle?.heading ?? 45.0);
    const targetRange = Number(cameraAngle?.range ?? 520);

    // Smooth dramatic flight to preview the selected city in 3D
    if (typeof map.flyCameraTo === 'function') {
      map.flyCameraTo({
        endCamera: {
          center: {
            lat: Number(sceneCenter.lat),
            lng: Number(sceneCenter.lng),
            altitude: targetAlt
          },
          tilt: targetTilt,
          heading: targetHeading,
          range: targetRange
        },
        durationMillis: 2200
      });
    } else {
      try {
        map.center = { lat: Number(sceneCenter.lat), lng: Number(sceneCenter.lng), altitude: targetAlt };
        map.tilt = targetTilt;
        map.heading = targetHeading;
        map.range = targetRange;
      } catch (e) {}
    }
  }, [sceneCenter, cameraAngle, isLocationConfirmed, updateSelectionCircle]);

  // 4. Handle Confirmation: REMOVE BLUE THING, APPLY SEAMLESS MASKS & BLENDER 3D GRID
  useEffect(() => {
    const map = mapElementRef.current;
    if (!map) return;

    // Clear any previous mask elements
    activeMaskElementsRef.current.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    activeMaskElementsRef.current = [];

    // Clear any previous grid elements
    activeGridElementsRef.current.forEach(el => {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
    activeGridElementsRef.current = [];

    if (isLocationConfirmed) {
      // REQUIREMENT: Completely remove the blue ring ("remove the blue thing")
      if (horizontalZoneRef.current && horizontalZoneRef.current.parentNode) {
        horizontalZoneRef.current.parentNode.removeChild(horizontalZoneRef.current);
        horizontalZoneRef.current = null;
      }

      const center = (sceneCenter && sceneCenter.lat !== undefined) ? sceneCenter : currentCenter;
      if (!center || center.lat === undefined) return;
      confirmedZoneCenterRef.current = { ...center };

      // Unlock camera movement bounds and range limits for free Blender navigation
      try {
        map.bounds = null;
        map.maxAltitude = null;
        map.maxRange = null;
        map.minRange = 10;
        map.minTilt = 0;
        map.maxTilt = 85;
      } catch (err) {
        console.warn('Map bounds configuration note:', err);
      }

      const newMasks = [];

      // REQUIREMENT: FIX GLITCH SEAMS
      // We ONLY use 3 concentric annular sector rings without holes or inner paths!
      // Simple 4-vertex quadrilateral quads [in1, out1, out2, in2, in1] guarantee
      // ZERO ear-clipping hole bridges and ZERO cuts through the 0.25-mile model.
      // Ring 1: Immediate zone (402.34m to 6,000m) - 48 sectors
      // Dark slate/charcoal ground tone (#181b22) matching Blender's 3D viewport floor
      const ring1Quads = generateSectorQuads(center.lat, center.lng, QUARTER_MILE_METERS, 6000, 48);
      ring1Quads.forEach(quad => {
        const fl = createFlattener(quad);
        map.appendChild(fl);
        newMasks.push(fl);

        const poly = createGroundPolygon(quad, '#181b22');
        map.appendChild(poly);
        newMasks.push(poly);
      });

      // Ring 2: Metropolitan area (6,000m to 35,000m) - 32 sectors
      const ring2Quads = generateSectorQuads(center.lat, center.lng, 6000, 35000, 32);
      ring2Quads.forEach(quad => {
        const fl = createFlattener(quad);
        map.appendChild(fl);
        newMasks.push(fl);

        const poly = createGroundPolygon(quad, '#0c0e12');
        map.appendChild(poly);
        newMasks.push(poly);
      });

      // Ring 3: Horizon buffer (35,000m to 120,000m) - 24 sectors
      const ring3Quads = generateSectorQuads(center.lat, center.lng, 35000, 120000, 24);
      ring3Quads.forEach(quad => {
        const fl = createFlattener(quad);
        map.appendChild(fl);
        newMasks.push(fl);

        const poly = createGroundPolygon(quad, '#000000');
        map.appendChild(poly);
        newMasks.push(poly);
      });

      activeMaskElementsRef.current = newMasks;

      cameraStateRef.current = {
        lat: center.lat,
        lng: center.lng,
        altitude: center.altitude || 200,
        tilt: 60.0,
        heading: map.heading || 45.0,
        range: 480
      };
      setHudCamera({ ...cameraStateRef.current });

      // Frame camera smoothly on isolated 0.25-mile model
      if (typeof map.flyCameraTo === 'function') {
        map.flyCameraTo({
          endCamera: {
            center: { lat: center.lat, lng: center.lng, altitude: center.altitude || 200 },
            tilt: 60.0,
            heading: map.heading || 45.0,
            range: 480
          },
          durationMillis: 1000
        });
      }
    } else {
      // Location selection mode: restore selection indicator at current target
      confirmedZoneCenterRef.current = null;
      const center = (sceneCenter && sceneCenter.lat !== undefined) ? sceneCenter : currentCenter;
      if (center && center.lat !== undefined) {
        updateSelectionCircle(center.lat, center.lng);
      }
    }
  }, [isLocationConfirmed, sceneCenter, currentCenter, updateSelectionCircle]);



  // Synchronize AI Scene 3D Trajectory Polyline & Waypoint Pins
  useEffect(() => {
    const map = mapElementRef.current;
    if (!map) return;

    // 1. Purge ALL old trajectory polylines from the map DOM (guarantees previous direction movements are completely eliminated)
    try {
      const allPolylines = map.querySelectorAll('gmp-polyline-3d');
      allPolylines.forEach(p => {
        if (p !== activePulseRingRef.current && p.parentNode) {
          try { p.parentNode.removeChild(p); } catch (e) {}
        }
      });
      activeTrajectoryPolylineRef.current = null;
    } catch (e) {}

    // 2. Clean up old waypoint markers and pins
    activeWaypointMarkersRef.current.forEach(m => {
      try {
        if (m && m.parentNode) m.parentNode.removeChild(m);
      } catch (e) {}
    });
    activeWaypointMarkersRef.current = [];

    // Purge ALL lingering or orphaned 3D waypoint markers from the map DOM (preserve only active robot marker)
    try {
      const allMarkers = map.querySelectorAll('gmp-marker-3d');
      allMarkers.forEach(m => {
        if (m !== activeRobotMarkerRef.current && m.parentNode) {
          try { m.parentNode.removeChild(m); } catch (e) {}
        }
      });
    } catch (e) {}

    // Determine if trajectory ribbons and waypoint pins should be hidden (auto-hidden during recording or clean mode)
    const hideOverlays = isRecordingVideo || !showVisualOverlays;

    if (!hideOverlays) {
      if (customDirectedWaypoints && customDirectedWaypoints.length > 0 && (!activeScene || activeScene.waypoints?.length !== customDirectedWaypoints.length)) {
        // User is actively drawing or editing direction route: show fresh drawn path!
        const drawnCoords = customDirectedWaypoints
          .filter(wp => wp && (wp.lat !== undefined || wp.latLng?.lat !== undefined))
          .map(wp => ({
            lat: wp.lat ?? wp.latLng?.lat,
            lng: wp.lng ?? wp.latLng?.lng,
            altitude: 0.1
          }));

        if (drawnCoords.length >= 2) {
          const drawnPoly = createPolyline(drawnCoords, '#00f2fe', 4.5, 0.1, 'RELATIVE_TO_GROUND');
          map.appendChild(drawnPoly);
          activeTrajectoryPolylineRef.current = drawnPoly;
        }

        // Add numbered 3D Waypoint Pins for user-drawn path
        customDirectedWaypoints.forEach((wp, idx) => {
          if (!wp) return;
          const wpLat = wp.lat ?? wp.latLng?.lat;
          const wpLng = wp.lng ?? wp.latLng?.lng;
          if (wpLat === undefined || wpLng === undefined) return;
          const actionTag = (wp.action || (idx === 0 ? 'SPAWN' : 'WALK')).toUpperCase();
          const shortPrompt = wp.prompt ? (wp.prompt.length > 20 ? wp.prompt.substring(0, 20) + '...' : wp.prompt) : actionTag;
          const pinLabel = `[${idx + 1}] ${actionTag}: ${shortPrompt}`;
          const pin = create3DMarker(wpLat, wpLng, 2.2, pinLabel, false);
          map.appendChild(pin);
          activeWaypointMarkersRef.current.push(pin);
        });
      } else if (objectWaypoints && objectWaypoints.length > 0 && (!activeScene || activeScene.waypoints?.length !== objectWaypoints.length)) {
        // User is actively drawing or editing object motion path (emerald ribbon)!
        const objCoords = objectWaypoints
          .filter(wp => wp && (wp.lat !== undefined || wp.latLng?.lat !== undefined))
          .map(wp => ({
            lat: wp.lat ?? wp.latLng?.lat,
            lng: wp.lng ?? wp.latLng?.lng,
            altitude: 0.1
          }));

        if (objCoords.length >= 2) {
          const drawnPoly = createPolyline(objCoords, '#10b981', 4.5, 0.1, 'RELATIVE_TO_GROUND');
          map.appendChild(drawnPoly);
          activeTrajectoryPolylineRef.current = drawnPoly;
        }

        objectWaypoints.forEach((wp, idx) => {
          if (!wp) return;
          const wpLat = wp.lat ?? wp.latLng?.lat;
          const wpLng = wp.lng ?? wp.latLng?.lng;
          if (wpLat === undefined || wpLng === undefined) return;
          const actionTag = (wp.action || (idx === 0 ? 'SPAWN' : 'CRUISE')).toUpperCase();
          const shortPrompt = wp.prompt ? (wp.prompt.length > 20 ? wp.prompt.substring(0, 20) + '...' : wp.prompt) : actionTag;
          const pinLabel = `[${idx + 1}] ${actionTag}: ${shortPrompt}`;
          const pin = create3DMarker(wpLat, wpLng, 2.2, pinLabel, false);
          map.appendChild(pin);
          activeWaypointMarkersRef.current.push(pin);
        });
      } else if (activeScene && activeScene.waypoints && activeScene.waypoints.length > 0) {
        // Render compiled active scene trajectory
        const polyCoords = activeScene.frames && activeScene.frames.length > 0
          ? activeScene.frames
              .filter((f, idx) => idx % 3 === 0 && f)
              .map(f => {
                const fLat = f.pos?.lat ?? f.actors?.[0]?.lat ?? f.lat ?? sceneCenter?.lat ?? 0;
                const fLng = f.pos?.lng ?? f.actors?.[0]?.lng ?? f.lng ?? sceneCenter?.lng ?? 0;
                return {
                  lat: Number(fLat),
                  lng: Number(fLng),
                  altitude: 0.1
                };
              })
          : (activeScene.waypoints || []).map(wp => ({
              lat: Number(wp?.lat ?? sceneCenter?.lat ?? 0),
              lng: Number(wp?.lng ?? sceneCenter?.lng ?? 0),
              altitude: 0.1
            }));

        if (polyCoords.length >= 2) {
          const trajPoly = createPolyline(polyCoords, '#00f2fe', 4.5, 0.1, 'RELATIVE_TO_GROUND');
          map.appendChild(trajPoly);
          activeTrajectoryPolylineRef.current = trajPoly;
        }

        (activeScene.waypoints || []).forEach((wp, idx) => {
          if (!wp || wp.lat === undefined || wp.lng === undefined) return;
          const pinLabel = `${idx + 1}. ${wp.action || 'STEP'}: ${wp.name ? wp.name.split(' ')[0] : 'Step'}`;
          const pin = create3DMarker(wp.lat, wp.lng, 2.2, pinLabel, false);
          map.appendChild(pin);
          activeWaypointMarkersRef.current.push(pin);
        });
      }

      // Render Camera Rail if user drew camera waypoints
      if (cameraRailWaypoints && cameraRailWaypoints.length > 0) {
        const railCoords = cameraRailWaypoints
          .filter(wp => wp && wp.lat !== undefined && wp.lng !== undefined)
          .map(wp => ({
            lat: Number(wp.lat),
            lng: Number(wp.lng),
            altitude: Number(wp.altitude || 20.0)
          }));
        if (railCoords.length >= 2) {
          const railPoly = createPolyline(railCoords, '#f59e0b', 5.0, 0.0, 'RELATIVE_TO_GROUND');
          map.appendChild(railPoly);
          activeCameraRailPolylineRef.current = railPoly;
        }

        cameraRailWaypoints.forEach((wp, idx) => {
          if (!wp || wp.lat === undefined || wp.lng === undefined) return;
          const pin = create3DMarker(wp.lat, wp.lng, (wp.altitude || 20.0) + 1.5, `🎥 Shot ${idx + 1} (+${wp.altitude || 20}m)`, false);
          map.appendChild(pin);
          activeCameraRailMarkersRef.current.push(pin);
        });
      }

      // Render Screenplay Stage Anchor Marker (Cinema Gold 3D Pin)
      if (screenplayStagePos && (activeTab === 'screenplay' || isPickingScreenplayStage || activeScene?.is_screenplay)) {
        const stageLabel = isPickingScreenplayStage ? '🎯 [CLICK MAP TO ANCHOR]' : '🎬 SCREENPLAY STAGE (Origin)';
        const stagePin = create3DMarker(
          screenplayStagePos.lat,
          screenplayStagePos.lng,
          2.5,
          stageLabel,
          true
        );
        map.appendChild(stagePin);
        activeWaypointMarkersRef.current.push(stagePin);
      }
    }

    return () => {
      if (activeTrajectoryPolylineRef.current && activeTrajectoryPolylineRef.current.parentNode) {
        try {
          activeTrajectoryPolylineRef.current.parentNode.removeChild(activeTrajectoryPolylineRef.current);
        } catch (e) {}
        activeTrajectoryPolylineRef.current = null;
      }
      activeWaypointMarkersRef.current.forEach(m => {
        try {
          if (m && m.parentNode) m.parentNode.removeChild(m);
        } catch (e) {}
      });
      activeWaypointMarkersRef.current = [];

      if (activeCameraRailPolylineRef.current && activeCameraRailPolylineRef.current.parentNode) {
        try {
          activeCameraRailPolylineRef.current.parentNode.removeChild(activeCameraRailPolylineRef.current);
        } catch (e) {}
        activeCameraRailPolylineRef.current = null;
      }
      activeCameraRailMarkersRef.current.forEach(m => {
        try {
          if (m && m.parentNode) m.parentNode.removeChild(m);
        } catch (e) {}
      });
      activeCameraRailMarkersRef.current = [];
    };
  }, [activeScene, customDirectedWaypoints, objectWaypoints, cameraRailWaypoints, screenplayStagePos, isPickingScreenplayStage, activeTab, gridAltitudeOffset, sceneCenter, currentCenter, isRecordingVideo, showVisualOverlays]);

  // Synchronize Humanoid Robot 3D Model, Dynamic Articulation, Heading & Camera Director
  useEffect(() => {
    const map = mapElementRef.current;
    if (!map) return;

    // Determine current active pose
    let pose = null;
    let actionLabel = 'STANDBY';

    if (activeScene && activeScene.frames && activeScene.frames.length > 0) {
      const frameIdx = Math.max(0, Math.min(activeScene.frames.length - 1, Math.floor(currentTime * 60)));
      const frame = activeScene.frames[frameIdx];
      if (frame) {
        if (frame.actors && frame.actors.length > 0) {
          const lead = frame.actors[0];
          const isDrone = lead.category === 'drone';
          pose = {
            lat: lead.lat ?? sceneCenter?.lat ?? 0,
            lng: lead.lng ?? sceneCenter?.lng ?? 0,
            altitudeOffset: lead.altitude ?? (isDrone ? 15.0 : 0.1),
            groundAltitude: 0.0,
            heading: lead.heading || 0,
            pitch: lead.pitch || 0,
            roll: lead.roll || 0,
            action: lead.damaged ? 'IMPACT_CRASH' : (isDrone ? 'AERIAL_DRONE_FLIGHT' : (lead.action || 'CRUISING')),
            speed: lead.speed_mps || 0,
            isVehicular: true,
            isScreenplay: true
          };
          actionLabel = lead.damaged ? '💥 IMPACT' : (isDrone ? '🚁 DRONE FLIGHT' : '🏎️ SPEEDING');
          currentPoseRef.current = pose;
          currentFrameRef.current = frame;
          onUpdateCurrentFrameRef.current?.(frame);
        } else if (frame.pos) {
          const groundOffset = frame.pos.altitude_offset !== undefined ? frame.pos.altitude_offset : 0.0;
          pose = {
            lat: frame.pos.lat ?? sceneCenter?.lat ?? 0,
            lng: frame.pos.lng ?? sceneCenter?.lng ?? 0,
            altitudeOffset: groundOffset,
            groundAltitude: frame.pos.ground_altitude,
            heading: frame.heading || 0,
            pitch: frame.pitch || 0,
            roll: frame.roll || 0,
            action: frame.action || 'IDLE',
            speed: frame.speed || 0,
            terrainTelemetry: frame.terrain_telemetry
          };
          actionLabel = frame.action || 'IDLE';
          currentPoseRef.current = pose;
          currentFrameRef.current = frame;
          onUpdateCurrentFrameRef.current?.(frame);
          setLatestFrameForTwin(frame);
        } else if (frame.lat !== undefined && frame.lng !== undefined) {
          pose = {
            lat: frame.lat,
            lng: frame.lng,
            altitudeOffset: frame.altitude || 0.0,
            groundAltitude: 0.0,
            heading: frame.heading || 0,
            pitch: frame.pitch || 0,
            roll: frame.roll || 0,
            action: frame.action || 'IDLE',
            speed: frame.speed || 0
          };
          actionLabel = frame.action || 'IDLE';
          currentPoseRef.current = pose;
          currentFrameRef.current = frame;
          onUpdateCurrentFrameRef.current?.(frame);
          setLatestFrameForTwin(frame);
        }
      }
    } else if (placedModelPos || placedRobotPos) {
      const activePlaced = placedModelPos || placedRobotPos;
      const isVehicular = Boolean(activePlaced.isVehicular || activePlaced.category === 'vehicle' || activePlaced.category === 'drone');
      const modelSrc = activePlaced.model_src || (activePlaced.category === 'vehicle' ? '/models/vehicle_sedan.glb' : activePlaced.src);
      const modelScale = activePlaced.scale || (isVehicular ? 1.0 : 0.48);

      pose = {
        lat: activePlaced.lat ?? sceneCenter?.lat ?? 0,
        lng: activePlaced.lng ?? sceneCenter?.lng ?? 0,
        altitude: activePlaced.altitude,
        altitudeOffset: 0.0,
        heading: activePlaced.heading || 45,
        pitch: 0,
        roll: 0,
        action: 'SPAWN',
        speed: 0,
        model_src: modelSrc,
        scale: modelScale,
        isVehicular: isVehicular
      };
      actionLabel = 'PLACED';
      const defaultFrame = {
        pos: { lat: activePlaced.lat ?? sceneCenter?.lat ?? 0, lng: activePlaced.lng ?? sceneCenter?.lng ?? 0, altitude_offset: 0.0, altitude: activePlaced.altitude },
        heading: activePlaced.heading || 45,
        pitch: 0,
        roll: 0,
        action: 'SPAWN',
        speed: 0,
        model_src: modelSrc,
        scale: modelScale,
        actors: modelSrc ? [
          {
            id: 'placed_model_actor',
            model_src: modelSrc,
            scale: modelScale,
            lat: activePlaced.lat ?? sceneCenter?.lat ?? 0,
            lng: activePlaced.lng ?? sceneCenter?.lng ?? 0,
            altitude: 0.0,
            heading: activePlaced.heading || 45,
            pitch: 0,
            roll: 0
          }
        ] : undefined,
        joints: { neck_pitch: 5.0, spine_pitch: 4.0, r_knee: 10.0, l_knee: 10.0 }
      };
      currentPoseRef.current = pose;
      currentFrameRef.current = defaultFrame;
      setLatestFrameForTwin(defaultFrame);
    }

    if (!pose) {
      currentPoseRef.current = null;
      currentFrameRef.current = null;
      // Clean up robot when no scene or placement
      if (activeRobotModelRef.current && activeRobotModelRef.current.parentNode) {
        activeRobotModelRef.current.parentNode.removeChild(activeRobotModelRef.current);
        activeRobotModelRef.current = null;
      }
      if (activeRobotMarkerRef.current && activeRobotMarkerRef.current.parentNode) {
        activeRobotMarkerRef.current.parentNode.removeChild(activeRobotMarkerRef.current);
        activeRobotMarkerRef.current = null;
      }
      if (activePulseRingRef.current && activePulseRingRef.current.parentNode) {
        activePulseRingRef.current.parentNode.removeChild(activePulseRingRef.current);
        activePulseRingRef.current = null;
      }
      // Clean up any multi-actors
      Object.keys(activeMultiActorsMapRef.current).forEach((id) => {
        const item = activeMultiActorsMapRef.current[id];
        try {
          if (item?.element?.parentNode) item.element.parentNode.removeChild(item.element);
        } catch (e) {}
        delete activeMultiActorsMapRef.current[id];
      });
      return;
    }

    const BASE_GROUND_OFFSET = 0.1;
    const zOffset = (pose.altitudeOffset || 0.0) + BASE_GROUND_OFFSET;

    // 1. Multi-Actor Vehicular & Screenplay Rendering vs Single Humanoid Model
    if ((pose.isVehicular || pose.isScreenplay || currentFrameRef.current?.actors?.length > 0) && currentFrameRef.current?.actors) {
      // Remove humanoid model if present
      if (activeRobotModelRef.current && activeRobotModelRef.current.parentNode) {
        try { activeRobotModelRef.current.parentNode.removeChild(activeRobotModelRef.current); } catch (e) {}
        activeRobotModelRef.current = null;
      }

      const activeIds = new Set();
      (currentFrameRef.current.actors || []).forEach((act) => {
        if (!act) return;
        const actLat = act.lat ?? sceneCenter?.lat ?? 0;
        const actLng = act.lng ?? sceneCenter?.lng ?? 0;
        activeIds.add(act.id);
        const existing = activeMultiActorsMapRef.current[act.id];
        const src = act.model_src || '/models/vehicle_sedan.glb';
        const scale = act.scale || 1.0;
        const z = (act.altitude || 0.0) + BASE_GROUND_OFFSET;
        const isVehicular = act.category === 'vehicle' || act.category === 'drone' || src.includes('vehicle_') || src.includes('drone_');
        // GLB vehicles/drones are authored with hood/forward along +Y, while Google Maps 3D aligns heading 0 to +X.
        // Adding +90° ensures the vehicle faces forward along its trajectory heading instead of sliding sideways.
        const effectiveHeading = isVehicular
          ? (((act.heading || 0) + 90) % 360 + 360) % 360
          : (act.heading || 0);

        if (!existing) {
          const model = createRobotModel(actLat, actLng, z, effectiveHeading, scale, src);
          map.appendChild(model);
          activeMultiActorsMapRef.current[act.id] = { element: model, src };
        } else {
          if (existing.src !== src) {
            try {
              if (existing.element.parentNode) existing.element.parentNode.removeChild(existing.element);
            } catch (e) {}
            const model = createRobotModel(actLat, actLng, z, effectiveHeading, scale, src);
            map.appendChild(model);
            activeMultiActorsMapRef.current[act.id] = { element: model, src };
          } else {
            try {
              existing.element.position = { lat: actLat, lng: actLng, altitude: z };
              existing.element.orientation = { heading: effectiveHeading, tilt: act.pitch || 0, roll: act.roll || 0 };
            } catch (e) {}
          }
        }
      });

      // Cleanup retired actors
      Object.keys(activeMultiActorsMapRef.current).forEach((id) => {
        if (!activeIds.has(id)) {
          const item = activeMultiActorsMapRef.current[id];
          try {
            if (item?.element?.parentNode) item.element.parentNode.removeChild(item.element);
          } catch (e) {}
          delete activeMultiActorsMapRef.current[id];
        }
      });
    } else {
      // Clean up multi actors if returning to humanoid mode
      Object.keys(activeMultiActorsMapRef.current).forEach((id) => {
        const item = activeMultiActorsMapRef.current[id];
        try {
          if (item?.element?.parentNode) item.element.parentNode.removeChild(item.element);
        } catch (e) {}
        delete activeMultiActorsMapRef.current[id];
      });

      // Dynamic Action-Specific Posed GLB Asset Selector & Model3DElement (<gmp-model-3d>)
      const actKey = (pose.action || 'IDLE').toUpperCase();
      let targetGlb = '/models/humanoid_idle.glb';
      let targetScale = 0.48;

      if (pose.model_src) {
        targetGlb = pose.model_src;
        targetScale = pose.scale || 1.0;
      } else {
        if (actKey.includes('WALK')) targetGlb = '/models/humanoid_walk.glb';
        else if (actKey.includes('JOG') || actKey.includes('RUN') || actKey.includes('SPRINT')) targetGlb = '/models/humanoid_jog.glb';
        else if (actKey.includes('CROUCH') || actKey.includes('INSPECT')) targetGlb = '/models/humanoid_crouch.glb';
        else if (actKey.includes('SCAN') || actKey.includes('LOOK')) targetGlb = '/models/humanoid_scan.glb';
        else if (actKey.includes('WAVE')) targetGlb = '/models/humanoid_wave.glb';
        else if (actKey.includes('CELEBRATE') || actKey.includes('VICTORY')) targetGlb = '/models/humanoid_celebrate.glb';
        else if (actKey.includes('SPAWN') || actKey.includes('DROP') || actKey.includes('JUMP')) targetGlb = '/models/humanoid_drop.glb';
      }

      const isSingleVehicular = Boolean(pose.isVehicular || targetGlb.includes('vehicle_') || targetGlb.includes('drone_'));
      const effectiveHeading = isSingleVehicular
        ? (((pose.heading || 0) + 90) % 360 + 360) % 360
        : (pose.heading || 0);

      if (!activeRobotModelRef.current) {
        const model = createRobotModel(pose.lat, pose.lng, zOffset, effectiveHeading, targetScale, targetGlb);
        map.appendChild(model);
        activeRobotModelRef.current = model;
        activeModelGlbRef.current = targetGlb;
      } else {
        if (activeModelGlbRef.current !== targetGlb) {
          activeModelGlbRef.current = targetGlb;
          try {
            if (activeRobotModelRef.current.parentNode) {
              activeRobotModelRef.current.parentNode.removeChild(activeRobotModelRef.current);
            }
          } catch (e) {}
          const model = createRobotModel(pose.lat, pose.lng, zOffset, effectiveHeading, targetScale, targetGlb);
          map.appendChild(model);
          activeRobotModelRef.current = model;
        } else {
          try {
            activeRobotModelRef.current.position = { lat: pose.lat, lng: pose.lng, altitude: zOffset };
            activeRobotModelRef.current.orientation = { heading: effectiveHeading, tilt: pose.pitch || 0, roll: pose.roll || 0 };
            activeRobotModelRef.current.setAttribute?.('position', `${pose.lat},${pose.lng},${zOffset}`);
            activeRobotModelRef.current.setAttribute?.('orientation', `${effectiveHeading},${pose.pitch || 0},${pose.roll || 0}`);
          } catch (e) {}
        }
      }
    }

    const hideOverlays = isRecordingVideo || !showVisualOverlays;

    // 2. Create or Update Robot Marker Element (<gmp-marker-3d>)
    if (!hideOverlays && !pose.isVehicular) {
      if (!activeRobotMarkerRef.current) {
        const marker = create3DMarker(pose.lat, pose.lng, zOffset + 3.2, `🤖 ATLAS-G1 [${actionLabel}]`, false);
        map.appendChild(marker);
        activeRobotMarkerRef.current = marker;
      } else {
        try {
          activeRobotMarkerRef.current.position = { lat: pose.lat, lng: pose.lng, altitude: zOffset + 3.2 };
          activeRobotMarkerRef.current.setAttribute?.('position', `${pose.lat},${pose.lng},${zOffset + 3.2}`);
          activeRobotMarkerRef.current.setAttribute?.('label', `🤖 ATLAS-G1 [${actionLabel}]`);
        } catch (e) {}
      }
    } else {
      if (activeRobotMarkerRef.current && activeRobotMarkerRef.current.parentNode) {
        try { activeRobotMarkerRef.current.parentNode.removeChild(activeRobotMarkerRef.current); } catch (e) {}
        activeRobotMarkerRef.current = null;
      }
    }

    // 3. Ground Selection Pulse Ring beneath robot feet (on pavement surface in RELATIVE_TO_GROUND)
    if (!hideOverlays && !pose.isVehicular) {
      const ringCoords = generateCircumference(pose.lat, pose.lng, 1.8, 24, zOffset + 0.08);
      if (!activePulseRingRef.current) {
        const ring = createPolyline(ringCoords, '#38bdf8', 3.0, zOffset + 0.08, 'RELATIVE_TO_GROUND');
        map.appendChild(ring);
        activePulseRingRef.current = ring;
      } else {
        try {
          activePulseRingRef.current.path = ringCoords;
          activePulseRingRef.current.coordinates = ringCoords;
          const pathStr = ringCoords.map(c => `${c.lat},${c.lng},${c.altitude}`).join(' ');
          activePulseRingRef.current.setAttribute?.('path', pathStr);
        } catch (e) {}
      }
    } else {
      if (activePulseRingRef.current && activePulseRingRef.current.parentNode) {
        try { activePulseRingRef.current.parentNode.removeChild(activePulseRingRef.current); } catch (e) {}
        activePulseRingRef.current = null;
      }
    }

    // 4. Update Autonomous Camera Director Info, Cutting & Smooth Tracking
    const effectiveCameraMode = cameraMode || 'free';

    if (effectiveCameraMode === 'user_camera_rail' && cameraRailFrames && cameraRailFrames.length > 0) {
      const camIdx = Math.max(0, Math.min(cameraRailFrames.length - 1, Math.floor(currentTime * 60)));
      const camFrame = cameraRailFrames[camIdx];
      if (camFrame) {
        try {
          map.center = camFrame.center;
          map.heading = camFrame.heading;
          map.tilt = camFrame.tilt;
          map.range = camFrame.range;
        } catch (e) {}
      }
    } else if (effectiveCameraMode !== 'free' && (pose || activeScene)) {
      const shot = computeCameraShotTransform(effectiveCameraMode, pose, currentTime, activeScene?.camera_shots);
      const currentCutKey = `${shot.cutNumber}_${shot.activeAngle}`;
      const isCut = lastCutAngleRef.current !== currentCutKey;

      const groundBase = Number(sceneCenter?.altitude || currentCenter?.altitude || 20.0);
      const safeCenter = {
        lat: Number(shot.center?.lat ?? currentCenter.lat),
        lng: Number(shot.center?.lng ?? currentCenter.lng),
        altitude: Number((shot.center?.altitude || 0.0) + groundBase)
      };
      const safeTilt = Math.max(45.0, Math.min(75.0, shot.tilt || 64.0));
      const safeRange = Math.max(10.0, Math.min(120.0, shot.range || 28.0));
      const safeHeading = ((shot.heading % 360) + 360) % 360;

      if (isCut) {
        lastCutAngleRef.current = currentCutKey;
        flightEndTimeRef.current = Date.now() + 380;
        setActiveCutInfo({
          label: shot.shotLabel,
          angle: shot.activeAngle,
          cutNumber: shot.cutNumber
        });

        // Crisp, cinematic camera cut flight
        if (typeof map.flyCameraTo === 'function') {
          map.flyCameraTo({
            endCamera: {
              center: safeCenter,
              heading: safeHeading,
              tilt: safeTilt,
              range: safeRange
            },
            durationMillis: 350
          });
        }
      } else if (isPlaying && Date.now() >= flightEndTimeRef.current) {
        // Continuous smooth tracking between cuts without interrupting flight or resetting tilt
        try {
          map.center = safeCenter;
          map.heading = safeHeading;
          map.tilt = safeTilt;
          map.range = safeRange;
        } catch (e) {}
      }
    }
  }, [activeScene, currentTime, isPlaying, cameraMode, placedRobotPos, placedModelPos, gridAltitudeOffset, sceneCenter, currentCenter, isRecordingVideo]);

  // 5. Blender Gizmo Orbit Handler (Heading & Tilt)
  const handleOrbit = useCallback((newHeading, newTilt) => {
    const map = mapElementRef.current;
    if (!map) return;
    if (cameraMode !== 'free') {
      onChangeCameraMode?.('free');
    }
    const state = cameraStateRef.current;
    state.heading = newHeading;
    state.tilt = newTilt;
    try {
      map.heading = newHeading;
      map.tilt = newTilt;
    } catch (err) {}
    setHudCamera(prev => ({
      ...prev,
      heading: Math.round(newHeading * 10) / 10,
      tilt: Math.round(newTilt * 10) / 10
    }));
  }, [cameraMode, onChangeCameraMode]);

  // 6. Blender Gizmo Snap View Handler (Top, Front, Right, Back, Left)
  const handleSnapView = useCallback((view) => {
    const map = mapElementRef.current;
    if (!map) return;
    if (cameraMode !== 'free') {
      onChangeCameraMode?.('free');
    }
    const state = cameraStateRef.current;

    let targetHeading = state.heading;
    let targetTilt = state.tilt;

    switch (view) {
      case 'top':
        targetTilt = 0.1;
        break;
      case 'bottom':
        targetTilt = 85;
        break;
      case 'north': // Front (looking North)
        targetHeading = 0;
        targetTilt = 65;
        break;
      case 'south': // Back (looking South)
        targetHeading = 180;
        targetTilt = 65;
        break;
      case 'east': // Right (looking East)
        targetHeading = 90;
        targetTilt = 65;
        break;
      case 'west': // Left (looking West)
        targetHeading = 270;
        targetTilt = 65;
        break;
      default:
        break;
    }

    state.heading = targetHeading;
    state.tilt = targetTilt;

    if (typeof map.flyCameraTo === 'function') {
      map.flyCameraTo({
        endCamera: {
          center: { lat: state.lat, lng: state.lng, altitude: state.altitude },
          tilt: targetTilt,
          heading: targetHeading,
          range: state.range
        },
        durationMillis: 600
      });
    } else {
      map.tilt = targetTilt;
      map.heading = targetHeading;
    }

    setHudCamera(prev => ({
      ...prev,
      heading: Math.round(targetHeading),
      tilt: Math.round(targetTilt)
    }));
  }, [cameraMode, onChangeCameraMode]);

  // 7. Blender Zoom Tool Handler
  const handleZoom = useCallback((deltaRange) => {
    const map = mapElementRef.current;
    if (!map) return;
    const state = cameraStateRef.current;
    state.range = Math.max(20, Math.min(15000, state.range + deltaRange));
    try {
      map.range = state.range;
    } catch (err) {}
    setHudCamera(prev => ({ ...prev, range: Math.round(state.range) }));
  }, []);

  // 8. Blender Pan Tool Handler (X / Y Planar Movement)
  const handlePan = useCallback((deltaX, deltaY) => {
    const map = mapElementRef.current;
    if (!map) return;
    const state = cameraStateRef.current;
    const headingRad = (state.heading * Math.PI) / 180;

    const fwdNorth = Math.cos(headingRad);
    const fwdEast = Math.sin(headingRad);
    const rightNorth = Math.sin(headingRad);
    const rightEast = -Math.cos(headingRad);

    const panScale = Math.max(0.1, (state.range / 500)) * 0.8;
    const northMeters = (-deltaY * panScale * fwdNorth) + (-deltaX * panScale * rightNorth);
    const eastMeters = (-deltaY * panScale * fwdEast) + (-deltaX * panScale * rightEast);

    const dLat = northMeters / 111320;
    const cosLat = Math.cos((state.lat * Math.PI) / 180);
    const dLng = eastMeters / (111320 * Math.max(0.01, cosLat));

    state.lat += dLat;
    state.lng += dLng;

    try {
      map.center = { lat: state.lat, lng: state.lng, altitude: state.altitude };
    } catch (err) {}
    setHudCamera(prev => ({ ...prev, lat: state.lat, lng: state.lng }));
  }, []);

  // 9. Perspective / Top-Down View Toggle
  const handleTogglePerspective = useCallback(() => {
    const map = mapElementRef.current;
    if (!map) return;
    const state = cameraStateRef.current;
    const newTilt = state.tilt <= 15 ? 65 : 0.1;
    state.tilt = newTilt;

    if (typeof map.flyCameraTo === 'function') {
      map.flyCameraTo({
        endCamera: {
          center: { lat: state.lat, lng: state.lng, altitude: state.altitude },
          tilt: newTilt,
          heading: state.heading,
          range: state.range
        },
        durationMillis: 500
      });
    } else {
      map.tilt = newTilt;
    }
    setHudCamera(prev => ({ ...prev, tilt: Math.round(newTilt) }));
  }, []);

  // 10. Frame Selected / Recenter View
  const handleRecenter = useCallback(() => {
    const map = mapElementRef.current;
    if (!map) return;
    const target = confirmedZoneCenterRef.current || currentCenter;
    const state = cameraStateRef.current;
    state.lat = target.lat;
    state.lng = target.lng;
    state.altitude = target.altitude || 200;
    state.tilt = 60;
    state.heading = 45;
    state.range = 480;

    if (typeof map.flyCameraTo === 'function') {
      map.flyCameraTo({
        endCamera: {
          center: { lat: target.lat, lng: target.lng, altitude: target.altitude || 200 },
          tilt: 60,
          heading: 45,
          range: 480
        },
        durationMillis: 900
      });
    } else {
      map.center = { lat: target.lat, lng: target.lng, altitude: target.altitude || 200 };
      map.tilt = 60;
      map.heading = 45;
      map.range = 480;
    }
    setHudCamera({ ...state });
  }, [currentCenter]);

  // 11. Blender Keyboard Hotkeys & Full X, Y, Z Movement Navigation
  useEffect(() => {
    if (!isLocationConfirmed) return;
    const handleKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (e.key === '7') {
        handleSnapView('top'); // Top view (Z axis)
      } else if (e.key === '1') {
        handleSnapView('north'); // Front view (Y axis)
      } else if (e.key === '3') {
        handleSnapView('east'); // Right view (X axis)
      } else if (e.key === '.') {
        handleRecenter();
      } else if (e.key === '5') {
        handleTogglePerspective();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        // Y-axis movement: Forward / North
        e.preventDefault();
        handlePan(0, -18);
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        // Y-axis movement: Backward / South
        e.preventDefault();
        handlePan(0, 18);
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        // X-axis movement: Left / West
        e.preventDefault();
        handlePan(-18, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        // X-axis movement: Right / East
        e.preventDefault();
        handlePan(18, 0);
      } else if (e.key === 'PageUp' || e.key === 'e' || e.key === 'E' || e.key === '+' || e.key === '=') {
        // Z-axis movement: Up / Closer Zoom
        e.preventDefault();
        handleZoom(-25);
      } else if (e.key === 'PageDown' || e.key === 'q' || e.key === 'Q' || e.key === '-' || e.key === '_') {
        // Z-axis movement: Down / Farther Zoom
        e.preventDefault();
        handleZoom(25);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocationConfirmed, handleSnapView, handleRecenter, handleTogglePerspective, handlePan, handleZoom]);

  // 12. Camera Angle Presets Handler
  const applyCameraAngle = (tilt, range, heading = null) => {
    const map = mapElementRef.current;
    if (!map) return;
    const center = currentCenter;

    if (typeof map.flyCameraTo === 'function') {
      map.flyCameraTo({
        endCamera: {
          center: { lat: center.lat, lng: center.lng, altitude: center.altitude || 200 },
          tilt: tilt,
          heading: heading !== null ? heading : (map.heading || 45),
          range: range
        },
        durationMillis: 900
      });
    } else {
      map.setAttribute('tilt', String(tilt));
      map.setAttribute('range', String(range));
      if (heading !== null) map.setAttribute('heading', String(heading));
    }
  };

  // 13. Cinematic Orbit Handler
  const toggleCinematicOrbit = () => {
    const map = mapElementRef.current;
    if (!map) return;

    if (isOrbiting) {
      if (typeof map.stopCameraAnimation === 'function') map.stopCameraAnimation();
      setIsOrbiting(false);
    } else {
      setIsOrbiting(true);
      if (typeof map.flyCameraAround === 'function') {
        map.flyCameraAround({
          camera: {
            center: { lat: currentCenter.lat, lng: currentCenter.lng, altitude: currentCenter.altitude || 200 },
            tilt: 60.0,
            range: 480
          },
          durationMillis: 32000,
          rounds: 1
        });
      }
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#000000',
        userSelect: 'none',
        zIndex: 1
      }}
    >
      {/* 1. Edge-to-edge Google Maps 3D Photorealistic Map Element with Dynamic AI Contrast Grading */}
      <div
        ref={mapContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          filter: aiLensMode === 'cinema_35mm'
            ? 'contrast(1.15) saturate(1.24) brightness(1.02)'
            : aiLensMode === 'golden_hour'
            ? 'contrast(1.12) saturate(1.32) brightness(1.04) sepia(0.06)'
            : aiLensMode === 'hdr_clarity'
            ? 'contrast(1.22) saturate(1.25) brightness(1.03)'
            : 'none',
          transition: 'filter 0.3s ease'
        }}
      />

      {/* 2. AI Neural Optical Depth-of-Field (Shallow Anamorphic Bokeh masks blurry background photogrammetry) */}
      {aiLensMode !== 'off' && (
        <>
          <div
            className="ai-cinematic-bokeh-lens"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              backdropFilter: aiLensMode === 'cinema_35mm' ? 'blur(3.5px)' : 'blur(2px)',
              WebkitBackdropFilter: aiLensMode === 'cinema_35mm' ? 'blur(3.5px)' : 'blur(2px)',
              maskImage: 'radial-gradient(ellipse 48% 44% at 50% 55%, transparent 35%, rgba(0,0,0,0.6) 65%, black 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 48% 44% at 50% 55%, transparent 35%, rgba(0,0,0,0.6) 65%, black 100%)',
              transition: 'all 0.3s ease'
            }}
          />

          {/* Atmospheric Lighting Bloom */}
          {aiLensMode === 'golden_hour' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 11,
                background: 'radial-gradient(circle at 82% 16%, rgba(254, 215, 170, 0.28) 0%, rgba(249, 115, 22, 0.12) 32%, transparent 68%)',
                mixBlendMode: 'screen'
              }}
            />
          )}
          {aiLensMode === 'cinema_35mm' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 11,
                background: 'radial-gradient(circle at 75% 18%, rgba(224, 242, 254, 0.22) 0%, rgba(56, 189, 248, 0.08) 28%, transparent 65%)',
                mixBlendMode: 'screen'
              }}
            />
          )}

          {/* Cinematic Vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 12,
              boxShadow: 'inset 0 0 120px rgba(3, 7, 18, 0.65)'
            }}
          />
        </>
      )}

      {/* 3. MODE B: CONFIRMED ISOLATED 0.25-MILE BLENDER 3D STUDIO */}
      {isLocationConfirmed && (
        <>
          {/* Top-Center: Cinematic Cut & Camera Mode OSD */}
          {activeScene && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 40,
                background: 'rgba(9, 14, 26, 0.94)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: cameraMode === 'free'
                  ? '1px solid rgba(56, 189, 248, 0.5)'
                  : '1px solid rgba(245, 158, 11, 0.5)',
                boxShadow: cameraMode === 'free'
                  ? '0 0 25px rgba(56, 189, 248, 0.3)'
                  : '0 0 25px rgba(245, 158, 11, 0.3)',
                borderRadius: '24px',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                pointerEvents: 'auto'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isPlaying ? '#ef4444' : '#10b981',
                    boxShadow: isPlaying ? '0 0 10px #ef4444' : '0 0 10px #10b981'
                  }}
                />
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    color: '#f8fafc',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase'
                  }}
                >
                  {cameraMode === 'free'
                    ? '🌐 FREE ORBIT CAMERA'
                    : cameraMode === 'auto_director'
                    ? `🎬 CUT #${activeCutInfo.cutNumber || 1}: ${activeCutInfo.label || 'AUTO-DIRECTOR'}`
                    : `🎥 ANGLE: ${activeCutInfo.label || cameraMode.toUpperCase()}`}
                </span>
              </div>

              {/* Interactive Camera Mode Switcher */}
              {onChangeCameraMode && (
                <button
                  id="btn-toggle-camera-mode"
                  onClick={() => onChangeCameraMode(cameraMode === 'free' ? 'auto_director' : 'free')}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: cameraMode === 'free' ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.25)',
                    color: cameraMode === 'free' ? '#fde68a' : '#e0f2fe',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.15s ease'
                  }}
                  title={cameraMode === 'free' ? 'Switch to Autonomous Director Camera Cuts' : 'Switch to Free Camera Orbit to inspect robot freely'}
                >
                  {cameraMode === 'free' ? '🎬 Switch to Director Cam' : '🌐 Switch to Free Orbit'}
                </button>
              )}

              {/* Interactive AI Cinema Lens Switcher */}
              <button
                id="btn-toggle-ai-lens"
                onClick={() => {
                  const modes = ['cinema_35mm', 'golden_hour', 'hdr_clarity', 'off'];
                  const nextIdx = (modes.indexOf(aiLensMode) + 1) % modes.length;
                  setAiLensMode(modes[nextIdx]);
                }}
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: aiLensMode !== 'off' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(255, 255, 255, 0.2)',
                  background: aiLensMode !== 'off' ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                  color: aiLensMode !== 'off' ? '#a7f3d0' : '#94a3b8',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease'
                }}
                title="Cycle AI Environment Polish: 35mm Bokeh / Golden Hour / Ultra-Sharp HDR / Raw"
              >
                <span>✨</span>
                <span>
                  {aiLensMode === 'cinema_35mm'
                    ? 'AI Lens: 35mm Cinema'
                    : aiLensMode === 'golden_hour'
                    ? 'AI Lens: Golden Hour'
                    : aiLensMode === 'hdr_clarity'
                    ? 'AI Lens: Ultra-Sharp HDR'
                    : 'AI Lens: Raw'}
                </span>
              </button>

              {/* Clean Cinematic View / Overlay Toggle */}
              <button
                id="btn-toggle-overlays"
                onClick={() => setShowVisualOverlays(prev => !prev)}
                style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  border: showVisualOverlays ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #10b981',
                  background: showVisualOverlays ? 'rgba(255, 255, 255, 0.08)' : 'rgba(16, 185, 129, 0.25)',
                  color: showVisualOverlays ? '#94a3b8' : '#a7f3d0',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease'
                }}
                title={showVisualOverlays ? 'Hide blue path lines, markers, and circles for clean cinema view' : 'Show path lines and waypoint markers'}
              >
                <span>{showVisualOverlays ? '👁️ Overlays: ON' : '✨ Clean Cinema Mode'}</span>
              </button>

              <span style={{ height: '14px', width: '1px', background: 'rgba(255, 255, 255, 0.2)' }} />
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'monospace',
                  color: '#38bdf8',
                  fontWeight: 700
                }}
              >
                {currentTime.toFixed(2)}s / {(activeScene.total_duration_sec || activeScene.duration || 12).toFixed(1)}s
              </span>
            </div>
          )}

          {/* Top-Right: Blender 3D Viewport Orientation Gizmo (X, Y, Z Movement & Axes Snap) */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '24px',
              zIndex: 35
            }}
          >
            <BlenderGizmo
              heading={hudCamera.heading}
              tilt={hudCamera.tilt}
              onOrbit={handleOrbit}
              onSnapView={handleSnapView}
            />
          </div>

        </>
      )}
    </div>
  );
}
