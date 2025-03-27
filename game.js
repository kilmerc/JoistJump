/**
 * Nucor Runner Game
 *
 * An endless runner game where the player controls the Nucor logo,
 * jumps to avoid obstacles (NewMill and Canam logos), and collects joists.
 * Difficulty increases over time with faster speed, more frequent obstacles,
 * and vertically moving obstacles.
 */

// --- START OF FILE game.js ---

// =============================================================================
// --- Game Configuration ---
// =============================================================================

/** Color palette definition for various game elements. */
const COLORS = {
  nucorGreen: [0, 125, 65], // Player primary color
  nucorLightGreen: [40, 180, 100], // Player jump highlight
  obstacleNM: [255, 180, 0], // NewMill obstacle color tint
  obstacleCA: [30, 120, 220], // Canam obstacle color tint
  joist: [180, 180, 180], // Regular joist color
  joistHighlight: [220, 220, 220], // Particle color for regular joist collect
  joistGold: [255, 215, 0], // Golden joist color & particles
  ground: [80, 65, 45], // Ground fill color
  groundStroke: [60, 45, 35], // Ground line color
  sky: [135, 206, 250], // Sky background color
  clouds: [255, 255, 255, 200], // Cloud color (with alpha)
  mountains: [110, 90, 70], // Mountain color
  text: [20, 20, 20], // General text color (not used much currently)
  uiBackground: [0, 0, 0, 180], // Semi-transparent UI panel background
  uiText: [255, 255, 255], // Text color for UI elements
};

/** Dimensions for core game entities. */
const PLAYER_SIZE = 60;
const OBSTACLE_SIZE = 55;
const JOIST_WIDTH = 70;
const JOIST_HEIGHT = 35;

/** Physics and movement constants. */
const GRAVITY = 0.6; // Downward acceleration applied to the player
const JUMP_FORCE = -13; // Initial upward velocity on jump
const VARIABLE_JUMP_DAMPING = 0.5; // Multiplier to reduce upward velocity when jump is released early
const GROUND_OFFSET = 0.8; // Vertical position of the ground line (80% down the screen)
const INITIAL_GAME_SPEED = 5; // Starting speed of the game scrolling

/** Logarithmic difficulty scaling parameters. */
const SPEED_LOG_BASE = 3.0; // Controls the steepness of the speed increase curve
const SPEED_LOG_SCALE = 0.015; // Controls how quickly distance affects the speed increase
const SPAWN_RATE_LOG_BASE = 20; // Controls the steepness of spawn rate decrease
const SPAWN_RATE_LOG_SCALE = 0.012; // Controls how quickly distance affects spawn rate decrease

/** Minimum spawn rates (in frames) define maximum difficulty. */
const MIN_OBSTACLE_SPAWN_RATE = 40; // Fastest possible time between obstacle spawns
const MIN_JOIST_SPAWN_RATE = 60; // Fastest possible time between joist spawns

/** Base spawn rates (in frames) define starting difficulty. */
const BASE_OBSTACLE_SPAWN_RATE = 120; // Initial time between obstacle spawns
const BASE_JOIST_SPAWN_RATE = 160; // Initial time between joist spawns

/** Parameters for vertically moving obstacles feature. */
const VERTICAL_MOVE_START_DISTANCE = 1000; // Distance (meters) when obstacles *might* start moving vertically
const VERTICAL_MOVE_CHANCE = 0.35; // Probability (0-1) that an obstacle moves vertically after the threshold
const VERTICAL_MOVE_RANGE = PLAYER_SIZE * 1.8; // Total pixel range of vertical oscillation
const VERTICAL_MOVE_SPEED = 0.04; // Base speed of vertical oscillation (radians per frame)

/** Particle effect parameters. */
const COLLECT_PARTICLES = 15; // Number of particles spawned when collecting a joist
const PARTICLE_LIFETIME = 40; // Duration (frames) particles remain active

// =============================================================================
// --- Game State Variables ---
// =============================================================================

let player; // The player object instance
let obstacles = []; // Array storing active obstacle objects
let joists = []; // Array storing active joist objects
let activeParticles = []; // Array storing currently visible/updating particles
let particlePool = []; // Array storing inactive particles for reuse (object pooling)
let clouds = []; // Array storing cloud background elements
let mountains = []; // Array storing mountain background elements
let groundTiles = []; // Array storing ground tile elements for scrolling effect

let score = 0; // Player's current score (joists collected)
let highScore = 0; // Highest score achieved (loaded from localStorage)
let distance = 0; // Distance travelled in the current run (meters)
let gameOver = false; // Flag indicating if the game is over
let gameStarted = false; // Flag indicating if the game has started (past the initial screen)
let gameSpeed = INITIAL_GAME_SPEED; // Current scrolling speed of the game
let groundY; // Calculated Y coordinate of the ground line
let lastJumpTime = 0; // Timestamp of the last jump (used for potential UI effects)
let isJumping = false; // Flag indicating if the jump input is currently being held down

// =============================================================================
// --- Image Assets ---
// =============================================================================

let nucorImg; // Image for the player
let newMillImg; // Image for the NewMill obstacle type
let canamImg; // Image for the Canam obstacle type

// =============================================================================
// --- Core p5.js Functions ---
// =============================================================================

/**
 * Preloads necessary assets before the game starts.
 */
function preload() {
  nucorImg = loadImage("assets/nucor.png");
  newMillImg = loadImage("assets/NewMill.png");
  canamImg = loadImage("assets/Canam.png");
  // Sound effects removed as requested
}

/**
 * Initializes the game environment, canvas, and initial state.
 * Runs once at the beginning.
 */
