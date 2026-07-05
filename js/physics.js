import { recordRuns, recordWicket } from './gameLogic.js';
import { segmentIntersectsBox } from './collision.js';
import { playBatHitSound, playWicketsSound, playCrowdCheer, playBounceSound } from './audio.js';

let appCallbacks = {
  displayHUDAlert: () => {},
  setGameStatus: () => {},
  getGameStatus: () => 'waiting',
  resetForNextBall: () => {},
  recordDotBall: () => {}
};

export function initPhysicsCallbacks(callbacks) {
  appCallbacks = { ...appCallbacks, ...callbacks };
}

let lastDeliverySpeedKmH = 0;
export function getLastDeliverySpeed() {
  return lastDeliverySpeedKmH;
}

// Physics constants
const GRAVITY = -9.8;
const PITCH_RESTITUTION = 0.55; // bounce bounce
const PITCH_FRICTION = 0.08;
const AIR_DRAG = 0.015;

// Ball state variables
const ballPos = new THREE.Vector3();
const ballVel = new THREE.Vector3();
const ballRadius = 0.11;

// Bowler delivery characteristics
let spinXEffect = 0.0; // spin amount after bounce
let bowlerReleasePos = new THREE.Vector3(0, 2.3, -20);
let hasBounced = false;
let isHitByBat = false;
let bounceCount = 0;
let timeInFlight = 0;
let ballFirstBouncedPos = null;

// Virtual fielders positions (scattered in outfield, radius 50 to 85)
export const fielders = [
  { name: 'Deep Mid-Wicket', pos: new THREE.Vector3(-60, 0, -20), radius: 8 },
  { name: 'Long On', pos: new THREE.Vector3(-25, 0, -70), radius: 10 },
  { name: 'Long Off', pos: new THREE.Vector3(25, 0, -70), radius: 10 },
  { name: 'Deep Cover', pos: new THREE.Vector3(65, 0, -10), radius: 8 },
  { name: 'Fine Leg', pos: new THREE.Vector3(-30, 0, 45), radius: 6 },
  { name: 'Third Man', pos: new THREE.Vector3(45, 0, 25), radius: 6 },
  { name: 'Point', pos: new THREE.Vector3(35, 0, -5), radius: 5 },
  { name: 'Mid-Off', pos: new THREE.Vector3(15, 0, -25), radius: 6 }
];

export function getBallPosition() {
  return ballPos;
}

export function resetBallPhysics(difficulty = 'medium') {
  // Set bowler release coordinates
  // Bowler releases from slightly left or right of the stumps at Z = -20
  const sideOffset = (Math.random() - 0.5) * 0.8;
  bowlerReleasePos.set(sideOffset, 2.3, -20);
  ballPos.copy(bowlerReleasePos);
  
  hasBounced = false;
  isHitByBat = false;
  bounceCount = 0;
  timeInFlight = 0;
  ballFirstBouncedPos = null;
  spinXEffect = 0.0;
  
  // Calculate delivery trajectory towards batsman (crease at Z = 20)
  // Target a bounce spot on the pitch: Z = 6 to 12 (good length)
  const targetZ = 6 + Math.random() * 6; 
  // Let the ball arrive at the batsman crease around Y = 0.4 to 1.2
  const arrivalY = 0.4 + Math.random() * 0.7;
  // Let's aim slightly left or right of stumps center (X = 0)
  const targetX = (Math.random() - 0.5) * 0.6;
  
  // Speed variations based on difficulty
  let ballSpeedMPS = 28; // ~100 km/h default
  if (difficulty === 'fast') {
    ballSpeedMPS = 36 + Math.random() * 4; // ~130 - 145 km/h
  } else if (difficulty === 'spin') {
    ballSpeedMPS = 20 + Math.random() * 3; // ~72 - 82 km/h
    // Apply off-spin or leg-spin bias
    const spinDirection = Math.random() > 0.5 ? 1 : -1;
    spinXEffect = spinDirection * (1.2 + Math.random() * 1.5); 
  } else {
    ballSpeedMPS = 28 + Math.random() * 4; // ~100 - 115 km/h
  }
  
  // Calculate speed in km/h: m/s * 3.6
  lastDeliverySpeedKmH = Math.round(ballSpeedMPS * 3.6);
  
  // Flight time based on speed and horizontal distance
  const distanceZ = 20 - bowlerReleasePos.z; // Z distance = 40
  const duration = distanceZ / ballSpeedMPS;
  
  // Back-calculate horizontal velocity
  ballVel.z = ballSpeedMPS;
  ballVel.x = (targetX - bowlerReleasePos.x) / duration;
  
  // vertical trajectory: we want the ball to bounce on pitch at targetZ and reach batsman at arrivalY.
  // Solving kinematics: dy = v_iy * t + 0.5 * g * t^2 with bounce restitution in the middle.
  // To keep it clean and robust, we can approximate the initial vertical launch velocity:
  if (difficulty === 'spin') {
    // Loopier trajectory
    ballVel.y = 3.5 - (targetZ * 0.1); 
  } else {
    // Flatter trajectory
    ballVel.y = 1.0 - (targetZ * 0.05);
  }
}

