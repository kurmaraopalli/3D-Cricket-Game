** orchestration platform. Select **Option A** for an accessible browser-native deployment, or **Option B** for high-fidelity standalone physics simulation.

---

## 📊 Core Stack Comparison

| Evaluation Metric | Option A: WebGL Architecture (`Three.js`) | Option B: Native Engine Architecture (`Unity`) |
| :--- | :--- | :--- |
| **Primary Environment** | Web Browser (Chrome, Safari, Firefox) | Native Cross-Platform Executable (PC / Mobile) |
| **Language Profile** | Modern JavaScript (ES6+) / TypeScript | C# (.NET Core Framework) |
| **Physics Overhead** | Lightweight Elastic Spherical Vectors | Rigid-body Mesh Collision Engine |
| **Deployment Model** | Free hosting via GitHub Pages | Packaged Build Binaries |
| **Antigravity Focus** | Scripting procedural DOM-Canvas loops | Managing MonoBehavior lifecycle states |

---

## 📁 Option A: WebGL Browser Architecture (Three.js)

Best for lightweight portfolio projects that load instantly on GitHub via an interactive 3D scene without engine installation overhead.

### 1. File Structure Layout
```text
3d-cricket-webgl/
├── index.html          # Canvas entry-point and viewport definitions
├── assets/
│   └── pitch_texture.jpg
└── js/
    ├── app.js          # Antigravity Orchestrator: Scene, Camera, Light Init
    ├── physics.js      # Trajectory vectors, gravity coefficients, wind drag
    ├── gameLogic.js    # Scoring arrays, innings state tracker, wickets
    └── input.js        # Mouse/Pointer event listener translation matrices
```

### 2. Antigravity Generation Prompt
Copy and paste this into the **Antigravity Desktop App** prompt command line to automatically initialize the structure:
> `/planning Initialize a Three.js 3D world on an HTML5 canvas layer. Create a green 3D bounding plane to act as the cricket outfield and a central rectangular plane textured to look like a pitch. Place a spherical Mesh object to serve as the cricket ball. Write an active translation animation frame using requestAnimationFrame() that applies downward gravity force vectors and an initial exit forward-momentum vector to simulate a bowler throwing a delivery. Implement mouse-movement tracking to update the X and Y coordinates of a cylindrical bat mesh object positioned at the batsman's crease.`

---

## 📁 Option B: Native Engine Architecture (Unity)

Best for hyper-realistic physics, smooth player body animations, 3D stadium asset modeling, and mobile device target compilation.

### 1. File Structure Layout
```text
3d-cricket-unity/
├── Assets/
│   ├── Scenes/
│   │   └── MainStadium.unity
│   ├── Prefabs/
│   │   ├── CricketBall.prefab
│   │   └── CricketBat.prefab
│   └── Scripts/
│       ├── BallPhysicsController.cs # Manages custom AddForce vectors
│       ├── BatCollisionHandler.cs   # Calculates dynamic exit velocities
│       ├── ScoreStateManager.cs     # Watches run triggers and wickets
│       └── UIManager.cs             # Canvas text interpolation layer
```

### 2. Antigravity Generation Prompt
Ensure you have the active project folder bound inside the **Antigravity Agent Manager Workspace**, then invoke this action:
> `/planning Set up a Unity 3D structural codebase. Generate a script named 'BallPhysicsController.cs' that leverages Unity's RigidBody component to apply instantaneous force vectors simulating fast bowling, leg-spin, and off-spin drift. Write a second C# file named 'BatCollisionHandler.cs' containing an OnCollisionEnter() logic module. When the ball collider hits the bat collider mesh, read the exact point of contact velocity matrix to calculate an output reflection vector. Map the output position to a series of target vector distance brackets to reward the session score with 1, 2, 4, or 6 runs respectively.`

---

## 🛠️ Multi-Agent Compilation Strategy
Once you pick your target folder path:
1. Open the [Antigravity Desktop Platform](https://antigravity.google/).
2. Switch your operational toggle mode from **Fast Mode** to **Planning Mode** to inspect the file mapping structure.
3. Execute the corresponding generation prompt from above.
4. Review the generated validation artifacts panel before committing changes to your workspace repository.
