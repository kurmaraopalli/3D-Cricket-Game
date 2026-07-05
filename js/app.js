import { updatePhysics, resetBallPhysics, getBallPosition, initPhysicsCallbacks, getLastDeliverySpeed, fielders } from './physics.js';
import { updateGameState, initGameState, getGameState, recordDotBall } from './gameLogic.js';
import { initInput, updateBatPosition, getBatProperties, triggerSwing } from './input.js';

// Three.js instances
let scene, camera, renderer;
let ballMesh, batGroup, stumpsGroup;
let fieldMesh, pitchMesh, boundaryRopes, stadiumLights = [];
let crowdMesh;

// Visual effect variables
let fielderMeshes = [];
let trailHistory = [];
const MAX_TRAIL_POINTS = 10;
let trailSpheres = [];

let sparksParticles = null;
let sparksData = [];
const MAX_SPARKS = 40;

let shakeDuration = 0;
let shakeIntensity = 0;
const originalCamPos = new THREE.Vector3(0, 4.5, 27);

let wicketsPhysics = null;
let prevGameStatus = 'waiting';
let alertTimeout = null;

// Animation / Game Loop parameters
let clock;
let isGameRunning = false;
let gameStatus = 'waiting'; // waiting, bowling, batted, hit-boundary, out, ball-dead

// Difficulty settings
export let difficulty = 'medium';

export function initGame() {
  clock = new THREE.Clock();
  
  // Set up Three.js Scene, Camera, Renderer
  initThree();
  
  // Create 3D Stadium and Game Entities
  createStadium();
  createWickets();
  createBall();
  createBat();
  
  // Initialize visual effects
  initBallTrail();
  initSparks();
  
  // Initialize user input handlers
  initInput(renderer.domElement, camera);
  
  // Register physics callbacks to break circular imports
  initPhysicsCallbacks({
    displayHUDAlert,
    setGameStatus,
    getGameStatus,
    resetForNextBall,
    recordDotBall
  });
  
  // Initialize game state (score, overs, target, high score)
  initGameState();
  
  // Wire up HTML events
  setupUIEvents();
  
  // Start the requestAnimationFrame render loop
  animate();
}

function initThree() {
  const container = document.getElementById('canvas-container');
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060913); // Dark spacey blue
  scene.fog = new THREE.FogExp2(0x060913, 0.008); // Night lights atmosphere
  
  // 2. Camera
  // Placed behind the batsman, looking down the pitch towards the bowler
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 4.5, 27);
  camera.lookAt(0, 1.2, -5);
  
  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  container.appendChild(renderer.domElement);
  
  // Window Resize
  window.addEventListener('resize', onWindowResize);
  
  // Add Lights
  // Ambient
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  
  // Directional Stadium Floodlight 1 (Key light / casts shadows)
  const floodlight1 = new THREE.DirectionalLight(0xffffff, 1.2);
  floodlight1.position.set(-30, 40, -10);
  floodlight1.castShadow = true;
  floodlight1.shadow.mapSize.width = 2048;
  floodlight1.shadow.mapSize.height = 2048;
  floodlight1.shadow.camera.near = 0.5;
  floodlight1.shadow.camera.far = 150;
  const d = 35;
  floodlight1.shadow.camera.left = -d;
  floodlight1.shadow.camera.right = d;
  floodlight1.shadow.camera.top = d;
  floodlight1.shadow.camera.bottom = -d;
  floodlight1.shadow.bias = -0.0005;
  scene.add(floodlight1);
  stadiumLights.push(floodlight1);
  
  // Stadium Floodlight 2 (Fill light)
  const floodlight2 = new THREE.DirectionalLight(0x8bc34a, 0.5); // green tint for field reflection
  floodlight2.position.set(30, 30, 20);
  scene.add(floodlight2);
  stadiumLights.push(floodlight2);
  
  // Stadium Floodlight 3 (Back light)
  const floodlight3 = new THREE.DirectionalLight(0x00d2ff, 0.6); // cyan cool night tint
  floodlight3.position.set(0, 35, -40);
  scene.add(floodlight3);
  stadiumLights.push(floodlight3);
}