function setup() {
  createCanvas(windowWidth, windowHeight); // Create canvas filling the window
  groundY = height * GROUND_OFFSET; // Calculate ground position based on height

  // Initialize game state and background elements
  resetGame(); // Sets initial game variables (also called on restart)
  createClouds(); // Generate initial cloud positions
  createMountains(); // Generate initial mountain positions
  createGroundTiles(); // Generate initial ground tiles

  // Configure text and drawing settings
  textAlign(CENTER, CENTER);
  textFont("Arial"); // Consider using a more thematic font if available
  noStroke(); // Disable outlines for most shapes by default

  // Attempt to load the high score from browser's localStorage
  try {
    const savedHighScore = localStorage.getItem("nucorGameHighScore");
    if (savedHighScore) {
      highScore = parseInt(savedHighScore);
    }
  } catch (e) {
    console.warn("Could not load high score from localStorage:", e);
  }
}

/**
 * Main game loop function, called repeatedly by p5.js.
 * Handles game logic updates and rendering based on the current game state.
 */
function draw() {
  // Always draw the background first
  drawBackground();

  // Conditional rendering based on game state
  if (!gameStarted) {
    // --- STATE: Game Not Started ---
    drawStartScreen();
  } else if (!gameOver) {
    // --- STATE: Game Running ---
    updateGame(); // Update positions, physics, difficulty
    drawGameElements(); // Draw player, obstacles, joists, particles
    checkCollisions(); // Detect collisions between player and objects
    drawUI(); // Draw score, distance, high score overlay
  } else {
    // --- STATE: Game Over ---
    drawGameElements(); // Continue drawing game elements in their final state
    drawGameOverScreen(); // Display the game over message and scores
  }
}

// =============================================================================
// --- Background Drawing Functions ---
// =============================================================================

/**
 * Draws all background layers (sky, mountains, clouds, ground).
 */
function drawBackground() {
  background(COLORS.sky); // Solid sky color (could be gradient)
  drawMountains();
  drawClouds();
  drawGround();
}

/**
 * Creates the initial set of cloud objects.
 */
function createClouds() {
  let cloudCount = floor(width / 300); // Number of clouds based on screen width
  clouds = []; // Clear existing clouds before creating new ones (for resize/reset)
  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: random(width), // Random horizontal start position
      y: random(height * 0.1, height * 0.4), // Random vertical position in upper part of sky
      width: random(80, 200), // Random cloud width
      height: random(40, 80), // Random cloud height
      speed: random(0.1, 0.3), // Random individual cloud scroll speed multiplier
    });
  }
}

/**
 * Updates cloud positions and draws them.
 */
function drawClouds() {
  fill(COLORS.clouds);
  noStroke();

  for (let cloud of clouds) {
    // Move clouds horizontally based on game speed and individual speed
    if (gameStarted && !gameOver) {
      cloud.x -= cloud.speed * (gameSpeed / INITIAL_GAME_SPEED); // Scale movement with game speed progression

      // Loop clouds that move off-screen to the right side
      if (cloud.x < -cloud.width) {
        cloud.x = width + cloud.width; // Reset position to the right edge
        cloud.y = random(height * 0.1, height * 0.4); // Optionally randomize Y position on loop
      }
    }

    // Draw cloud shape using overlapping ellipses
    ellipse(cloud.x, cloud.y, cloud.width, cloud.height);
    ellipse(
      cloud.x - cloud.width * 0.2,
      cloud.y - cloud.height * 0.1,
      cloud.width * 0.6,
      cloud.height * 0.7
    );
    ellipse(
      cloud.x + cloud.width * 0.2,
      cloud.y - cloud.height * 0.1,
      cloud.width * 0.7,
      cloud.height * 0.6
    );
  }
}

/**
 * Creates the initial set of mountain objects.
 */
function createMountains() {
  let mountainCount = floor(width / 200) + 2; // Number of mountains based on screen width, plus padding
  mountains = []; // Clear existing mountains (for resize/reset)
  for (let i = 0; i < mountainCount; i++) {
    mountains.push({
      // Spread them out somewhat evenly initially, with some random offset
      x: i * (width / (mountainCount - 1)) + random(-50, 50),
      height: random(height * 0.2, height * 0.35), // Random mountain height
      width: random(200, 400), // Random mountain width
    });
  }
}

/**
 * Updates mountain positions (parallax effect) and draws them.
 */
function drawMountains() {
  fill(COLORS.mountains);
  noStroke();

  for (let mountain of mountains) {
    // Move mountains slower than game speed for parallax effect
    if (gameStarted && !gameOver) {
      mountain.x -= gameSpeed * 0.2; // Slower scroll speed factor

      // Loop mountains that move off-screen to the right side
      if (mountain.x < -mountain.width) {
        mountain.x = width + random(50, 150); // Reset position with random offset
        mountain.height = random(height * 0.2, height * 0.35); // Randomize properties on loop
        mountain.width = random(200, 400);
      }
    }

    // Draw mountain shape as a triangle
    triangle(
      mountain.x,
      groundY, // Bottom-left corner
      mountain.x + mountain.width / 2,
      groundY - mountain.height, // Top point
      mountain.x + mountain.width,
      groundY // Bottom-right corner
    );

    // Draw a simple snow cap near the peak
    fill(240, 240, 250); // White-ish color for snow
    triangle(
      mountain.x + mountain.width / 2 - mountain.width / 10,
      groundY - mountain.height + mountain.height / 5,
      mountain.x + mountain.width / 2,
      groundY - mountain.height,
      mountain.x + mountain.width / 2 + mountain.width / 10,
      groundY - mountain.height + mountain.height / 5
    );
    fill(COLORS.mountains); // Reset fill color for the next mountain
  }
}

/**
 * Creates the initial set of ground tile objects for the scrolling effect.
 */
function createGroundTiles() {
  const tileWidth = 80; // Width of each ground segment line
  const tileCount = ceil(width / tileWidth) + 2; // Number of tiles needed to cover width, plus padding
  groundTiles = []; // Clear existing tiles (for resize/reset)

  for (let i = 0; i < tileCount; i++) {
    groundTiles.push({
      id: i, // Simple ID, not currently used
      x: i * tileWidth, // Initial horizontal position
      width: tileWidth,
    });
  }
}

