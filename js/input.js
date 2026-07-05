// Input tracking state
const mouse = new THREE.Vector2();
let targetCanvas;
let targetCamera;

// Virtual plane for projecting mouse position to 3D crease space
const creasePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -19.5);
const raycaster = new THREE.Raycaster();
const intersectionPoint = new THREE.Vector3();

// Bat swing kinematics
let isSwinging = false;
let swingProgress = 0.0;
const SWING_DURATION = 0.35; // seconds for a full swing

let isInitialized = false;

export function initInput(canvas, camera) {
  targetCanvas = canvas;
  targetCamera = camera;
  
  if (isInitialized) return;
  isInitialized = true;
  
  // Track pointer movements
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('touchmove', onTouchMove, { passive: true });
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function onTouchMove(event) {
  if (event.touches.length > 0) {
    const touch = event.touches[0];
    mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
  }
}

export function triggerSwing() {
  if (!isSwinging) {
    isSwinging = true;
    swingProgress = 0.0;
  }
}

export function getBatProperties() {
  return {
    isSwinging,
    swingProgress
  };
}

export function updateBatPosition(batGroup, dt) {
  if (!targetCamera) return;
  
  // 1. Raycast to crease plane to get X and Y positions
  raycaster.setFromCamera(mouse, targetCamera);
  raycaster.ray.intersectPlane(creasePlane, intersectionPoint);
  
  // Limit target X and Y to stay within crease bounds
  const limitX = 2.4; // width of the pitch area
  const minY = 0.2;
  const maxY = 2.6; // height boundary
  
  const targetX = Math.max(-limitX, Math.min(limitX, intersectionPoint.x));
  const targetY = Math.max(minY, Math.min(maxY, intersectionPoint.y));
  
  // Smoothly interpolate (lerp) bat position towards target for weightier feel
  // Faster lerp if swinging
  const lerpFactor = isSwinging ? 0.35 : 0.2;
  batGroup.position.x += (targetX - batGroup.position.x) * lerpFactor;
  batGroup.position.y += (targetY - batGroup.position.y) * lerpFactor;
  // Keep Z locked to crease line
  batGroup.position.z = 19.5;
  
  // 2. Animate bat rotation (idle vs swinging)
  if (isSwinging) {
    swingProgress += dt / SWING_DURATION;
    
    if (swingProgress >= 1.0) {
      isSwinging = false;
      swingProgress = 0.0;
    } else {
      // Swing animation interpolation:
      // Starts at backlift (rotated back around X and Z)
      // Hits at swingProgress ~ 0.45 (rotated forward, facing ball)
      // Finishes in follow-through
      let rotX = 0;
      let rotY = 0;
      let rotZ = 0;
      
      if (swingProgress < 0.4) {
        // Backlift to contact path
        const t = swingProgress / 0.4;
        rotX = -Math.PI / 4 + (Math.PI / 2) * t; // swing forward
        rotY = -Math.PI / 6 * (1 - t);
        rotZ = Math.PI / 8;
      } else {
        // Contact to follow through
        const t = (swingProgress - 0.4) / 0.6;
        rotX = Math.PI / 4 + (Math.PI / 3) * t; // complete follow through
        rotY = (Math.PI / 4) * t;
        rotZ = Math.PI / 8 - (Math.PI / 4) * t;
      }
      
      batGroup.rotation.set(rotX, rotY, rotZ);
    }
  } else {
    // Idle bat position (stands upright, tilted slightly towards bowler/slips)
    // Add subtle idle breath rotation
    const breath = Math.sin(Date.now() * 0.003) * 0.03;
    batGroup.rotation.x = -Math.PI / 6 + breath;
    batGroup.rotation.y = -Math.PI / 10;
    batGroup.rotation.z = Math.PI / 12;
  }
}