function onWindowResize() {
  const container = document.getElementById('canvas-container');
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function createStadium() {
  // 1. Outfield (Concentric circles using procedurally colored material)
  const outfieldRadius = 120;
  const outfieldGeo = new THREE.RingGeometry(0.1, outfieldRadius, 64);
  
  // Rotate horizontal
  outfieldGeo.rotateX(-Math.PI / 2);
  
  // Custom canvas texture to draw nice turf stripes
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  
  // Radial grass stripes
  const numRings = 16;
  const center = 512;
  for (let i = numRings; i > 0; i--) {
    const r = (i / numRings) * 512;
    ctx.beginPath();
    ctx.arc(center, center, r, 0, 2 * Math.PI);
    ctx.fillStyle = i % 2 === 0 ? '#1b4332' : '#2d6a4f';
    ctx.fill();
  }
  
  // Add field lines
  ctx.beginPath();
  ctx.arc(center, center, 450, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 6;
  ctx.stroke();
  
  const grassTexture = new THREE.CanvasTexture(canvas);
  const outfieldMat = new THREE.MeshStandardMaterial({
    map: grassTexture,
    roughness: 0.8,
    metalness: 0.1
  });
  
  fieldMesh = new THREE.Mesh(outfieldGeo, outfieldMat);
  fieldMesh.receiveShadow = true;
  scene.add(fieldMesh);
  
  // 2. Pitch (Brown sandy loam wicket in the center)
  const pitchWidth = 3.6;
  const pitchLength = 26; // 22 yards + extra runoffs
  const pitchGeo = new THREE.PlaneGeometry(pitchWidth, pitchLength);
  pitchGeo.rotateX(-Math.PI / 2);
  
  const pitchCanvas = document.createElement('canvas');
  pitchCanvas.width = 256;
  pitchCanvas.height = 1024;
  const pCtx = pitchCanvas.getContext('2d');
  
  // Sand-dirt texture
  pCtx.fillStyle = '#d2b48c'; // Clay brown
  pCtx.fillRect(0, 0, 256, 1024);
  
  // Roughness details
  pCtx.fillStyle = '#c2a679';
  for (let i = 0; i < 500; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 1024;
    pCtx.fillRect(rx, ry, 2 + Math.random() * 4, 2 + Math.random() * 4);
  }
  
  // Crease Lines (Bowling crease and Pop-crease at both ends)
  pCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  pCtx.lineWidth = 8;
  
  // Batsman's Crease (around Z = 20)
  // Inside the canvas, top is batsman crease, bottom is bowler crease
  const batsmanCreaseY = 1024 * (6 / 26); // offset from one end
  const bowlerCreaseY = 1024 * (20 / 26); // offset
  
  pCtx.beginPath();
  pCtx.moveTo(0, batsmanCreaseY);
  pCtx.lineTo(256, batsmanCreaseY);
  pCtx.moveTo(0, bowlerCreaseY);
  pCtx.lineTo(256, bowlerCreaseY);
  pCtx.stroke();
  
  const pitchTexture = new THREE.CanvasTexture(pitchCanvas);
  const pitchMat = new THREE.MeshStandardMaterial({
    map: pitchTexture,
    roughness: 0.9,
    metalness: 0.05
  });
  
  pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
  pitchMesh.position.set(0, 0.01, 0); // slightly above grass to avoid z-fighting
  pitchMesh.receiveShadow = true;
  scene.add(pitchMesh);
  
  // 3. Boundary Ropes (Large torus)
  const boundaryRadius = 90;
  const boundaryGeo = new THREE.TorusGeometry(boundaryRadius, 0.6, 8, 48);
  boundaryGeo.rotateX(Math.PI / 2);
  const boundaryMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  boundaryRopes = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundaryRopes.position.set(0, 0.3, 0);
  boundaryRopes.receiveShadow = true;
  scene.add(boundaryRopes);
  
  // 4. Background Stadium Lights (visual dots representing floodlights)
  createVisualFloodlightTower(-60, 45, -30);
  createVisualFloodlightTower(60, 45, -30);
  createVisualFloodlightTower(-60, 45, 30);
  createVisualFloodlightTower(60, 45, 30);
  
  // 5. Crowd Stands (Low poly geometric circles surrounding the stadium)
  const standGeo = new THREE.CylinderGeometry(105, 120, 15, 32, 4, true);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x111625,
    roughness: 0.9,
    metalness: 0.2,
    side: THREE.BackSide
  });
  crowdMesh = new THREE.Mesh(standGeo, standMat);
  crowdMesh.position.set(0, 7.5, 0);
  scene.add(crowdMesh);
  
  // Generate visual crowd sparks
  createCrowdVisuals();
  
  // Render fielders inside stadium
  create3DFielders();
}