/**
 * Draws the main ground rectangle and the scrolling ground tiles/texture.
 */
function drawGround() {
  // Draw the solid ground base rectangle
  fill(COLORS.ground);
  rect(0, groundY, width, height - groundY); // From ground line to bottom

  // Draw and update the scrolling ground tile details
  stroke(COLORS.groundStroke);
  strokeWeight(1);
  let maxTileX = 0; // Track the rightmost tile position for efficient looping

  // Iterate backwards for potential optimization if removing tiles (though not currently done here)
  for (let i = groundTiles.length - 1; i >= 0; i--) {
    let tile = groundTiles[i];

    // Move tile based on game speed
    if (gameStarted && !gameOver) {
      tile.x -= gameSpeed;
    }

    // Draw the horizontal line segment representing the top edge of the ground tile
    line(tile.x, groundY, tile.x + tile.width, groundY);

    // Occasionally draw small vertical lines for texture (like grass tufts)
    if (random() > 0.85) {
      // Low probability check each frame per tile
      const grassHeight = random(2, 6);
      line(
        tile.x + random(tile.width),
        groundY, // Random X within the tile
        tile.x + random(tile.width),
        groundY - grassHeight
      ); // Random small height
    }

    // Update the rightmost position encountered so far in this frame
    if (tile.x > maxTileX) {
      maxTileX = tile.x;
    }

    // Loop tiles: If a tile moves fully off-screen to the left...
    if (tile.x < -tile.width) {
      // ...move it to the right end, just after the current rightmost tile.
      tile.x = maxTileX + tile.width;
      maxTileX = tile.x; // The newly moved tile is now the rightmost
    }
  }
  noStroke(); // Reset stroke setting
}

// =============================================================================
// --- Game Logic Update Functions ---
// =============================================================================

/**
 * Main update function called each frame when the game is running.
 * Orchestrates updates for player, objects, difficulty, etc.
 */
function updateGame() {
  // Update individual game elements
  player.update(); // Apply physics and handle state for the player
  handleObstacles(); // Update and remove off-screen obstacles
  handleJoists(); // Update and remove off-screen joists
  updateParticles(); // Update active particles and return dead ones to the pool

  // Spawn new elements based on difficulty
  spawnElements();

  // --- Difficulty Progression ---
  // Increase distance traveled based on current speed
  distance += gameSpeed / 10;
  // Update game speed logarithmically based on distance (gets faster, but slows down rate of increase)
  gameSpeed =
    INITIAL_GAME_SPEED +
    SPEED_LOG_BASE * Math.log10(1 + distance * SPEED_LOG_SCALE);

  // --- Variable Jump Height Check ---
  // If jump input is released (`isJumping` is false) while player is still moving up significantly,
  // apply damping to shorten the jump.
  if (!isJumping && player.vy < -JUMP_FORCE * 0.2) {
    // Check velocity threshold to avoid damping small upward moves
    player.handleJumpRelease();
  }
}

/**
 * Draws all active game elements (player, obstacles, joists, particles).
 */
function drawGameElements() {
  // Draw order matters for layering
  drawJoists(); // Draw joists first (behind player)
  player.draw(); // Draw the player
  drawObstacles(); // Draw obstacles (can appear in front or behind depending on spawn)
  drawParticles(); // Draw particles (usually on top)
}

// =============================================================================
// --- Player Object ---
// =============================================================================

/**
 * Creates and returns a new player object with initial properties and methods.
 */
function createPlayer() {
  return {
    // Initial position and physics properties
    x: width * 0.15, // Start position horizontally
    y: groundY - PLAYER_SIZE / 2, // Start position vertically, just above ground
    vy: 0, // Initial vertical velocity
    size: PLAYER_SIZE, // Player's visual size
    onGround: true, // Flag if player is currently touching the ground
    jumpAnimation: 0, // Counter for jump rotation animation

    /** Updates player physics (gravity, velocity, position) and state. */
    update: function () {
      // Apply gravity
      this.vy += GRAVITY;
      // Update vertical position based on velocity
      this.y += this.vy;

      // Check for ground collision
      if (this.y >= groundY - this.size / 2) {
        this.y = groundY - this.size / 2; // Snap position to ground
        this.vy = 0; // Stop vertical movement
        if (!this.onGround) {
          // Check if player *just* landed
          this.onGround = true; // Set state to grounded
          this.jumpAnimation = 0; // Reset jump animation counter
          // Consider adding landing particle effects here
        }
      } else {
        // Player is in the air
        this.onGround = false;
        this.jumpAnimation += 0.1; // Increment jump animation counter
      }
    },

    /** Draws the player character (Nucor logo) with animations and effects. */
    draw: function () {
      push(); // Isolate drawing transformations

      // Apply transformations (translation, rotation)
      translate(this.x, this.y);
      if (!this.onGround) {
        // Apply slight rotation during jump based on sine wave
        let angle = sin(this.jumpAnimation) * 0.2;
        rotate(angle);

        // Draw a dynamic shadow below the player when airborne
        // Shadow gets fainter and smaller the higher the player is
        let shadowDistFactor = constrain(
          map(this.y, groundY - this.size / 2, height * 0.2, 1, 0.3),
          0.3,
          1
        );
        fill(0, 0, 0, 50 * shadowDistFactor); // Fade alpha
        // Shadow position is relative to ground; ellipse size scales
        ellipse(
          0,
          groundY - this.y + 10,
          this.size * 0.5 * shadowDistFactor,
          this.size * 0.2 * shadowDistFactor
        );
      } else {
        // Draw a standard shadow when on the ground
        fill(0, 0, 0, 50);
        ellipse(0, groundY - this.y + 10, this.size * 0.5, this.size * 0.2);
      }

      // Draw the main player image (Nucor logo)
      imageMode(CENTER); // Draw image centered at the translated origin
      let imgSize = this.size * 1.1; // Scale image slightly larger than collision size
      image(nucorImg, 0, 0, imgSize, imgSize);

      // Add a visual glow effect when jumping (tinting a larger image)
      if (!this.onGround) {
        push(); // Isolate tint effect
        tint(
          COLORS.nucorLightGreen[0],
          COLORS.nucorLightGreen[1],
          COLORS.nucorLightGreen[2],
          100
        ); // Apply light green tint
        image(nucorImg, 0, 0, imgSize * 1.1, imgSize * 1.1); // Draw slightly larger tinted image behind
        pop(); // Restore previous drawing settings (remove tint)
      }

      pop(); // Restore original drawing state
    },

    /** Initiates the player jump if on the ground. */
    jump: function () {
      if (this.onGround) {
        this.vy = JUMP_FORCE; // Apply upward force
        this.onGround = false; // Player is no longer on the ground
        isJumping = true; // Set flag indicating jump input is active
        lastJumpTime = millis(); // Record jump time (for potential UI effects)
        // Sound effect removed
      }
    },

    /** Applies damping to shorten the jump when input is released early. */
    handleJumpRelease: function () {
      if (this.vy < 0) {
        // Only dampen if player is currently moving upwards
        this.vy *= VARIABLE_JUMP_DAMPING; // Reduce upward velocity
      }
      isJumping = false; // Reset jump input flag
    },

    /** Calculates and returns the player's collision bounding box. */
    getBounds: function () {
      // Using slightly tighter bounds than visual size for better gameplay feel
      let w = this.size * 0.6; // Effective collision width
      let h = this.size * 0.9; // Effective collision height
      return {
        left: this.x - w / 2,
        right: this.x + w / 2,
        top: this.y - h / 2,
        bottom: this.y + h / 2,
      };
    },
  };
}

