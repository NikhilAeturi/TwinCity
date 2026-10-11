import React, { useState, useEffect, useRef, useCallback } from 'react';
import CityViewport, { DEFAULT_CITIES } from './CityViewport';
import LeftNavbar from './LeftNavbar';
import PencilPathDirector from './PencilPathDirector';
import ActionJsonProtocolModal from './ActionJsonProtocolModal';
import ModelsDirectorPanel from './ModelsDirectorPanel';
import DirectorStudioPanel from './DirectorStudioPanel';


/**
 * StuntStudio - Photorealistic 3D Google Earth Satellite Stunt & AI Scene Studio.
 * Integrates:
 * - 0.25-mile radius 3D city environment
 * - Autonomous AI Humanoid Scene Director
 * - Articulated humanoid locomotion and action choreography
 * - Cinematic drone/chase camera director
 * - 60 FPS in-browser video & trajectory dataset recording
 */
export default function StuntStudio() {
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState('studio'); // Default to unified Director Studio panel
  const [activeCityId, setActiveCityId] = useState('san_francisco');

  const [sceneCenter, setSceneCenter] = useState({
    lat: DEFAULT_CITIES[0].lat,
    lng: DEFAULT_CITIES[0].lng,
    altitude: DEFAULT_CITIES[0].altitude,
    name: DEFAULT_CITIES[0].name
  });

  const [cameraAngle, setCameraAngle] = useState({
    tilt: DEFAULT_CITIES[0].tilt,
    heading: DEFAULT_CITIES[0].heading,
    range: DEFAULT_CITIES[0].range
  });

  // AI Scene Director States
  const [activeScene, setActiveScene] = useState(null);
  const [isGeneratingScene, setIsGeneratingScene] = useState(false);
  const [isPlayingScene, setIsPlayingScene] = useState(false);
  const [sceneCurrentTime, setSceneCurrentTime] = useState(0.0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [cameraMode, setCameraMode] = useState('free'); // 'free' by default so user can inspect scene freely
  const [isPositioningRobot, setIsPositioningRobot] = useState(false);
  const [placedRobotPos, setPlacedRobotPos] = useState(null);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [activeActionName, setActiveActionName] = useState('STANDBY');
  const [robotTelemetry, setRobotTelemetry] = useState(null);

  const [isDirectRouteMode, setIsDirectRouteMode] = useState(false);
  const [customDirectedWaypoints, setCustomDirectedWaypoints] = useState([]);
  const [isJsonProtocolOpen, setIsJsonProtocolOpen] = useState(false);
  const [readyVideoDownload, setReadyVideoDownload] = useState(null);

  // Camera Rail Directing States
  const [isDrawCameraRailMode, setIsDrawCameraRailMode] = useState(false);
  const [cameraRailWaypoints, setCameraRailWaypoints] = useState([]);
  const [cameraTrackingMode, setCameraTrackingMode] = useState('track_impact');
  const [cameraRailAltitudeOffset, setCameraRailAltitudeOffset] = useState(18.0);
  const [cameraRailFrames, setCameraRailFrames] = useState([]);

  // 3D Models & Physical Motion Director States
  const [modelCatalog, setModelCatalog] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState('vehicle_sedan');
  const [isPlacingModel, setIsPlacingModel] = useState(false);
  const [placedModelPos, setPlacedModelPos] = useState(null);
  const [isDrawObjectPathMode, setIsDrawObjectPathMode] = useState(false);
  const [objectWaypoints, setObjectWaypoints] = useState([]);

  // Screenplay AI Scene Director States
  const [screenplayStagePos, setScreenplayStagePos] = useState(null);
  const [isPickingScreenplayStage, setIsPickingScreenplayStage] = useState(false);
  const [isGeneratingScreenplay, setIsGeneratingScreenplay] = useState(false);

  const getCanvasFuncRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const activeRecordingStreamRef = useRef(null);

  const lastCompiledSignatureRef = useRef('');

  // Fetch certified 3D open-source model asset catalog on mount
  useEffect(() => {
    fetch('http://localhost:8000/api/assets/catalog')
      .then(res => res.json())
      .then(data => {
        if (data && data.assets && data.assets.length > 0) {
          setModelCatalog(data.assets);
        }
      })
      .catch(err => console.warn('Asset catalog fetch note:', err));
  }, []);

  // Confirm and isolate 0.25-mile location
  const handleConfirmLocation = () => {
    setIsLocationConfirmed(true);
    setIsSelectingLocation(false);
    setActiveTab('studio');
  };

  // Toggle location selection mode
  const handleToggleSelectLocation = () => {
    if (isLocationConfirmed) {
      setIsLocationConfirmed(false);
      setIsSelectingLocation(true);
      setActiveTab('location');
    } else {
      setIsSelectingLocation(prev => !prev);
    }
  };

  // Select a preset city
  const handleSelectCity = (cityId) => {
    const city = DEFAULT_CITIES.find(c => c.id === cityId);
    if (!city) return;
    setActiveCityId(cityId);
    setSceneCenter({
      lat: city.lat,
      lng: city.lng,
      altitude: city.altitude
    });
    setCameraAngle({
      tilt: city.tilt,
      heading: city.heading,
      range: city.range
    });
    // Clear previous scene when city changes
    setActiveScene(null);
    setPlacedRobotPos(null);
    setScreenplayStagePos(null);
    setCustomDirectedWaypoints([]);
    setIsPlayingScene(false);
    setSceneCurrentTime(0.0);
  };

  // Recenter camera on the photorealistic 3D city center
  const handleRecenter = () => {
    const curCity = DEFAULT_CITIES.find(c => c.id === activeCityId) || DEFAULT_CITIES[0];
    setCameraAngle({
      tilt: curCity.tilt,
      heading: curCity.heading,
      range: curCity.range
    });
    setSceneCenter({
      lat: curCity.lat,
      lng: curCity.lng,
      altitude: curCity.altitude
    });
  };

  // Playback stepping animation loop (supports both active scene and standalone camera rails)
  useEffect(() => {
    if (!isPlayingScene) return;
    const duration = activeScene?.total_duration_sec || activeScene?.duration || (cameraRailFrames?.length ? cameraRailFrames.length / 60 : 6.0);
    let lastTime = performance.now();
    let animId;

    const step = (now) => {
      const dt = (now - lastTime) / 1000.0;
      lastTime = now;

      setSceneCurrentTime(prev => {
        const next = prev + dt * playbackSpeed;
        if (next >= duration) {
          return duration;
        }
        return next;
      });

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPlayingScene, activeScene, playbackSpeed, cameraRailFrames]);

  // Handle scene / camera rail playback finish and stop recording outside of reducer
  useEffect(() => {
    if (!isPlayingScene) return;
    const duration = activeScene?.total_duration_sec || activeScene?.duration || (cameraRailFrames?.length ? cameraRailFrames.length / 60 : 6.0);
    if (sceneCurrentTime >= duration) {
      setIsPlayingScene(false);
      if (isRecordingVideo) {
        // Hold final frame for 700ms tail buffer so all trailing motion settles and hardware encoder flushes
        const tailTimer = setTimeout(() => {
          handleStopRecording();
        }, 700);
        return () => clearTimeout(tailTimer);
      }
    }
  }, [sceneCurrentTime, activeScene, isPlayingScene, isRecordingVideo, cameraRailFrames]);

  // AI Scene Generation handler
  const handleGenerateScene = async (prompt) => {
    setIsGeneratingScene(true);
    // Purge previous scene cues so they do not linger or interfere
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    try {
      const resp = await fetch('http://localhost:8000/api/scene/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt,
          city_id: activeCityId,
          center_lat: sceneCenter.lat,
          center_lng: sceneCenter.lng,
          custom_spawn: placedRobotPos
        })
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setActiveScene(data);
      setSceneCurrentTime(0.0);
      setIsPlayingScene(true);
      if (cameraRailWaypoints.length >= 2) {
        handleCompileCameraRail(data);
      } else {
        setCameraMode('free');
      }
      // If location was not confirmed, automatically confirm to show Blender grid
      if (!isLocationConfirmed) {
        setIsLocationConfirmed(true);
      }
    } catch (err) {
      console.error('Failed to generate AI scene:', err);
      alert(`Could not generate AI scene: ${err.message}. Ensure backend server is running on port 8000.`);
    } finally {
      setIsGeneratingScene(false);
    }
  };

  // Direct Path Compilation: Compiles drawn waypoints with custom prompts into 60 FPS scene
  const handleDirectCustomPath = async (waypoints) => {
    if (!waypoints || waypoints.length === 0) return;
    setIsGeneratingScene(true);
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    try {
      const resp = await fetch('http://localhost:8000/api/scene/direct_path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: activeCityId,
          center_lat: sceneCenter.lat,
          center_lng: sceneCenter.lng,
          waypoints: waypoints
        })
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setActiveScene(data);
      setSceneCurrentTime(0.0);
      setIsPlayingScene(true);
      setCameraMode('free');
      setIsDirectRouteMode(false);
      if (!isLocationConfirmed) {
        setIsLocationConfirmed(true);
      }
      return data;
    } catch (err) {
      console.error('Failed to direct custom route scene:', err);
      alert(`Could not compile custom route: ${err.message}. Ensure backend is running.`);
      return null;
    } finally {
      setIsGeneratingScene(false);
    }
  };

  // Unified Compile & Direct for Test and Record
  const handleCompileAndDirect = async ({ mode = 'test' } = {}) => {
    if (!customDirectedWaypoints || customDirectedWaypoints.length === 0) {
      alert('Please use the Pencil tool to draw points on the 3D satellite map first!');
      return;
    }

    const currentWpSignature = JSON.stringify(customDirectedWaypoints.map(w => ({
      lat: Number(w.lat).toFixed(6),
      lng: Number(w.lng).toFixed(6),
      prompt: (w.prompt || '').trim(),
      action: (w.action || '').trim()
    })));

    const isCompiled = Boolean(
      activeScene &&
      activeScene.waypoints &&
      lastCompiledSignatureRef.current === currentWpSignature
    );

    let sceneData = activeScene;
    if (!isCompiled) {
      sceneData = await handleDirectCustomPath(customDirectedWaypoints);
      if (!sceneData) return;
      lastCompiledSignatureRef.current = currentWpSignature;
    }

    setSceneCurrentTime(0.0);
    // When testing movement, keep camera in FREE mode so user can monitor robot from any perspective!
    // When recording, use 'auto_director' so cinematic camera cuts & framing are captured.
    setCameraMode(mode === 'record' ? 'auto_director' : 'free');
    if (mode === 'test') {
      setIsPlayingScene(true);
    } else if (mode === 'record') {
      await handleStartRecording();
    }
  };

  const handleAddDirectWaypoint = (point) => {
    // If starting a fresh drawing, clear out any old scene so previous direction movements never linger
    setCustomDirectedWaypoints(prev => {
      const isFirst = prev.length === 0;
      if (isFirst) {
        setActiveScene(null);
        setSceneCurrentTime(0.0);
        setIsPlayingScene(false);
      }

      const idx = prev.length;
      let defaultAction = 'WALK';
      let defaultPrompt = 'Walk forward along sidewalk corridor';

      if (idx === 0) {
        defaultAction = 'SPAWN';
        defaultPrompt = 'Spawn and initialize system posture';
      } else if (idx === 1) {
        defaultAction = 'WALK';
        defaultPrompt = 'Stride forward down the pedestrian path';
      } else if (idx === 2) {
        defaultAction = 'INSPECT';
        defaultPrompt = 'Crouch and inspect building entrance threshold';
      } else if (idx === 3) {
        defaultAction = 'SCAN';
        defaultPrompt = 'Perimeter 360 tactical sensor scan';
      } else if (idx === 4) {
        defaultAction = 'JOG';
        defaultPrompt = 'Athletic sprint down the avenue';
      } else {
        defaultAction = 'WAVE';
        defaultPrompt = 'Wave greeting gesture to camera';
      }

      return [
        ...prev,
        {
          lat: point.lat,
          lng: point.lng,
          altitude: point.altitude || 0,
          action: defaultAction,
          prompt: defaultPrompt
        }
      ];
    });
  };

  const handleUpdateDirectWaypoint = (index, updates) => {
    setCustomDirectedWaypoints(prev =>
      prev.map((wp, idx) => (idx === index ? { ...wp, ...updates } : wp))
    );
  };

  const handleRemoveDirectWaypoint = (index) => {
    setCustomDirectedWaypoints(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearDirectedWaypoints = () => {
    setCustomDirectedWaypoints([]);
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
    setPlacedRobotPos(null);
    setActiveActionName('STANDBY');
    setRobotTelemetry(null);
  };

  const handleAddCameraRailWaypoint = (point) => {
    setCameraRailWaypoints(prev => [
      ...prev,
      {
        lat: point.lat,
        lng: point.lng,
        altitude: point.altitude || 18.0,
        label: `Shot Point ${prev.length + 1}`
      }
    ]);
  };

  const handleRemoveCameraRailWaypoint = (index) => {
    setCameraRailWaypoints(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearCameraRailWaypoints = () => {
    setCameraRailWaypoints([]);
    setCameraRailFrames([]);
  };

  const handleCompileCameraRail = async (overrideScene = null) => {
    if (cameraRailWaypoints.length < 2) return;
    const targetScene = overrideScene || activeScene;
    try {
      const resp = await fetch('http://localhost:8000/api/scene/camera_rail/interpolate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waypoints: cameraRailWaypoints,
          center_lat: sceneCenter?.lat || 37.7952,
          center_lng: sceneCenter?.lng || -122.4028,
          duration_sec: targetScene?.total_duration_sec || 6.0,
          fps: 60,
          tracking_mode: cameraTrackingMode,
          target_point: targetScene?.stage_pos || targetScene?.impact_coords || screenplayStagePos || { lat: sceneCenter?.lat || 37.7952, lng: sceneCenter?.lng || -122.4028, altitude: 20 },
          scene_frames: targetScene?.frames || []
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        setCameraRailFrames(data.camera_frames || []);
        setCameraMode('user_camera_rail');
        setSceneCurrentTime(0.0);
        setIsPlayingScene(true);
      }
    } catch (err) {
      console.error('Camera rail compile error:', err);
    }
  };

  const handleTogglePlay = () => {
    const totalDuration = activeScene?.total_duration_sec || (cameraRailFrames?.length ? cameraRailFrames.length / 60 : 6.0);
    if (sceneCurrentTime >= totalDuration) {
      setSceneCurrentTime(0.0);
    }
    setIsPlayingScene(prev => !prev);
  };

  const handleResetPlayback = () => {
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
  };

  const handleClearScene = () => {
    setActiveScene(null);
    setCustomDirectedWaypoints([]);
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
    setPlacedRobotPos(null);
    setActiveActionName('STANDBY');
    setRobotTelemetry(null);
  };

  const handleSeekTime = (time) => {
    setSceneCurrentTime(time);
  };

  const handleTogglePositionRobot = () => {
    setIsPositioningRobot(prev => !prev);
  };

  const handleDropRobotPosition = (pos) => {
    if (!pos) return;
    setPlacedRobotPos(pos);
    setIsPositioningRobot(false);
    setRobotTelemetry({
      lat: pos.lat || 0,
      lng: pos.lng || 0,
      altitude: pos.altitude || 0,
      heading: 45
    });
  };

  // Model Selection & Environment Placement Handlers
  const handleSelectModel = (modelId) => {
    setSelectedModelId(modelId);
    const chosen = modelCatalog.find(m => m.id === modelId);
    if (chosen && placedModelPos) {
      setPlacedModelPos(prev => ({
        ...prev,
        assetId: modelId,
        model_src: chosen.src,
        scale: chosen.scale || (chosen.category === 'vehicle' ? 1.0 : 0.48),
        category: chosen.category,
        isVehicular: chosen.category === 'vehicle' || chosen.category === 'drone'
      }));
    }
  };

  const handleTogglePlaceModel = () => {
    setIsPlacingModel(prev => {
      const next = !prev;
      if (next) {
        setIsDrawObjectPathMode(false);
        setIsDirectRouteMode(false);
        setIsPositioningRobot(false);
        setIsSelectingLocation(false);
      }
      return next;
    });
  };

  const handleDropPlacedModel = (pos) => {
    if (!pos) return;
    const chosen = modelCatalog.find(m => m.id === selectedModelId) || {
      id: selectedModelId,
      src: '/models/vehicle_sedan.glb',
      scale: 1.0,
      category: 'vehicle'
    };
    const newPlaced = {
      lat: pos.lat,
      lng: pos.lng,
      altitude: pos.altitude || 0,
      heading: pos.heading || 45,
      assetId: chosen.id,
      model_src: chosen.src,
      scale: chosen.scale || (chosen.category === 'vehicle' ? 1.0 : 0.48),
      category: chosen.category,
      isVehicular: chosen.category === 'vehicle' || chosen.category === 'drone'
    };
    setPlacedModelPos(newPlaced);
    setIsPlacingModel(false);
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
  };

  const handleUpdatePlacedModelHeading = (heading) => {
    setPlacedModelPos(prev => (prev ? { ...prev, heading } : null));
  };

  const handleClearPlacedModel = () => {
    setPlacedModelPos(null);
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
  };

  // Object Motion Path Directing Handlers
  const handleToggleDrawObjectPathMode = () => {
    setIsDrawObjectPathMode(prev => {
      const next = !prev;
      if (next) {
        setIsPlacingModel(false);
        setIsDirectRouteMode(false);
        setIsPositioningRobot(false);
        setIsSelectingLocation(false);
      }
      return next;
    });
  };

  const handleAddObjectWaypoint = (point) => {
    setObjectWaypoints(prev => {
      const idx = prev.length;
      const chosen = modelCatalog.find(m => m.id === selectedModelId);
      const isDrone = chosen?.category === 'drone';
      const isRobot = chosen?.category === 'character' || chosen?.category === 'robot';

      let defaultAction = 'CRUISE';
      if (idx === 0) defaultAction = 'SPAWN';
      else if (idx === 1) defaultAction = 'ACCELERATE';
      else if (idx === 2) defaultAction = 'DRIFT';
      else defaultAction = 'EMERGENCY_BRAKE';

      if (isDrone) {
        defaultAction = idx === 0 ? 'TAKEOFF' : (idx === 1 ? 'CORRIDOR_FLYBY' : 'ORBIT_TARGET');
      } else if (isRobot) {
        defaultAction = idx === 0 ? 'SPAWN' : (idx === 1 ? 'WALK' : (idx === 2 ? 'SCAN' : 'WAVE'));
      }

      return [
        ...prev,
        {
          lat: point.lat,
          lng: point.lng,
          altitude: point.altitude || 0,
          action: defaultAction,
          speed: chosen?.default_speed_mps || 16.0
        }
      ];
    });
  };

  const handleUpdateObjectWaypoint = (index, updates) => {
    setObjectWaypoints(prev =>
      prev.map((wp, idx) => (idx === index ? { ...wp, ...updates } : wp))
    );
  };

  const handleRemoveObjectWaypoint = (index) => {
    setObjectWaypoints(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearObjectWaypoints = () => {
    setObjectWaypoints([]);
    setActiveScene(null);
    setSceneCurrentTime(0.0);
    setIsPlayingScene(false);
  };

  // Simulate Physics Motion for Object
  const handleSimulateObjectMotion = async ({ prompt, customPhysics } = {}) => {
    const wpsToSimulate = objectWaypoints.length > 0
      ? objectWaypoints
      : (placedModelPos
          ? [placedModelPos]
          : [{ lat: sceneCenter.lat, lng: sceneCenter.lng, action: 'SPAWN' }]);

    setIsGeneratingScene(true);
    setActiveScene(null);
    setSceneCurrentTime(0.0);

    try {
      const resp = await fetch('http://localhost:8000/api/scene/direct_object_motion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: selectedModelId,
          waypoints: wpsToSimulate,
          center_lat: sceneCenter.lat,
          center_lng: sceneCenter.lng,
          city_id: activeCityId,
          prompt: prompt || '',
          custom_physics: customPhysics || null
        })
      });

      if (!resp.ok) {
        throw new Error(`Server returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      setActiveScene(data);
      setSceneCurrentTime(0.0);
      setIsPlayingScene(true);
      setCameraMode('free');
      setIsDrawObjectPathMode(false);
      if (!isLocationConfirmed) {
        setIsLocationConfirmed(true);
      }
      return data;
    } catch (err) {
      console.error('Failed to simulate object physics motion:', err);
      alert(`Simulation failed: ${err.message}. Ensure backend is running.`);
      return null;
    } finally {
      setIsGeneratingScene(false);
    }
  };

  // Screenplay AI Scene Director Handlers
  const handleTogglePickScreenplayStage = useCallback(() => {
    setIsPickingScreenplayStage(prev => {
      const next = !prev;
      if (next) {
        setIsPlacingModel(false);
        setIsDrawObjectPathMode(false);
        setIsDirectRouteMode(false);
        setIsPositioningRobot(false);
        setIsSelectingLocation(false);
      }
      return next;
    });
  }, []);

  const handleDropScreenplayStage = useCallback((pos) => {
    if (!pos) return;
    setScreenplayStagePos({
      ...pos,
      heading: pos.heading ?? cameraAngle?.heading ?? 0
    });
    setIsPickingScreenplayStage(false);
  }, [cameraAngle?.heading]);

  const handleUpdateStageHeading = useCallback((heading) => {
    setScreenplayStagePos(prev => ({
      ...(prev || {
        lat: sceneCenter.lat,
        lng: sceneCenter.lng,
        altitude: sceneCenter.altitude || 20
      }),
      heading
    }));
  }, [sceneCenter]);

  const handleRecenterScreenplayStage = useCallback(() => {
    setScreenplayStagePos({
      lat: sceneCenter.lat,
      lng: sceneCenter.lng,
      altitude: sceneCenter.altitude || 20,
      heading: cameraAngle?.heading || 0
    });
  }, [sceneCenter, cameraAngle?.heading]);

  const handleGenerateScreenplay = useCallback(async (promptText) => {
    if (!promptText || !promptText.trim()) return;
    setIsGeneratingScreenplay(true);

    const targetStage = screenplayStagePos ? {
      ...screenplayStagePos,
      heading: screenplayStagePos.heading ?? cameraAngle?.heading ?? 0
    } : {
      lat: sceneCenter.lat,
      lng: sceneCenter.lng,
      altitude: sceneCenter.altitude || 20,
      heading: cameraAngle?.heading ?? 0
    };

    try {
      const resp = await fetch('http://localhost:8000/api/scene/screenplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          city_id: activeCityId,
          center_lat: sceneCenter.lat,
          center_lng: sceneCenter.lng,
          custom_stage_pos: targetStage
        })
      });

      if (!resp.ok) {
        throw new Error(`Screenplay service returned HTTP ${resp.status}`);
      }

      const data = await resp.json();
      if (data && data.frames && data.frames.length > 0) {
        setActiveScene(data);
        setSceneCurrentTime(0.0);
        setIsPlayingScene(true);
        setCameraMode('free');
        if (!isLocationConfirmed) {
          setIsLocationConfirmed(true);
        }
      }
      return data;
    } catch (err) {
      console.error('Screenplay AI simulation failed:', err);
      alert(`Screenplay AI failed: ${err.message}. Ensure backend is running.`);
      return null;
    } finally {
      setIsGeneratingScreenplay(false);
    }
  }, [screenplayStagePos, sceneCenter, activeCityId, isLocationConfirmed]);

  const handleUpdateCurrentFrame = useCallback((frame) => {
    if (!frame) return;
    const pos = frame.pos || (frame.actors && frame.actors[0]) || {};
    setActiveActionName(frame.action || (frame.actors ? 'STUNT' : 'STANDBY'));
    setRobotTelemetry({
      lat: pos.lat || 0,
      lng: pos.lng || 0,
      altitude: pos.altitude || 0,
      groundAltitude: pos.ground_altitude || 0,
      heading: frame.heading || (frame.actors && frame.actors[0]?.heading) || 0,
      speed: frame.speed || (frame.actors && frame.actors[0]?.speed_mps) || 0,
      pitch: frame.pitch || 0,
      roll: frame.roll || 0,
      terrain: frame.terrain_telemetry,
      joints: frame.joints
    });
  }, []);

  // Hardware-accelerated Video Recording with Guaranteed Download
  const handleStartRecording = async () => {
    try {
      const canvas = getCanvasFuncRef.current?.();
      let stream = null;

      if (canvas && typeof canvas.captureStream === 'function') {
        try {
          stream = canvas.captureStream(60);
          const vTrack = stream.getVideoTracks()[0];
          if (!vTrack || vTrack.readyState !== 'live') {
            stream = null;
          }
        } catch (e) {
          console.warn('captureStream note:', e);
          stream = null;
        }
      }

      if (!stream && navigator.mediaDevices?.getDisplayMedia) {
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 60, displaySurface: 'browser' },
            audio: false,
            preferCurrentTab: true
          });
        } catch (e) {
          console.warn('getDisplayMedia dismissed:', e);
        }
      }

      activeRecordingStreamRef.current = stream;
      recordedChunksRef.current = [];

      if (!stream) {
        // Fallback: Telemetry Mode with backend synthetic MP4 export
        setIsRecordingVideo(true);
        setSceneCurrentTime(0.0);
        setIsPlayingScene(true);
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Clean up stream tracks after recorder has completely stopped and flushed all data
        if (activeRecordingStreamRef.current) {
          try {
            activeRecordingStreamRef.current.getTracks().forEach(t => t.stop());
          } catch (e) {}
          activeRecordingStreamRef.current = null;
        }

        const chunks = recordedChunksRef.current;
        const baseFilename = `robotwin_stunt_${Date.now()}`;
        let videoBlob = (chunks && chunks.length > 0) ? new Blob(chunks, { type: 'video/webm' }) : null;

        // If client stream had 0 chunks, fetch MP4 from backend test pipeline
        if (!videoBlob || videoBlob.size === 0) {
          try {
            const resp = await fetch('http://localhost:8000/api/scene/export_mp4/test');
            if (resp.ok) {
              videoBlob = await resp.blob();
            }
          } catch (e) {}
        }

        if (videoBlob && videoBlob.size > 0) {
          const isMp4 = videoBlob.type.includes('mp4') || videoBlob.type === '';
          
          if (isMp4) {
            const directUrl = URL.createObjectURL(videoBlob);
            const dlName = `${baseFilename}.mp4`;
            setReadyVideoDownload({
              url: directUrl,
              filename: dlName,
              size: (videoBlob.size / 1024 / 1024).toFixed(2),
              isTranscoding: false
            });
            const a = document.createElement('a');
            a.href = directUrl;
            a.download = dlName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          } else {
            // Signal AI sharpening & MP4 transcoding in progress
            setReadyVideoDownload({
              url: null,
              filename: `${baseFilename}.mp4`,
              size: (videoBlob.size / 1024 / 1024).toFixed(2),
              isTranscoding: true
            });

            try {
              const expectedDuration = activeScene?.total_duration_sec || activeScene?.duration || (cameraRailFrames?.length ? cameraRailFrames.length / 60 : 6.0);
              const formData = new FormData();
              formData.append('video_file', videoBlob, `${baseFilename}.webm`);
              formData.append('target_duration', String(expectedDuration));
              formData.append('fps', '60');
              const resp = await fetch('http://localhost:8000/api/scene/export_mp4', {
                method: 'POST',
                body: formData
              });
              if (resp.ok) {
                const mp4Blob = await resp.blob();
                const mp4Url = URL.createObjectURL(mp4Blob);
                const finalFilename = `${baseFilename}.mp4`;
                setReadyVideoDownload({
                  url: mp4Url,
                  filename: finalFilename,
                  size: (mp4Blob.size / 1024 / 1024).toFixed(2),
                  isTranscoding: false
                });
                const a = document.createElement('a');
                a.href = mp4Url;
                a.download = finalFilename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              } else {
                throw new Error('Transcode endpoint returned non-200');
              }
            } catch (err) {
              console.warn('Backend MP4 transcode fallback:', err);
              // Fallback to raw webm download if backend offline
              const directUrl = URL.createObjectURL(videoBlob);
              const dlName = `${baseFilename}.webm`;
              setReadyVideoDownload({
                url: directUrl,
                filename: dlName,
                size: (videoBlob.size / 1024 / 1024).toFixed(2),
                isTranscoding: false
              });
              const a = document.createElement('a');
              a.href = directUrl;
              a.download = dlName;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }
          }
        }
      };

      if (cameraMode === 'user_camera_rail' && cameraRailWaypoints.length >= 2 && (!cameraRailFrames || cameraRailFrames.length === 0)) {
        await handleCompileCameraRail();
      }

      // Reset playback state before starting capture
      setIsPlayingScene(false);
      setSceneCurrentTime(0.0);

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecordingVideo(true);

      // Pre-roll pause: allow canvas and hardware encoder ~200ms to stabilize and stream frame 0
      setTimeout(() => {
        setSceneCurrentTime(0.0);
        setIsPlayingScene(true);
      }, 200);
    } catch (err) {
      console.error('Recording initialization error:', err);
    }
  };

  const handleStopRecording = () => {
    setIsRecordingVideo(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.requestData();
      } catch (e) {}
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    } else {
      // Telemetry mode / fallback: fetch synthesized MP4 from backend
      (async () => {
        try {
          const resp = await fetch('http://localhost:8000/api/scene/export_mp4/test');
          if (resp.ok) {
            const testBlob = await resp.blob();
            const url = URL.createObjectURL(testBlob);
            const filename = `robotwin_stunt_${Date.now()}.mp4`;
            setReadyVideoDownload({
              url,
              filename,
              size: (testBlob.size / 1024 / 1024).toFixed(2),
              isTranscoding: false
            });
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        } catch (e) {}
      })();
    }
  };

  const handleExportTrajectory = () => {
    if (!activeScene) return;
    const blob = new Blob([JSON.stringify(activeScene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeScene.scene_id || 'robotwin_scene'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        overflow: 'hidden',
        background: '#030712',
        position: 'relative',
        display: 'flex'
      }}
    >
      {/* 1. Left Navbar with Location & AI Scene Director */}
      <LeftNavbar
        isSelectingLocation={isSelectingLocation}
        onToggleSelectLocation={handleToggleSelectLocation}
        isLocationConfirmed={isLocationConfirmed}
        onConfirmLocation={handleConfirmLocation}
        sceneCenter={sceneCenter}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRecenter={handleRecenter}
        activeCityId={activeCityId}
        onSelectCity={handleSelectCity}
        cities={DEFAULT_CITIES}
        onChangeCameraAngle={(preset) => setCameraAngle(prev => ({ ...prev, ...preset }))}
      />

      {/* 2. CityViewport: 3D Environment with Humanoid Model, Trajectory Ribbons & Camera */}
      <CityViewport
        isSelectingLocation={isSelectingLocation}
        setIsSelectingLocation={setIsSelectingLocation}
        sceneCenter={sceneCenter}
        setSceneCenter={setSceneCenter}
        cameraAngle={cameraAngle}
        setCameraAngle={setCameraAngle}
        isLocationConfirmed={isLocationConfirmed}
        setIsLocationConfirmed={setIsLocationConfirmed}
        activeScene={activeScene}
        currentTime={sceneCurrentTime}
        isPlaying={isPlayingScene}
        cameraMode={cameraMode}
        onChangeCameraMode={setCameraMode}
        isPositioningRobot={isPositioningRobot}
        onDropRobotPosition={handleDropRobotPosition}
        onUpdateCurrentFrame={handleUpdateCurrentFrame}
        placedRobotPos={placedRobotPos}
        getCanvasRef={getCanvasFuncRef}
        isDirectRouteMode={isDirectRouteMode}
        onToggleDirectRouteMode={() => setIsDirectRouteMode(prev => !prev)}
        customDirectedWaypoints={customDirectedWaypoints}
        onAddDirectWaypoint={handleAddDirectWaypoint}
        onRemoveDirectWaypoint={handleRemoveDirectWaypoint}
        onClearDirectedWaypoints={handleClearDirectedWaypoints}
        onDirectCustomPath={handleDirectCustomPath}
        onOpenJsonProtocolModal={() => setIsJsonProtocolOpen(true)}
        isRecordingVideo={isRecordingVideo}
        isDrawCameraRailMode={isDrawCameraRailMode}
        onAddCameraRailWaypoint={handleAddCameraRailWaypoint}
        cameraRailWaypoints={cameraRailWaypoints}
        cameraRailFrames={cameraRailFrames}
        cameraRailAltitudeOffset={cameraRailAltitudeOffset}
        isPlacingModel={isPlacingModel}
        onDropPlacedModel={handleDropPlacedModel}
        placedModelPos={placedModelPos}
        isDrawObjectPathMode={isDrawObjectPathMode}
        onAddObjectWaypoint={handleAddObjectWaypoint}
        objectWaypoints={objectWaypoints}
        isPickingScreenplayStage={isPickingScreenplayStage}
        onDropScreenplayStage={handleDropScreenplayStage}
        screenplayStagePos={screenplayStagePos}
        activeTab={activeTab}
      />

      {/* Unified AI Scene Director & Custom Camera Path Studio Panel */}
      {(activeTab === 'studio' || activeTab === 'screenplay' || activeTab === 'director') && (
        <DirectorStudioPanel
          stagePos={screenplayStagePos || sceneCenter}
          stageHeading={screenplayStagePos?.heading ?? cameraAngle?.heading ?? 0}
          onChangeStageHeading={handleUpdateStageHeading}
          cameraHeading={cameraAngle?.heading ?? 0}
          isPickingStagePos={isPickingScreenplayStage}
          onTogglePickStagePos={handleTogglePickScreenplayStage}
          onRecenterStagePos={handleRecenterScreenplayStage}
          onGenerateScreenplay={handleGenerateScreenplay}
          isGenerating={isGeneratingScreenplay}
          activeScene={activeScene}
          isDrawCameraRailMode={isDrawCameraRailMode}
          onToggleDrawCameraRailMode={() => setIsDrawCameraRailMode(prev => !prev)}
          cameraRailWaypoints={cameraRailWaypoints}
          cameraRailFrames={cameraRailFrames}
          onRemoveCameraRailWaypoint={handleRemoveCameraRailWaypoint}
          onClearCameraRailWaypoints={handleClearCameraRailWaypoints}
          onCompileCameraRail={() => handleCompileCameraRail()}
          cameraTrackingMode={cameraTrackingMode}
          onChangeCameraTrackingMode={setCameraTrackingMode}
          cameraRailAltitudeOffset={cameraRailAltitudeOffset}
          onChangeCameraRailAltitudeOffset={setCameraRailAltitudeOffset}
          isPlaying={isPlayingScene}
          onTogglePlay={handleTogglePlay}
          onResetPlayback={handleResetPlayback}
          currentTime={sceneCurrentTime}
          playbackSpeed={playbackSpeed}
          onChangePlaybackSpeed={setPlaybackSpeed}
          cameraMode={cameraMode}
          onChangeCameraMode={setCameraMode}
          isRecordingVideo={isRecordingVideo}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* 4. Streamlined Pencil Path Character Director */}
      {activeTab === 'pencil' && (
        <PencilPathDirector
          isDirectRouteMode={isDirectRouteMode}
          onToggleDirectRouteMode={() => setIsDirectRouteMode(prev => !prev)}
          customDirectedWaypoints={customDirectedWaypoints}
          onAddDirectWaypoint={handleAddDirectWaypoint}
          onUpdateDirectWaypoint={handleUpdateDirectWaypoint}
          onRemoveDirectWaypoint={handleRemoveDirectWaypoint}
          onClearDirectedWaypoints={handleClearDirectedWaypoints}
          onCompileAndDirect={handleCompileAndDirect}
          isGenerating={isGeneratingScene}
          activeScene={activeScene}
          isPlaying={isPlayingScene}
          onTogglePlay={handleTogglePlay}
          onResetPlayback={handleResetPlayback}
          currentTime={sceneCurrentTime}
          isRecordingVideo={isRecordingVideo}
          onStartRecording={() => handleCompileAndDirect({ mode: 'record' })}
          onStopRecording={handleStopRecording}
          cameraMode={cameraMode}
          onChangeCameraMode={setCameraMode}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* 5. 3D Models & Physics Asset Catalog Panel */}
      {activeTab === 'models' && (
        <ModelsDirectorPanel
          models={modelCatalog}
          selectedModelId={selectedModelId}
          onSelectModel={handleSelectModel}
          onClose={() => setActiveTab(null)}
        />
      )}

      {/* 6. Action JSON Protocol Modal */}
      <ActionJsonProtocolModal
        isOpen={isJsonProtocolOpen}
        onClose={() => setIsJsonProtocolOpen(false)}
        activeScene={activeScene}
        currentFrame={robotTelemetry}
        customDirectedWaypoints={customDirectedWaypoints}
      />

      {/* 5. Guaranteed Video Download Toast / Banner */}
      {readyVideoDownload && (
        <div
          id="toast-video-ready"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 99999,
            background: 'rgba(9, 14, 26, 0.96)',
            border: '1px solid rgba(16, 185, 129, 0.55)',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.85), 0 0 25px rgba(16, 185, 129, 0.35)',
            borderRadius: '16px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backdropFilter: 'blur(20px)',
            color: '#f8fafc',
            fontFamily: 'Inter, system-ui, sans-serif'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>🎬</span>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#f8fafc' }}>
                Stunt Video Ready ({readyVideoDownload.size} MB)
              </div>
              <div style={{ fontSize: '0.72rem', color: '#10b981' }}>
                {readyVideoDownload.isTranscoding ? 'Transcoding to H.264 MP4...' : 'Saved to Downloads'}
              </div>
            </div>
          </div>

          <a
            id="btn-download-video-file"
            href={readyVideoDownload.url}
            download={readyVideoDownload.filename}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontWeight: 800,
              fontSize: '0.82rem',
              padding: '9px 16px',
              borderRadius: '10px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer'
            }}
          >
            ⬇️ Save Video File
          </a>

          <button
            onClick={() => setReadyVideoDownload(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '1rem',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