function createVisualFloodlightTower(x, y, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  
  // Metal Truss Pole
  const poleGeo = new THREE.CylinderGeometry(0.5, 1, y, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c354a, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = y / 2;
  group.add(pole);
  
  // Light Rig Frame (horizontal panel)
  const frameGeo = new THREE.BoxGeometry(10, 4, 1);
  const frame = new THREE.Mesh(frameGeo, poleMat);
  frame.position.y = y;
  frame.lookAt(0, 0, 0); // tilt towards pitch
  group.add(frame);
  
  // Add some bright emissive light spheres
  const lightGeo = new THREE.SphereGeometry(0.4, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  
  for (let i = -4; i <= 4; i += 2) {
    for (let j = -1; j <= 1; j += 1) {
      const bulb = new THREE.Mesh(lightGeo, lightMat);
      bulb.position.set(i, y + j, 0.6);
      group.add(bulb);
    }
  }
  
  scene.add(group);
}

function createCrowdVisuals() {
  // A particle system representing cell phone lights / glowing crowd elements
  const particleCount = 600;
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  
  for (let i = 0; i < particleCount; i++) {
    // Generate particles in a ring corresponding to the crowd stands
    const radius = 106 + Math.random() * 12;
    const angle = Math.random() * Math.PI * 2;
    const height = 2 + Math.random() * 12;
    
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = height;
    positions[i * 3 + 2] = Math.sin(angle) * radius;
    
    // Light glow colors (mostly white, cyan, yellow, pink)
    const randomColor = new THREE.Color();
    const type = Math.random();
    if (type < 0.6) randomColor.setHex(0xffffff); // phone flashes
    else if (type < 0.8) randomColor.setHex(0x00d2ff); // glowstick cyan
    else randomColor.setHex(0xff0080); // glowstick pink
    
    colors[i * 3] = randomColor.r;
    colors[i * 3 + 1] = randomColor.g;
    colors[i * 3 + 2] = randomColor.b;
  }
  
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMat = new THREE.PointsMaterial({
    size: 0.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    sizeAttenuation: true
  });
  
  const crowdParticles = new THREE.Points(particleGeo, particleMat);
  scene.add(crowdParticles);
}

function createWickets() {
  stumpsGroup = new THREE.Group();
  stumpsGroup.position.set(0, 0, 20.1); // Placed at batsman's stumps position
  
  const stumpHeight = 1.0;
  const stumpRadius = 0.05;
  const gap = 0.12;
  
  const stumpGeo = new THREE.CylinderGeometry(stumpRadius, stumpRadius, stumpHeight, 8);
  // Shift pivot to bottom of stump so positioning is easier
  stumpGeo.translate(0, stumpHeight / 2, 0);
  
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0xe5c185, // polished wood tone
    roughness: 0.4,
    metalness: 0.2
  });
  
  // Create 3 Stumps
  for (let i = -1; i <= 1; i++) {
    const stump = new THREE.Mesh(stumpGeo, woodMat);
    stump.position.x = i * gap;
    stump.castShadow = true;
    stump.receiveShadow = true;
    stump.name = `stump_${i + 1}`;
    stumpsGroup.add(stump);
  }
  
  // Create 2 Bails (horizontal logs sitting on top)
  const bailGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8);
  bailGeo.rotateZ(Math.PI / 2);
  
  const bailLeft = new THREE.Mesh(bailGeo, woodMat);
  bailLeft.position.set(-gap / 2, stumpHeight + 0.02, 0);
  bailLeft.castShadow = true;
  bailLeft.name = 'bail_left';
  stumpsGroup.add(bailLeft);
  
  const bailRight = new THREE.Mesh(bailGeo, woodMat);
  bailRight.position.set(gap / 2, stumpHeight + 0.02, 0);
  bailRight.castShadow = true;
  bailRight.name = 'bail_right';
  stumpsGroup.add(bailRight);
  
  scene.add(stumpsGroup);
}