// =============================================================================
// --- Obstacle Handling ---
// =============================================================================

/**
 * Updates all active obstacles and removes those that have moved off-screen.
 * Uses swap-pop method for efficient removal.
 */
function handleObstacles() {
  // Iterate backwards through the array for safe removal using swap-pop
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update(); // Update obstacle's position and state

    // Check if obstacle is off-screen to the left
    if (obstacles[i].isOffScreen()) {
      // Efficiently remove element: Swap with the last element, then pop.
      obstacles[i] = obstacles[obstacles.length - 1]; // Overwrite current with last
      obstacles.pop(); // Remove the (now duplicate) last element
    }
  }
}

/**
 * Draws all active obstacles.
 */
function drawObstacles() {
  for (let obs of obstacles) {
    obs.draw();
  }
}

/**
 * Creates a new obstacle object with random type, position, and potential movement.
 */
function createObstacle() {
  // Determine obstacle type (NewMill or Canam)
  let type = random() > 0.5 ? "NM" : "CA";
  let obsColor = type === "NM" ? COLORS.obstacleNM : COLORS.obstacleCA; // Assign color (used for tinting if enabled)
  let size = OBSTACLE_SIZE;
  let approxWidth = type === "NM" ? size * 1.1 : size * 1.0; // Estimated width based on image aspect ratio
  let obstacleImg = type === "NM" ? newMillImg : canamImg; // Select image based on type

  // Determine position type: 0 = ground (requires jump), 1 = flying (requires ducking/passing under)
  let positionType = random() > 0.3 ? 0 : 1; // 70% ground, 30% flying

  // Calculate initial Y position based on type
  let yPos; // This will be the obstacle's initial vertical center
  if (positionType === 0) {
    // Ground obstacle: position centered vertically at the ground line
    yPos = groundY - size / 2;
  } else {
    // Flying obstacle: position high enough for player to pass under
    yPos = groundY - player.size * 1.1 - size / 2; // Ensure clearance based on player size
    yPos = min(yPos, groundY - size * 1.5); // Clamp maximum height
  }

  // --- Decide if this obstacle should move vertically (based on distance/chance) ---
  let canMoveVertically = false;
  let verticalMoveOffset = 0; // Random phase offset for sine wave movement
  // Check if distance threshold is met and random chance passes
  if (
    distance > VERTICAL_MOVE_START_DISTANCE &&
    random() < VERTICAL_MOVE_CHANCE
  ) {
    canMoveVertically = true;
    verticalMoveOffset = random(TWO_PI); // Assign random starting point in oscillation cycle
  }

  // Return the newly created obstacle object
  return {
    // Core properties
    x: width + size, // Initial horizontal position (off-screen right)
    y: yPos, // Current vertical position
    initialY: yPos, // Store the original intended Y spawn position
    type: type, // 'NM' or 'CA'
    image: obstacleImg, // Reference to the p5 Image object
    color: obsColor, // Color (currently unused in draw if tint is off)
    size: size, // Base size
    width: approxWidth, // Estimated collision width
    positionType: positionType, // 0 (ground) or 1 (flying)
    rotation: 0, // Current rotation angle for wobble effect
    wobbleOffset: random(TWO_PI), // Random phase offset for wobble animation

    // Properties for vertical movement feature
    canMoveVertically: canMoveVertically, // Flag if this instance oscillates vertically
    verticalMoveOffset: verticalMoveOffset, // Random phase offset for vertical oscillation

    /** Updates obstacle position, rotation, and vertical oscillation. */
    update: function () {
      // Move horizontally based on game speed
      this.x -= gameSpeed;

      // --- Horizontal Wobble (Rotation) ---
      // Wobble speed and amount increase slightly with game speed
      let wobbleSpeed = 0.05 + (gameSpeed - INITIAL_GAME_SPEED) * 0.005;
      let wobbleAmount = 0.1 + (gameSpeed - INITIAL_GAME_SPEED) * 0.01;
      this.rotation =
        sin(frameCount * wobbleSpeed + this.wobbleOffset) * wobbleAmount;

      // --- Vertical Movement Logic ---
      if (this.canMoveVertically) {
        // --- Case 1: Obstacle oscillates vertically ---
        // Oscillation speed also increases slightly with game speed
        let dynamicMoveSpeed =
          VERTICAL_MOVE_SPEED + (gameSpeed - INITIAL_GAME_SPEED) * 0.001;
        // Calculate vertical offset using sine wave
        let offsetY =
          (sin(frameCount * dynamicMoveSpeed + this.verticalMoveOffset) *
            VERTICAL_MOVE_RANGE) /
          2;
        // Apply offset to the initial Y position
        this.y = this.initialY + offsetY;

        // Clamp Y position to prevent moving too far off-screen or below ground
        this.y = max(this.y, this.size / 2); // Prevent top edge going above screen top
        this.y = min(this.y, groundY - this.size / 2); // Prevent bottom edge going below ground
      } else if (this.positionType === 1) {
        // --- Case 2: Flying obstacle with subtle hover (and not oscillating) ---
        let hoverSpeed = 0.1 + (gameSpeed - INITIAL_GAME_SPEED) * 0.008;
        let hoverAmount = 0.5 + (gameSpeed - INITIAL_GAME_SPEED) * 0.1;
        // Apply hover offset based on initial Y position
        this.y =
          this.initialY +
          sin(frameCount * hoverSpeed + this.wobbleOffset + PI / 2) *
            hoverAmount; // Use different phase from wobble
      } else {
        // --- Case 3: Ground obstacle (not oscillating) ---
        // Stick to the initial ground position
        this.y = this.initialY;
      }
    },

    /** Draws the obstacle image with transformations and shadow. */
    draw: function () {
      push(); // Isolate transformations
      translate(this.x, this.y);
      rotate(this.rotation);

      // Draw shadow, dynamically adjusting alpha and size based on height from ground
      let shadowDistFactor = constrain(
        map(this.y, groundY - this.size / 2, height * 0.2, 1, 0.1),
        0.1,
        1
      );
      fill(0, 0, 0, 40 * shadowDistFactor); // Fade shadow alpha
      // Shadow position relative to ground; size scales with distance factor
      ellipse(
        0,
        groundY - this.y + 10,
        this.width * 0.9 * shadowDistFactor,
        10 * shadowDistFactor
      );

      // Draw the obstacle image
      imageMode(CENTER);
      // Tinting was optional, currently disabled for potential performance gain
      // tint(this.color);
      image(this.image, 0, 0, this.size * 1.2, this.size); // Scale image slightly for visuals
      // noTint();
      pop(); // Restore previous drawing state
    },

    /** Checks if the obstacle is completely off-screen to the left. */
    isOffScreen: function () {
      // Use a generous boundary check
      return this.x < -this.size * 2;
    },

    /** Calculates and returns the obstacle's collision bounding box. */
    getBounds: function () {
      // Use current 'this.y' which includes any vertical movement
      // Use slightly tighter bounds than visual size for better gameplay feel
      return {
        left: this.x - (this.width / 2) * 0.9,
        right: this.x + (this.width / 2) * 0.9,
        top: this.y - (this.size / 2) * 0.9,
        bottom: this.y + (this.size / 2) * 0.9,
      };
    },
  };
}