export function updatePhysics(dt, ballMesh, batGroup, batProps, stumpsGroup) {
  const status = appCallbacks.getGameStatus();
  
  if (status === 'waiting' || status === 'out' || status === 'ball-dead' || status === 'hit-boundary') {
    return;
  }
  
  timeInFlight += dt;
  
  // 1. Apply gravity to velocity
  ballVel.y += GRAVITY * dt;
  
  // 2. Apply wind/air resistance drag
  ballVel.x -= ballVel.x * AIR_DRAG * dt;
  ballVel.y -= ballVel.y * AIR_DRAG * dt;
  ballVel.z -= ballVel.z * AIR_DRAG * dt;
  
  const prevBallPos = ballPos.clone();

  // 3. Update Position
  ballPos.x += ballVel.x * dt;
  ballPos.y += ballVel.y * dt;
  ballPos.z += ballVel.z * dt;
  
  // 4. Update the visual mesh
  ballMesh.position.copy(ballPos);
  
  // --- STATE-SPECIFIC PHYSICS LOGIC ---
  
  if (status === 'bowling') {
    // A. Pitch Bounce Detection
    // Pitch bounds: X within [-1.8, 1.8], Z within [-13, 22]
    if (ballPos.y <= ballRadius && ballPos.x >= -1.8 && ballPos.x <= 1.8 && ballPos.z >= -13 && ballPos.z <= 22) {
      ballPos.y = ballRadius;
      ballVel.y = -ballVel.y * PITCH_RESTITUTION;
      playBounceSound();
      
      // Apply pitch friction
      ballVel.z *= (1 - PITCH_FRICTION);
      ballVel.x *= (1 - PITCH_FRICTION);
      
      // Apply spin drift on bounce
      if (spinXEffect !== 0.0 && !hasBounced) {
        ballVel.x += spinXEffect; // turn off/on the deck
      }
      
      hasBounced = true;
      bounceCount++;
    }
    
    // B. Check collision with stumps (if player missed)
    // Batsman stumps are at Z = 20.1
    if (ballPos.z >= 20.0 && ballPos.z <= 20.3) {
      const stumpRadiusRange = 0.22; // width of 3 stumps + margins
      const stumpHeightRange = 1.05; // height of bails
      
      if (Math.abs(ballPos.x) <= stumpRadiusRange && ballPos.y <= stumpHeightRange) {
        // CLEAN BOWLED!
        appCallbacks.setGameStatus('out');
        recordWicket();
        playWicketsSound();
        appCallbacks.displayHUDAlert('CLEAN BOWLED! OUT!', 'wicket');
        return;
      }
    }
    
    // C. Collision with Cricket Bat
    // Bat crease is at Z = 19.5. Use a swept intersection against the bat's box to make hits feel far more reliable.
    if (ballPos.z >= 18.5 && ballPos.z <= 19.9) {
      const batX = batGroup.position.x;
      const batY = batGroup.position.y;
      const batHalfExtents = { x: 0.55, y: 0.95, z: 0.22 };
      const batCenter = new THREE.Vector3(batX, batY, 19.5);

      const didHitBat = segmentIntersectsBox(
        prevBallPos,
        ballPos,
        batCenter,
        batHalfExtents
      );

      if (didHitBat) {
        // Player hit the ball!
        isHitByBat = true;
        appCallbacks.setGameStatus('batted');
        playBatHitSound();
        bounceCount = 0; // Reset bounce count on hit so aerial catches work
        timeInFlight = 0; // Reset time in flight on hit for caught out check
        
        // Calculate hit velocity based on swing state and timing
        const isSwinging = batProps.isSwinging;
        const swingProgress = batProps.swingProgress; // 0 to 1
        
        let hitSpeedMultiplier = 0.5; // weak block / edges
        let hitLabel = 'Defended!';
        
        if (isSwinging) {
          // Sweet spot timing: swing progress is between 0.25 and 0.6
          if (swingProgress >= 0.25 && swingProgress <= 0.65) {
            hitSpeedMultiplier = 1.7 + Math.random() * 0.4; // Solid middle!
            hitLabel = 'Smashed!';
          } else {
            hitSpeedMultiplier = 1.0 + Math.random() * 0.3; // Decent connection
            hitLabel = 'Shot!';
          }
        }
        
        // Compute launch angles
        // Bounce vector back into stadium
        // Left-right angle based on offset of ball relative to bat center
        const xOffset = ballPos.x - batX;
        
        // Direction vectors
        // Ball flies back down the ground (negative Z)
        ballVel.z = -Math.abs(ballVel.z) * hitSpeedMultiplier;
        
        // Horizontal spread depending on off/on side angle
        ballVel.x = (xOffset * 16) + (Math.random() - 0.5) * 4; 
        
        // Launch angle (upward)
        if (isSwinging) {
          ballVel.y = 10 + (Math.random() * 12); // flies high
        } else {
          ballVel.y = 2 + (Math.random() * 4); // safe ground shot
        }
        
        // Trigger a camera look at the ball after hit
        appCallbacks.displayHUDAlert(`${hitLabel} Velocity: ${Math.abs(Math.round(ballVel.z * 3.6))} km/h`);
      }
    }
    
    // D. If ball passes the batsman crease without hitting, it's a dot ball/passed
    if (ballPos.z > 22.0) {
      appCallbacks.setGameStatus('ball-dead');
      appCallbacks.recordDotBall();
      appCallbacks.displayHUDAlert('Dot Ball!');
      setTimeout(() => {
        appCallbacks.resetForNextBall();
      }, 1500);
    }
  } 
  
  else if (status === 'batted') {
    // A. Check if the ball bounces on outfield
    if (ballPos.y <= ballRadius) {
      ballPos.y = ballRadius;
      ballVel.y = -ballVel.y * 0.35; // lower bounce on outfield grass
      ballVel.x *= 0.6; // heavy friction roll
      ballVel.z *= 0.6;
      
      // Store where it first bounced for run/boundary checking
      if (ballFirstBouncedPos === null) {
        ballFirstBouncedPos = ballPos.clone();
      }
      
      bounceCount++;
    }
    
    // B. Check boundary collision
    const distanceFromCenter = Math.sqrt(ballPos.x * ballPos.x + ballPos.z * ballPos.z);
    
    if (distanceFromCenter >= 90) {
      appCallbacks.setGameStatus('hit-boundary');
      
      // Determine if 4 or 6
      // If it has bounced prior to 90m, or hit pitch first:
      const hadOutfieldBounce = (ballFirstBouncedPos !== null);
      if (hadOutfieldBounce) {
        recordRuns(4);
        playCrowdCheer();
        appCallbacks.displayHUDAlert('FOUR RUNS! 🏏', 'normal');
      } else {
        recordRuns(6);
        playCrowdCheer();
        appCallbacks.displayHUDAlert('💥 SIX RUNS! OUT OF THE PARK!', 'normal');
      }
      
      setTimeout(() => {
        appCallbacks.resetForNextBall();
      }, 2500);
      return;
    }
    
    // C. Check fielders / caught out
    // If ball is in air (bounceCount === 0) and flies near any fielder in 3D space
    if (bounceCount === 0 && ballPos.y < 3.0 && ballPos.y > 0.3 && timeInFlight > 0.4) {
      for (const fielder of fielders) {
        const distToFielder = ballPos.distanceTo(fielder.pos);
        if (distToFielder < fielder.radius) {
          // CAUGHT OUT!
          appCallbacks.setGameStatus('out');
          recordWicket();
          appCallbacks.displayHUDAlert(`CAUGHT OUT by ${fielder.name}!`, 'wicket');
          return;
        }
      }
    }
    
    // D. If the ball is rolling/stops (speed becomes very low), ball is dead
    const horizontalSpeed = Math.sqrt(ballVel.x * ballVel.x + ballVel.z * ballVel.z);
    if (bounceCount > 0 && horizontalSpeed < 0.8) {
      appCallbacks.setGameStatus('ball-dead');
      
      // Calculate runs scored based on distance traveled
      let runsScored = 1;
      if (distanceFromCenter > 65) runsScored = 3;
      else if (distanceFromCenter > 35) runsScored = 2;
      
      // Random chance of fielder throwing back and getting a runout/dot ball instead if running 3
      if (runsScored === 3 && Math.random() < 0.15) {
        recordWicket();
        appCallbacks.displayHUDAlert('RUN OUT! A brilliant direct hit!', 'wicket');
      } else {
        recordRuns(runsScored);
        appCallbacks.displayHUDAlert(`${runsScored} Run${runsScored > 1 ? 's' : ''} taken!`);
      }
      
      setTimeout(() => {
        appCallbacks.resetForNextBall();
      }, 2000);
    }
  }
}