function createBall() {
  const ballRadius = 0.11;
  const ballGeo = new THREE.SphereGeometry(ballRadius, 16, 16);
  
  const ballMat = new THREE.MeshStandardMaterial({
    color: 0xd90429, // Cherry red cricket ball
    roughness: 0.2,
    metalness: 0.1
  });
  
  ballMesh = new THREE.Mesh(ballGeo, ballMat);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  
  // Hide ball offscreen initially
  ballMesh.position.set(0, -10, 0);
  scene.add(ballMesh);
}

function createBat() {
  // A group to hold the bat so we can rotate around its handle pivot point
  batGroup = new THREE.Group();
  
  // Bat Blade
  const bladeWidth = 0.22;
  const bladeHeight = 1.0;
  const bladeDepth = 0.1;
  const bladeGeo = new THREE.BoxGeometry(bladeWidth, bladeHeight, bladeDepth);
  // Shift center so the handle attaches naturally
  bladeGeo.translate(0, -bladeHeight / 2, 0);
  
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x9c6644, // dark willow wood
    roughness: 0.5,
    metalness: 0.1
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.castShadow = true;
  blade.receiveShadow = true;
  batGroup.add(blade);
  
  // Bat Handle
  const handleRadius = 0.035;
  const handleHeight = 0.5;
  const handleGeo = new THREE.CylinderGeometry(handleRadius, handleRadius, handleHeight, 8);
  handleGeo.translate(0, handleHeight / 2, 0);
  
  const handleMat = new THREE.MeshStandardMaterial({
    color: 0xff3b6b, // rubber grip color
    roughness: 0.7,
    metalness: 0.0
  });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.castShadow = true;
  batGroup.add(handle);
  
  // Setup bat initial position and add to scene
  batGroup.position.set(0, 1.2, 19.5);
  scene.add(batGroup);
}

function setupUIEvents() {
  // Bowler style click handlers
  const modeButtons = document.querySelectorAll('.mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      modeButtons.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      difficulty = e.target.dataset.difficulty;
    });
  });
  
  // Play / Start buttons
  document.getElementById('start-play-btn').addEventListener('click', () => {
    document.getElementById('start-overlay').classList.add('hidden');
    startNewInnings();
  });
  
  document.getElementById('restart-play-btn').addEventListener('click', () => {
    document.getElementById('gameover-overlay').classList.add('hidden');
    startNewInnings();
  });
  
  // Help Toggle Trigger
  document.getElementById('help-toggle-btn').addEventListener('click', () => {
    // Show start overlay again as a guide
    const overlay = document.getElementById('start-overlay');
    overlay.classList.toggle('hidden');
  });
  
  // Keyboard triggers swing
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      triggerPlayerSwing();
    }
  });
  
  // Mouse click triggers swing in canvas
  document.getElementById('canvas-container').addEventListener('mousedown', (e) => {
    if (isGameRunning && gameStatus === 'bowling') {
      triggerPlayerSwing();
    }
  });
  
  // Tap triggers swing for mobile touch support
  document.getElementById('canvas-container').addEventListener('touchstart', (e) => {
    if (isGameRunning && gameStatus === 'bowling') {
      triggerPlayerSwing();
    }
  }, { passive: true });
}