// =============================================================================
// --- Joist Handling ---
// =============================================================================

/**
 * Updates all active joists and removes those that have moved off-screen.
 * Uses swap-pop method for efficient removal.
 */
function handleJoists() {
  // Iterate backwards through the array for safe removal using swap-pop
  for (let i = joists.length - 1; i >= 0; i--) {
    joists[i].update(); // Update joist position and animation state

    // Check if joist is off-screen to the left
    if (joists[i].isOffScreen()) {
      // Efficiently remove element: Swap with the last element, then pop.
      joists[i] = joists[joists.length - 1]; // Overwrite current with last
      joists.pop(); // Remove the (now duplicate) last element
    }
  }
}

/**
 * Draws all active joist objects.
 */
function drawJoists() {
  for (let joist of joists) {
    joist.draw();
  }
}

/**
 * Creates a new joist object (regular or golden).
 * @param {boolean} [forceGolden=false] - If true, guarantees the created joist is golden.
 */
function createJoist(forceGolden = false) {
  let w = JOIST_WIDTH;
  let h = JOIST_HEIGHT;

  // Determine spawn height: either near ground or higher up
  let spawnY = random() > 0.6 ? groundY - h * 1.5 : groundY - h * 3.5;
  spawnY = max(spawnY, h * 2); // Ensure it doesn't spawn too high off-screen

  // Determine if the joist is golden (rare, unless forced)
  let isGolden = forceGolden || random() < 0.15; // 15% chance if not forced

  return {
    // Core properties
    x: width + w, // Initial horizontal position (off-screen right)
    y: spawnY, // Current vertical position (includes hover)
    baseY: spawnY, // Store the initial spawn Y for hover calculation
    width: w,
    height: h,
    isGolden: isGolden, // Flag indicating if it's a high-value golden joist
    rotation: 0, // Current rotation angle
    hover: 0, // Current vertical offset from baseY due to hover animation
    animOffset: random(TWO_PI), // Random phase offset for hover/rotation animations

    /** Updates joist position and animation state. */
    update: function () {
      // Move horizontally based on game speed
      this.x -= gameSpeed;

      // --- Hover Animation ---
      // Hover speed increases slightly with game speed
      let hoverSpeed = 0.1 + (gameSpeed - INITIAL_GAME_SPEED) * 0.005;
      this.hover = sin(frameCount * hoverSpeed + this.animOffset) * 3; // Calculate hover offset

      // --- Rotation Animation ---
      // Rotation speed also increases slightly
      let rotSpeed = 0.03 + (gameSpeed - INITIAL_GAME_SPEED) * 0.002;
      this.rotation = sin(frameCount * rotSpeed + this.x * 0.01) * 0.05; // Subtle rotation based on time/position

      // Update the actual Y position based on the base height and hover offset
      this.y = this.baseY + this.hover;
    },

    /** Draws the joist with appropriate color and details. */
    draw: function () {
      push(); // Isolate transformations
      translate(this.x, this.y); // Move to joist's position (includes hover)
      rotate(this.rotation); // Apply rotation

      // --- Draw Shadow ---
      fill(0, 0, 0, 30); // Semi-transparent black
      // Shadow position is offset vertically to appear below the joist, compensating for hover
      ellipse(0, 15 - this.hover, this.width * 0.8, 10);

      // --- Draw Joist Structure ---
      // Set fill and stroke based on whether it's golden
      fill(this.isGolden ? COLORS.joistGold : COLORS.joist);
      stroke(this.isGolden ? COLORS.joistGold[0] - 50 : 80); // Darker stroke
      strokeWeight(2);

      // Define coordinates for drawing parts
      let topY = -this.height / 2;
      let bottomY = this.height / 2;
      let leftX = -this.width / 2;
      let rightX = this.width / 2;

      // Draw top and bottom chords (horizontal bars)
      rect(leftX, topY, this.width, 5);
      rect(leftX, bottomY - 5, this.width, 5);

      // Draw webbing (diagonal lines)
      let segments = 5; // Number of diagonal segments
      let segWidth = this.width / segments;
      for (let i = 0; i < segments; i++) {
        let x1 = leftX + segWidth * i;
        let x2 = leftX + segWidth * (i + 1);
        // Alternate diagonal direction
        if (i % 2 === 0) {
          line(x1, bottomY - 5, x2, topY + 5); // Down-right
        } else {
          line(x1, topY + 5, x2, bottomY - 5); // Up-right
        }
      }

      // Draw vertical end posts
      line(leftX + 1, topY + 5, leftX + 1, bottomY - 5);
      line(rightX - 1, topY + 5, rightX - 1, bottomY - 5);

      // --- Add Shine Effect for Golden Joists ---
      if (this.isGolden) {
        noStroke();
        fill(255, 255, 220, 150); // Semi-transparent pale yellow/white
        ellipse(0, 0, this.width * 0.6, this.height * 0.6); // Add a central glow
      }

      noStroke(); // Reset stroke for subsequent drawing
      pop(); // Restore previous drawing state
    },

    /** Checks if the joist is completely off-screen to the left. */
    isOffScreen: function () {
      return this.x < -this.width;
    },

    /** Calculates and returns the joist's collision bounding box. */
    getBounds: function () {
      // Uses the current 'this.y' which includes hover animation
      return {
        left: this.x - this.width / 2,
        right: this.x + this.width / 2,
        top: this.y - this.height / 2,
        bottom: this.y + this.height / 2,
      };
    },
  };
}