function triggerPlayerSwing() {
  if (isGameRunning && gameStatus === 'bowling') {
    triggerSwing();
  }
}

function startNewInnings() {
  initGameState();
  isGameRunning = true;
  resetForNextBall();
}

export function resetForNextBall() {
  if (!isGameRunning) return;
  
  const state = getGameState();
  if (state.ballsFaced >= 6 || state.wickets >= 10) {
    // End Innings
    isGameRunning = false;
    showGameOverScreen();
    return;
  }
  
  // Reset Ball Visuals & physics values
  resetBallPhysics(difficulty);
  const startPos = getBallPosition();
  ballMesh.position.copy(startPos);
  ballMesh.rotation.set(0, 0, 0);
  
  // Clear ball trail history on delivery reset
  trailHistory = [];
  trailSpheres.forEach(s => s.visible = false);
  
  // Reset wickets position if knocked over
  resetWicketsAnimation();
  
  gameStatus = 'bowling';
  
  // Alert HUD
  displayHUDAlert(`Bowler running in... (${difficulty.toUpperCase()})`);
  
  // Update speeds display from unified physics calculations
  const speedKmH = getLastDeliverySpeed();
  document.getElementById('speed-display').textContent = `${speedKmH} km/h`;
}

function resetWicketsAnimation() {
  wicketsPhysics = null; // stop shatter animation updates
  
  stumpsGroup.children.forEach(child => {
    child.position.y = (child.name.startsWith('stump')) ? 0 : 1.02;
    child.rotation.set(0, 0, 0);
    // Reset individual offsets
    if (child.name === 'stump_0') child.position.x = -0.12;
    if (child.name === 'stump_1') child.position.x = 0;
    if (child.name === 'stump_2') child.position.x = 0.12;
    if (child.name === 'bail_left') child.position.set(-0.06, 1.02, 0);
    if (child.name === 'bail_right') child.position.set(0.06, 1.02, 0);
  });
}

export function animateWicketsBreak(delta) {
  if (!wicketsPhysics) {
    // Initialize wickets physical explosion
    wicketsPhysics = stumpsGroup.children.map(child => {
      let velocity, angularVelocity;
      if (child.name.startsWith('stump')) {
        velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          3 + Math.random() * 4,
          3 + Math.random() * 5
        );
        angularVelocity = new THREE.Vector3(
          -Math.random() * 6 - 2,
          0,
          (Math.random() - 0.5) * 5
        );
      } else {
        velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 3,
          6 + Math.random() * 5,
          2 + Math.random() * 5
        );
        angularVelocity = new THREE.Vector3(
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10,
          (Math.random() - 0.5) * 10
        );
      }
      return { mesh: child, velocity, angularVelocity };
    });
  }
  
  const gravity = -9.8;
  wicketsPhysics.forEach(p => {
    p.velocity.y += gravity * delta;
    p.mesh.position.addScaledVector(p.velocity, delta);
    
    // Simple ground floor bounce/resting check
    if (p.mesh.position.y < 0) {
      p.mesh.position.y = 0;
      p.velocity.set(0, 0, 0);
      p.angularVelocity.set(0, 0, 0);
    }
    
    p.mesh.rotation.x += p.angularVelocity.x * delta;
    p.mesh.rotation.y += p.angularVelocity.y * delta;
    p.mesh.rotation.z += p.angularVelocity.z * delta;
  });
}

function showGameOverScreen() {
  const state = getGameState();
  const won = state.score >= state.target;
  
  document.getElementById('gameover-title').textContent = won ? '🎉 VICTORY!' : '💔 DEFEAT!';
  document.getElementById('gameover-title').style.color = won ? 'var(--accent-color)' : 'var(--danger-color)';
  
  document.getElementById('gameover-desc').textContent = won 
    ? `Congratulations! You chased down the target of ${state.target} runs by scoring ${state.score}!` 
    : `Innings completed. You scored ${state.score} runs, failing to reach the target of ${state.target}.`;
  
  document.getElementById('summary-score').textContent = `${state.score}/${state.wickets}`;
  document.getElementById('summary-balls').textContent = state.ballsFaced;
  
  const sr = state.ballsFaced > 0 ? ((state.score / state.ballsFaced) * 100).toFixed(1) : '0.0';
  document.getElementById('summary-sr').textContent = sr;
  
  document.getElementById('gameover-overlay').classList.remove('hidden');
}