// =============================================================================
// --- Particle System ---
// =============================================================================

/**
 * Creates particle effects (e.g., for joist collection or collision).
 * Uses object pooling: Reuses particles from `particlePool` if available,
 * otherwise creates new ones. Adds the particle to `activeParticles`.
 * @param {number} x - The initial X position for the particles.
 * @param {number} y - The initial Y position for the particles.
 * @param {Array} color - The base RGB color array for the particles.
 */
function createCollectParticles(x, y, color) {
  for (let i = 0; i < COLLECT_PARTICLES; i++) {
    let p;
    // Check if there are inactive particles in the pool
    if (particlePool.length > 0) {
      p = particlePool.pop(); // Reuse particle from the pool
    } else {
      p = {}; // Create a new particle object if pool is empty
    }

    // Initialize or reset particle properties
    p.x = x; // Set position
    p.y = y;
    p.vx = random(-3, 3); // Random initial horizontal velocity
    p.vy = random(-5, 0); // Random initial upward velocity
    p.size = random(3, 8); // Random size
    p.color = [...color]; // Copy base color array
    p.color[3] = 255; // Set initial alpha to fully opaque
    p.life = PARTICLE_LIFETIME; // Set lifetime duration
    p.active = true; // Mark as active

    activeParticles.push(p); // Add to the list of particles to update and draw
  }
}

/**
 * Updates the state (position, velocity, lifetime, alpha) of all active particles.
 * Moves expired particles back to the `particlePool`.
 */
function updateParticles() {
  // Iterate backwards for safe removal (moving to pool) using swap-pop
  for (let i = activeParticles.length - 1; i >= 0; i--) {
    let p = activeParticles[i];

    // Apply simple physics (gravity)
    p.vy += 0.1; // Simulate particle gravity
    p.x += p.vx; // Update position based on velocity
    p.y += p.vy;

    // Decrease lifetime and update alpha for fade-out effect
    p.life--;
    p.color[3] = (p.life / PARTICLE_LIFETIME) * 255; // Linearly decrease alpha

    // Check if particle lifetime has expired
    if (p.life <= 0) {
      p.active = false; // Mark as inactive
      particlePool.push(p); // Return the particle object to the pool for reuse

      // Remove from active list using swap-pop
      activeParticles[i] = activeParticles[activeParticles.length - 1]; // Overwrite with last element
      activeParticles.pop(); // Remove last element
    }
  }
}

/**
 * Draws all currently active particles.
 */
function drawParticles() {
  noStroke();
  for (let p of activeParticles) {
    // Minor optimization: Only draw if particle is somewhat visible
    if (p.color[3] > 5) {
      // Set fill color using RGBA values from particle's color array
      fill(p.color[0], p.color[1], p.color[2], p.color[3]);
      ellipse(p.x, p.y, p.size); // Draw particle as a small ellipse
    }
  }
}

// =============================================================================
// --- Spawning & Collision ---
// =============================================================================

/**
 * Determines when to spawn new obstacles and joists based on logarithmic difficulty.
 */