export function displayHUDAlert(msg, type = 'normal') {
  const card = document.getElementById('alert-card');
  card.textContent = msg;
  card.className = 'game-notification show';
  if (type === 'wicket') card.classList.add('wicket');
  
  if (alertTimeout) clearTimeout(alertTimeout);
  
  // Hide alert card after a delay
  alertTimeout = setTimeout(() => {
    card.classList.remove('show');
    alertTimeout = null;
  }, 2200);
}

// Set status
export function setGameStatus(status) {
  gameStatus = status;
}

export function getGameStatus() {
  return gameStatus;
}

// --- VISUAL AND GAMEPLAY EFFECTS ---

function create3DFielders() {
  const fielderGeo = new THREE.ConeGeometry(0.7, 2.2, 6);
  fielderGeo.translate(0, 1.1, 0);
  
  const fielderMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    roughness: 0.15,
    metalness: 0.8,
    emissive: 0x00ffcc,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.85
  });
  
  fielders.forEach(fielder => {
    const group = new THREE.Group();
    group.position.copy(fielder.pos);
    group.position.y = 0;
    
    const cone = new THREE.Mesh(fielderGeo, fielderMat);
    cone.castShadow = true;
    group.add(cone);
    
    cone.userData = { 
      bobSpeed: 2.5 + Math.random() * 2, 
      bobHeight: 0.15 + Math.random() * 0.1, 
      timeOffset: Math.random() * 100 
    };
    
    const ringGeo = new THREE.RingGeometry(fielder.radius - 0.2, fielder.radius + 0.1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff3b6b,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.02;
    group.add(ring);
    
    scene.add(group);
    fielderMeshes.push(cone);
  });
}

function initBallTrail() {
  const trailGroup = new THREE.Group();
  const baseRadius = 0.11;
  
  for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
    const scale = 1 - (i / MAX_TRAIL_POINTS);
    const trailGeo = new THREE.SphereGeometry(baseRadius * scale, 8, 8);
    const trailMat = new THREE.MeshBasicMaterial({
      color: 0xff3b6b,
      transparent: true,
      opacity: 0.35 * scale
    });
    const sphere = new THREE.Mesh(trailGeo, trailMat);
    sphere.visible = false;
    trailGroup.add(sphere);
    trailSpheres.push(sphere);
  }
  scene.add(trailGroup);
}

function updateBallTrail() {
  const isBallActive = (gameStatus === 'bowling' || gameStatus === 'batted');
  
  if (isBallActive) {
    trailHistory.unshift(ballMesh.position.clone());
    if (trailHistory.length > MAX_TRAIL_POINTS) {
      trailHistory.pop();
    }
    
    for (let i = 0; i < MAX_TRAIL_POINTS; i++) {
      if (i < trailHistory.length) {
        trailSpheres[i].position.copy(trailHistory[i]);
        trailSpheres[i].visible = true;
      } else {
        trailSpheres[i].visible = false;
      }
    }
  } else {
    trailHistory = [];
    trailSpheres.forEach(s => s.visible = false);
  }
}

function initSparks() {
  const particleGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX_SPARKS * 3);
  const colors = new Float32Array(MAX_SPARKS * 3);
  
  particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const particleMat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending
  });
  
  sparksParticles = new THREE.Points(particleGeo, particleMat);
  sparksParticles.visible = false;
  scene.add(sparksParticles);
}