function spawnElements() {
  // Calculate the reduction factor for spawn rates based on distance (logarithmic)
  // Higher distance = larger reduction = shorter spawn interval
  let rateReduction =
    SPAWN_RATE_LOG_BASE * Math.log10(1 + distance * SPAWN_RATE_LOG_SCALE);

  // --- Obstacle Spawning ---
  // Calculate current spawn interval, ensuring it doesn't go below the minimum
  let obstacleSpawnRate = floor(
    max(MIN_OBSTACLE_SPAWN_RATE, BASE_OBSTACLE_SPAWN_RATE - rateReduction)
  );
  // Spawn an obstacle if frameCount is a multiple of the calculated rate
  if (frameCount % obstacleSpawnRate === 0) {
    obstacles.push(createObstacle());
  }

  // --- Joist Spawning ---
  // Calculate current spawn interval for joists
  let joistSpawnRate = floor(
    max(MIN_JOIST_SPAWN_RATE, BASE_JOIST_SPAWN_RATE - rateReduction)
  );
  // Spawn a regular joist based on rate and a random chance
  if (frameCount % joistSpawnRate === 0 && random() > 0.3) {
    // Add randomness to joist spawns
    joists.push(createJoist());
  }

  // --- Golden Joist Spawning ---
  // Spawn golden joists much less frequently, tied to the regular joist rate
  let goldenJoistSpawnRate = joistSpawnRate * 5; // e.g., 5 times less frequent than regular joists
  if (frameCount % goldenJoistSpawnRate === 0 && random() > 0.6) {
    // Additional random chance
    joists.push(createJoist(true)); // Force creation of a golden joist
  }
}

/**
 * Checks for collisions between the player and obstacles/joists.
 * Handles game over state and score updates.
 */
function checkCollisions() {
  let playerBounds = player.getBounds(); // Get player's current collision box

  // --- Player vs Obstacles ---
  // Iterate through all active obstacles
  for (let obs of obstacles) {
    // No need for backward loop if not removing here
    let obsBounds = obs.getBounds(); // Get obstacle's collision box
    // Check for overlap between player and obstacle bounds
    if (rectOverlap(playerBounds, obsBounds)) {
      gameOver = true; // Set game over state

      // --- Create Collision Particle Effect ---
      // Spawn explosion particles using the pooling system
      for (let i = 0; i < 30; i++) {
        let p;
        if (particlePool.length > 0) {
          p = particlePool.pop();
        } else {
          p = {};
        } // Get from pool or create new
        // Initialize particle properties for explosion effect
        p.x = player.x;
        p.y = player.y;
        p.vx = random(-5, 5); // Random velocity outwards
        p.vy = random(-8, 2);
        p.size = random(5, 15);
        p.color = [...COLORS.nucorGreen, 255]; // Use player color
        p.life = PARTICLE_LIFETIME * 1.5; // Longer lifetime for explosion
        p.active = true;
        activeParticles.push(p); // Add to active particles
      }

      // --- High Score Check & Save ---
      if (score > highScore) {
        highScore = score; // Update high score in memory
        try {
          // Attempt to save the new high score to localStorage
          localStorage.setItem("nucorGameHighScore", highScore);
        } catch (e) {
          console.warn("Could not save high score to localStorage:", e);
        }
      }

      return; // Exit collision check early since game is over
    }
  }

  // --- Player vs Joists ---
  // Iterate backwards through joists for safe removal upon collection
  for (let i = joists.length - 1; i >= 0; i--) {
    let joist = joists[i];
    let joistBounds = joist.getBounds(); // Get joist's collision box

    // Check for overlap between player and joist bounds
    if (rectOverlap(playerBounds, joistBounds)) {
      // --- Score Update & Particle Effect ---
      if (joist.isGolden) {
        score += 5; // More points for golden joists
        createCollectParticles(joist.x, joist.y, COLORS.joistGold); // Golden particle effect
      } else {
        score += 1; // Standard points for regular joists
        createCollectParticles(joist.x, joist.y, COLORS.joistHighlight); // Regular particle effect
      }

      // --- Remove Collected Joist ---
      // Use swap-pop for efficient removal
      joists[i] = joists[joists.length - 1]; // Overwrite collected joist with the last one
      joists.pop(); // Remove the last element

      // Do not return early; player might collect multiple joists in one frame
    }
  }
}

/**
 * Helper function to check if two rectangles overlap.
 * @param {object} rect1 - Bounding box object { left, right, top, bottom }.
 * @param {object} rect2 - Bounding box object { left, right, top, bottom }.
 * @returns {boolean} True if the rectangles overlap, false otherwise.
 */
function rectOverlap(rect1, rect2) {
  return (
    rect1.left < rect2.right &&
    rect1.right > rect2.left &&
    rect1.top < rect2.bottom &&
    rect1.bottom > rect2.top
  );
}

// =============================================================================
// --- UI & Screen Drawing ---
// =============================================================================

/**
 * Draws the main gameplay UI overlay (score, distance, high score).
 */
function drawUI() {
  // --- Draw Background Panel ---
  fill(COLORS.uiBackground); // Semi-transparent black background
  rect(0, 0, width, 50); // Panel at the top of the screen

  // --- Draw Text Elements ---
  fill(COLORS.uiText); // White text color
  textSize(24);

  // Score (Left-aligned)
  textAlign(LEFT, CENTER);
  text(`Joists: ${score}`, 20, 25);

  // High Score (Right-aligned)
  textAlign(RIGHT, CENTER);
  text(`Best: ${highScore}`, width - 20, 25);

  // Distance (Center-aligned)
  textAlign(CENTER, CENTER);
  text(`Distance: ${floor(distance)}m`, width / 2, 25);

  // Jump indicator effect was removed.
}

/**
 * Draws the initial start screen before the game begins.
 */
function drawStartScreen() {
  // --- Dark Overlay ---
  fill(0, 0, 0, 150); // Dark semi-transparent overlay
  rect(0, 0, width, height);

  // --- Game Title ---
  fill(COLORS.nucorGreen);
  textSize(min(64, width / 10)); // Responsive text size based on screen width
  textAlign(CENTER, CENTER);
  text("NUCOR RUNNER", width / 2, height / 3);

  // --- Nucor Logo ---
  imageMode(CENTER);
  image(nucorImg, width / 2, height / 2, 120, 120); // Display player logo

  // --- Instructions ---
  fill(255); // White text
  textSize(min(24, width / 25)); // Responsive text size
  text("Tap/SPACE to Jump (Hold for Higher)", width / 2, height * 0.65);
  text("Collect Joists, Avoid Obstacles", width / 2, height * 0.7);

  // --- Start Prompt (Blinking) ---
  textSize(min(32, width / 18)); // Responsive text size
  fill(255);
  // Blinking effect by drawing text only half the time
  if (frameCount % 60 < 30) {
    text("TAP / SPACE TO START", width / 2, height * 0.8);
  }
}

/**
 * Draws the game over screen after a collision.
 */
function drawGameOverScreen() {
  // --- Dark Overlay ---
  fill(COLORS.uiBackground); // Dark semi-transparent overlay
  rect(0, 0, width, height);

  // --- "GAME OVER" Text ---
  fill(COLORS.uiText);
  textSize(min(64, width / 10)); // Responsive text size
  textAlign(CENTER, CENTER);
  text("GAME OVER", width / 2, height / 3);

  // --- Final Scores ---
  textSize(min(32, width / 18)); // Responsive text size
  text(`Joists Collected: ${score}`, width / 2, height / 2 - 30);
  text(`Distance: ${floor(distance)}m`, width / 2, height / 2 + 10);

  // --- High Score Display ---
  // Check if a new high score was achieved (and score is > 0)
  if (score >= highScore && score > 0) {
    fill(COLORS.nucorGreen); // Highlight new high score in green
    textSize(min(40, width / 15)); // Larger text size for emphasis
    text("NEW HIGH SCORE!", width / 2, height / 2 + 60);
  } else {
    // Display the existing high score normally
    fill(COLORS.uiText);
    textSize(min(24, width / 25)); // Standard text size
    text(`Best: ${highScore}`, width / 2, height / 2 + 60); // Position consistently
  }

  // --- Restart Prompt (Blinking) ---
  fill(COLORS.uiText);
  textSize(min(24, width / 25)); // Responsive text size
  // Blinking effect
  if (frameCount % 60 < 30) {
    text("Tap or Press SPACE to Restart", width / 2, height * 0.75); // Position slightly lower
  }
}

// =============================================================================
// --- Input Handling ---
// =============================================================================

/**
 * Central handler for jump initiation inputs (press/touch start).
 */
function handleInputStart() {
  if (!gameStarted) {
    // --- First Input: Start the game ---
    gameStarted = true; // Set flag TO START THE GAME on the next frame
    // DO NOT call resetGame() here. Game variables were already set in setup().
  } else if (gameOver) {
    // --- Input on Game Over Screen: Restart ---
    resetGame(); // Reset game state for a new run
  } else {
    // --- Input During Gameplay: Jump ---
    player.jump(); // Trigger player jump
  }
}

/**
 * Central handler for jump release inputs (release/touch end).
 * Used for variable jump height.
 */
function handleInputEnd() {
  // If game is running and not over, handle jump release for variable height
  if (!gameOver && gameStarted) {
    player.handleJumpRelease();
  }
  // Always ensure isJumping flag is reset on release, regardless of game state
  isJumping = false;
}

// --- Keyboard Input ---
function keyPressed() {
  if (keyCode === 32) {
    // 32 is the keyCode for SPACEBAR
    handleInputStart();
  }
}

function keyReleased() {
  if (keyCode === 32) {
    // SPACEBAR
    handleInputEnd();
  }
}

// --- Mouse Input ---
function mousePressed() {
  handleInputStart();
  // Returning false can help prevent default browser actions (like text selection)
  return false;
}

function mouseReleased() {
  handleInputEnd();
  return false; // Prevent default actions
}

// --- Touch Input ---
function touchStarted() {
  handleInputStart();
  // Prevent default browser actions (like scrolling or zooming) on touch devices
  return false;
}

function touchEnded() {
  handleInputEnd();
  return false; // Prevent default actions
}

// =============================================================================
// --- Game State Management ---
// =============================================================================

/**
 * Resets all necessary game state variables to start a new game.
 */
function resetGame() {
  // Reset scores and counters
  score = 0;
  distance = 0;
  gameSpeed = INITIAL_GAME_SPEED; // Reset speed to initial value

  // Clear dynamic game object arrays
  obstacles = [];
  joists = [];
  activeParticles = []; // Clear active particles (particlePool retains inactive ones)

  // Recreate the player object
  player = createPlayer();

  // Reset game state flags (ONLY game over, not gameStarted)
  gameOver = false;
  // gameStarted = true; // <<< REMOVE THIS LINE >>>
  isJumping = false;  // Ensure jump state is reset

  // Reset p5's frameCount for consistent spawning at the beginning of a run
  frameCount = 0;

  // Optional: Reset background elements if needed
  // createClouds();
  // createMountains();
  // createGroundTiles();
}

/**
 * Handles window resize events to adjust canvas size and recalculate layout.
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight); // Adjust canvas dimensions
  groundY = height * GROUND_OFFSET; // Recalculate ground position

  // Recreate background elements to fit the new screen size properly
  createClouds();
  createMountains();
  createGroundTiles();

  // Adjust player position if necessary after resize
  if (player) {
    player.x = width * 0.15; // Re-center horizontally (relative position)
    // If resizing causes player to be below the new ground line, snap them back up
    if (player.y + player.size / 2 > groundY) {
      player.y = groundY - player.size / 2;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

// --- END OF FILE game.js ---