function triggerSparksBurst(pos) {
  sparksParticles.visible = true;
  const positions = sparksParticles.geometry.attributes.position.array;
  const colors = sparksParticles.geometry.attributes.color.array;
  
  sparksData = [];
  const sparkColor = new THREE.Color(0x00ff88);
  
  for (let i = 0; i < MAX_SPARKS; i++) {
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    
    colors[i * 3] = sparkColor.r;
    colors[i * 3 + 1] = sparkColor.g;
    colors[i * 3 + 2] = sparkColor.b;
    
    const angle = Math.random() * Math.PI * 2;
    const phi = Math.acos((Math.random() - 0.5) * 2);
    const speed = 5 + Math.random() * 8;
    
    const vx = Math.sin(phi) * Math.cos(angle) * speed;
    const vy = Math.sin(phi) * Math.sin(angle) * speed;
    const vz = (Math.cos(phi) * speed) - 4;
    
    sparksData.push({
      velocity: new THREE.Vector3(vx, vy, vz),
      life: 1.0,
      decay: 1.8 + Math.random() * 1.6
    });
  }
  
  sparksParticles.geometry.attributes.position.needsUpdate = true;
  sparksParticles.geometry.attributes.color.needsUpdate = true;
}

function updateSparks(delta) {
  if (!sparksParticles || !sparksParticles.visible) return;
  
  const positions = sparksParticles.geometry.attributes.position.array;
  let activeCount = 0;
  
  for (let i = 0; i < MAX_SPARKS; i++) {
    const s = sparksData[i];
    if (s.life > 0) {
      s.life -= s.decay * delta;
      
      positions[i * 3] += s.velocity.x * delta;
      positions[i * 3 + 1] += s.velocity.y * delta;
      positions[i * 3 + 2] += s.velocity.z * delta;
      
      s.velocity.y += -9.8 * delta;
      
      activeCount++;
    }
  }
  
  sparksParticles.geometry.attributes.position.needsUpdate = true;
  sparksParticles.material.opacity = Math.max(0, sparksData[0].life);
  
  if (activeCount === 0) {
    sparksParticles.visible = false;
  }
}

function triggerCameraShake(duration, intensity) {
  shakeDuration = duration;
  shakeIntensity = intensity;
}

function updateCameraShake(delta) {
  if (shakeDuration > 0) {
    shakeDuration -= delta;
    
    const shakeX = (Math.random() - 0.5) * shakeIntensity;
    const shakeY = (Math.random() - 0.5) * shakeIntensity;
    
    camera.position.x = originalCamPos.x + shakeX;
    camera.position.y = originalCamPos.y + shakeY;
    
    if (shakeDuration <= 0) {
      camera.position.copy(originalCamPos);
    }
  }
}

// Core Loop
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  if (isGameRunning) {
    // 1. Move bat with mouse controls
    updateBatPosition(batGroup, delta);
    
    // 2. Perform physics step on the ball
    const batProperties = getBatProperties();
    updatePhysics(delta, ballMesh, batGroup, batProperties, stumpsGroup);
    
    // 3. Animate stumps breaking if wickets hit
    if (gameStatus === 'out') {
      animateWicketsBreak(delta);
    }
    
    // 4. Transition events (sparks, screen shake)
    if (gameStatus === 'batted' && prevGameStatus === 'bowling') {
      triggerSparksBurst(ballMesh.position);
      triggerCameraShake(0.2, 0.45);
    } else if (gameStatus === 'out' && prevGameStatus === 'bowling') {
      triggerCameraShake(0.35, 0.6);
    }
    prevGameStatus = gameStatus;
  }
  
  // Update visual effects
  updateBallTrail();
  updateSparks(delta);
  updateCameraShake(delta);
  
  // Bobbing hologram fielders animation
  const time = Date.now() * 0.001;
  fielderMeshes.forEach(mesh => {
    const u = mesh.userData;
    mesh.position.y = Math.sin(time * u.bobSpeed + u.timeOffset) * u.bobHeight;
    mesh.rotation.y += 0.01;
  });
  
  // Spin ball slightly during flight to look realistic
  if (gameStatus === 'bowling') {
    ballMesh.rotation.x += delta * 5;
    ballMesh.rotation.y += delta * 2;
  }
  
  // Render
  renderer.render(scene, camera);
}
