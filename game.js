// --- Game Configuration ---
const COLORS = {
  nucorGreen: [0, 125, 65],
  nucorLightGreen: [40, 180, 100],
  obstacleNM: [255, 180, 0],
  obstacleCA: [30, 120, 220],
  joist: [180, 180, 180],
  joistHighlight: [220, 220, 220],
  joistGold: [255, 215, 0],
  ground: [80, 65, 45],
  groundStroke: [60, 45, 35],
  sky: [135, 206, 250],
  clouds: [255, 255, 255, 200],
  mountains: [110, 90, 70],
  text: [20, 20, 20],
  uiBackground: [0, 0, 0, 180],
  uiText: [255, 255, 255]
};

// Game elements
const PLAYER_SIZE = 60;
const OBSTACLE_SIZE = 55;
const JOIST_WIDTH = 70;
const JOIST_HEIGHT = 35;

// Physics constants
const GRAVITY = 0.6;
const JUMP_FORCE = -13;
const GROUND_OFFSET = 0.8; // Player stands on bottom 80% of the screen
const INITIAL_GAME_SPEED = 5;
const SPEED_INCREASE = 0.003; // Slightly slower increase for better progression

// Particles and effects
const COLLECT_PARTICLES = 15; // Number of particles when collecting a joist
const PARTICLE_LIFETIME = 40; // Frames that particles live

// --- Game State Variables ---
let player;
let obstacles = [];
let joists = [];
let particles = [];
let clouds = [];
let mountains = [];
let groundTiles = [];
let score = 0;
let highScore = 0;
let distance = 0;
let gameOver = false;
let gameStarted = false;
let gameSpeed = INITIAL_GAME_SPEED;
let groundY;
let lastJumpTime = 0;

// --- Image Assets ---
let nucorImg, newMillImg, canamImg;

// --- Sound Effects (commented out, add if desired) ---
// let jumpSound, collectSound, crashSound;

// --- Preload assets ---
function preload() {
  // Load images
  nucorImg = loadImage('assets/nucor.png');
  newMillImg = loadImage('assets/NewMill.png');
  canamImg = loadImage('assets/Canam.png');
  
  // Load sounds (commented out, add if desired)
  // jumpSound = loadSound('jump.mp3');
  // collectSound = loadSound('collect.mp3');
  // crashSound = loadSound('crash.mp3');
}

// --- p5.js Setup Function ---
function setup() {
  createCanvas(windowWidth, windowHeight);
  groundY = height * GROUND_OFFSET;
  resetGame();
  createClouds();
  createMountains();
  createGroundTiles();
  textAlign(CENTER, CENTER);
  textFont('Arial');
  noStroke();
  
  // Try to load high score from localStorage
  try {
    const savedHighScore = localStorage.getItem('nucorGameHighScore');
    if (savedHighScore) highScore = parseInt(savedHighScore);
  } catch (e) {
    console.log('Could not load high score from localStorage');
  }
}

// --- p5.js Draw Function (Game Loop) ---
function draw() {
  // Draw sky and background elements
  drawBackground();
  
  if (!gameStarted) {
    // --- GAME NOT STARTED YET ---
    drawStartScreen();
  } else if (!gameOver) {
    // --- GAME IS RUNNING ---
    // Update game state
    updateGame();
    
    // Draw game elements
    drawGameElements();
    
    // Check collisions
    checkCollisions();
    
    // Draw UI
    drawUI();
  } else {
    // --- GAME OVER ---
    drawGameElements(); // Still show game elements
    drawGameOverScreen();
  }
}

// --- Background Drawing ---
function drawBackground() {
  // Sky gradient
  background(COLORS.sky);
  
  // Draw mountains (parallax effect)
  drawMountains();
  
  // Draw clouds (parallax effect)
  drawClouds();
  
  // Ground
  drawGround();
}

// --- Cloud Generation and Drawing ---
function createClouds() {
  let cloudCount = floor(width / 300);
  for (let i = 0; i < cloudCount; i++) {
    clouds.push({
      x: random(width),
      y: random(height * 0.1, height * 0.4),
      width: random(80, 200),
      height: random(40, 80),
      speed: random(0.1, 0.3)
    });
  }
}

function drawClouds() {
  fill(COLORS.clouds);
  noStroke();
  
  for (let cloud of clouds) {
    // Move clouds
    if (gameStarted && !gameOver) {
      cloud.x -= cloud.speed * (gameSpeed / 5);
      
      // Loop clouds
      if (cloud.x < -cloud.width) {
        cloud.x = width + cloud.width;
        cloud.y = random(height * 0.1, height * 0.4);
      }
    }
    
    // Draw cloud (simple ellipses)
    ellipse(cloud.x, cloud.y, cloud.width, cloud.height);
    ellipse(cloud.x - cloud.width * 0.2, cloud.y - cloud.height * 0.1, cloud.width * 0.6, cloud.height * 0.7);
    ellipse(cloud.x + cloud.width * 0.2, cloud.y - cloud.height * 0.1, cloud.width * 0.7, cloud.height * 0.6);
  }
}

// --- Mountain Generation and Drawing ---
function createMountains() {
  let mountainCount = floor(width / 200) + 2;
  for (let i = 0; i < mountainCount; i++) {
    mountains.push({
      x: random(width),
      height: random(height * 0.2, height * 0.35),
      width: random(200, 400)
    });
  }
}

function drawMountains() {
  fill(COLORS.mountains);
  noStroke();
  
  for (let mountain of mountains) {
    // Move mountains (slower for parallax)
    if (gameStarted && !gameOver) {
      mountain.x -= gameSpeed * 0.2;
      
      // Loop mountains
      if (mountain.x < -mountain.width) {
        mountain.x = width + random(100, 200);
        mountain.height = random(height * 0.2, height * 0.35);
        mountain.width = random(200, 400);
      }
    }
    
    // Draw mountain (triangle)
    triangle(
      mountain.x, groundY,
      mountain.x + mountain.width/2, groundY - mountain.height,
      mountain.x + mountain.width, groundY
    );
    
    // Add snow cap
    fill(240, 240, 250);
    triangle(
      mountain.x + mountain.width/2 - mountain.width/10, groundY - mountain.height + mountain.height/5,
      mountain.x + mountain.width/2, groundY - mountain.height,
      mountain.x + mountain.width/2 + mountain.width/10, groundY - mountain.height + mountain.height/5
    );
    fill(COLORS.mountains); // Reset fill color
  }
}

// --- Ground Generation and Drawing ---
function createGroundTiles() {
  const tileWidth = 80;
  const tileCount = ceil(width / tileWidth) + 1;
  
  for (let i = 0; i < tileCount; i++) {
    groundTiles.push({
      x: i * tileWidth,
      width: tileWidth
    });
  }
}

function drawGround() {
  // Move ground tiles
  if (gameStarted && !gameOver) {
    for (let tile of groundTiles) {
      tile.x -= gameSpeed;
      
      // Loop tiles
      if (tile.x < -tile.width) {
        tile.x = groundTiles.length * tile.width - tile.width;
      }
    }
  }
  
  // Draw ground base
  fill(COLORS.ground);
  rect(0, groundY, width, height - groundY);
  
  // Draw ground details
  stroke(COLORS.groundStroke);
  strokeWeight(1);
  for (let tile of groundTiles) {
    line(tile.x, groundY, tile.x + tile.width, groundY);
    
    // Add some vertical lines for texture
    if (random() > 0.7) {
      const grassHeight = random(2, 6);
      line(tile.x + random(tile.width), groundY, 
           tile.x + random(tile.width), groundY - grassHeight);
    }
  }
  noStroke();
}

// --- Game State Updates ---
function updateGame() {
  // Update player
  player.update();
  
  // Update obstacles
  handleObstacles();
  
  // Update joists
  handleJoists();
  
  // Update particles
  updateParticles();
  
  // Spawn new elements
  spawnElements();
  
  // Increase difficulty
  gameSpeed += SPEED_INCREASE;
  
  // Increase distance
  distance += gameSpeed / 10;
}

// --- Draw Game Elements ---
function drawGameElements() {
  // Draw joists behind player
  drawJoists();
  
  // Draw player
  player.draw();
  
  // Draw obstacles
  drawObstacles();
  
  // Draw particles
  drawParticles();
}

// --- Player Object ---
function createPlayer() {
  return {
    x: width * 0.15,
    y: groundY - PLAYER_SIZE / 2,
    vy: 0,
    size: PLAYER_SIZE,
    onGround: true,
    jumpAnimation: 0,
    
    update: function() {
      this.vy += GRAVITY;
      this.y += this.vy;
      
      // Ground collision
      if (this.y >= groundY - this.size / 2) {
        this.y = groundY - this.size / 2;
        this.vy = 0;
        this.onGround = true;
        this.jumpAnimation = 0;
      } else {
        this.onGround = false;
        this.jumpAnimation += 0.1;
      }
    },
    
    draw: function() {
      push();
      
      // Jump animation and rotation
      translate(this.x, this.y);
      if (!this.onGround) {
        let angle = sin(this.jumpAnimation) * 0.2;
        rotate(angle);
        
        // Shadow
        fill(0, 0, 0, 50);
        ellipse(0, groundY - this.y + 10, this.size * 0.5, this.size * 0.2);
      }
      
      // Draw Nucor logo
      imageMode(CENTER);
      let imgSize = this.size * 1.1; // Adjust based on the logo proportions
      image(nucorImg, 0, 0, imgSize, imgSize);
      
      // Visual enhancement: add glow when jumping
      if (!this.onGround) {
        push();
        tint(COLORS.nucorLightGreen[0], COLORS.nucorLightGreen[1], COLORS.nucorLightGreen[2], 100);
        image(nucorImg, 0, 0, imgSize * 1.1, imgSize * 1.1);
        pop();
      }
      
      pop();
    },
    
    jump: function() {
      if (this.onGround) {
        this.vy = JUMP_FORCE;
        this.onGround = false;
        lastJumpTime = millis();
        
        // Play sound
        // if (jumpSound) jumpSound.play();
      }
    },
    
    // Bounding box for collision detection (approximated for 'N')
    getBounds: function() {
      return {
        left: this.x - this.size * 0.35,
        right: this.x + this.size * 0.35,
        top: this.y - this.size * 0.5,
        bottom: this.y + this.size * 0.5
      };
    }
  };
}

// --- Obstacle Handling ---
function handleObstacles() {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].update();
    
    // Remove if off-screen
    if (obstacles[i].isOffScreen()) {
      obstacles.splice(i, 1);
    }
  }
}

function drawObstacles() {
  for (let obs of obstacles) {
    obs.draw();
  }
}

// --- Joist Handling ---
function handleJoists() {
  for (let i = joists.length - 1; i >= 0; i--) {
    joists[i].update();
    
    // Remove if off-screen
    if (joists[i].isOffScreen()) {
      joists.splice(i, 1);
    }
  }
}

function drawJoists() {
  for (let joist of joists) {
    joist.draw();
  }
}

// --- Particle System ---
function createCollectParticles(x, y, color) {
  for (let i = 0; i < COLLECT_PARTICLES; i++) {
    particles.push({
      x: x,
      y: y,
      vx: random(-3, 3),
      vy: random(-5, 0),
      size: random(3, 8),
      color: [...color, 255], // Copy color array and add alpha
      life: PARTICLE_LIFETIME
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    // Apply physics
    particles[i].vy += 0.1; // Particle gravity
    particles[i].x += particles[i].vx;
    particles[i].y += particles[i].vy;
    
    // Fade out
    particles[i].life--;
    particles[i].color[3] = (particles[i].life / PARTICLE_LIFETIME) * 255;
    
    // Remove dead particles
    if (particles[i].life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawParticles() {
  noStroke();
  for (let p of particles) {
    fill(p.color);
    ellipse(p.x, p.y, p.size);
  }
}

// --- Spawn New Elements ---
function spawnElements() {
  // Spawn obstacles (adjust for frequency)
  let obstacleSpawnRate = floor(map(gameSpeed, INITIAL_GAME_SPEED, 20, 100, 50));
  obstacleSpawnRate = max(obstacleSpawnRate, 50); // Minimum spawn delay
  
  if (frameCount % obstacleSpawnRate === 0) {
    obstacles.push(createObstacle());
  }
  
  // Spawn joists (adjust for frequency)
  let joistSpawnRate = floor(map(gameSpeed, INITIAL_GAME_SPEED, 20, 140, 80));
  joistSpawnRate = max(joistSpawnRate, 70); // Minimum spawn delay
  
  if (frameCount % joistSpawnRate === 0 && random() > 0.3) {
    joists.push(createJoist());
  }
  
  // Spawn golden joists (much less frequently)
  let goldenJoistSpawnRate = joistSpawnRate * 5; // 5 times less frequent
  if (frameCount % goldenJoistSpawnRate === 0 && random() > 0.6) {
    joists.push(createJoist(true)); // Force golden joist
  }
}

// --- Obstacle Object ---
function createObstacle() {
  let type = random() > 0.5 ? 'NM' : 'CA';
  let obsColor = type === 'NM' ? COLORS.obstacleNM : COLORS.obstacleCA;
  let size = OBSTACLE_SIZE;
  let approxWidth = type === 'NM' ? size * 1.1 : size * 1.0;
  let obstacleImg = type === 'NM' ? newMillImg : canamImg;
  
  // Determine position type: 0 = ground (jump over), 1 = flying (go under)
  let positionType = random() > 0.3 ? 0 : 1; // 70% ground, 30% flying
  
  let yPos;
  if (positionType === 0) {
    // Ground obstacle (need to jump over)
    yPos = groundY - size / 2;
  } else {
    // Flying obstacle (need to go under)
    yPos = groundY - size * 1.8; // Positioned higher so player can go under
  }
  
  return {
    x: width + size,
    y: yPos,
    type: type,
    image: obstacleImg,
    color: obsColor,
    size: size,
    width: approxWidth,
    positionType: positionType,
    rotation: 0,
    
    update: function() {
      this.x -= gameSpeed;
      // Slight wobble
      this.rotation = sin(frameCount * 0.05 + this.x * 0.01) * 0.1;
      
      // Add a slight hover effect for flying obstacles
      if (this.positionType === 1) {
        this.y += sin(frameCount * 0.1) * 0.5;
      }
    },
    
    draw: function() {
      push();
      translate(this.x, this.y);
      rotate(this.rotation);
      
      // Draw shadow (fainter for flying obstacles)
      let shadowAlpha = this.positionType === 0 ? 40 : 20;
      fill(0, 0, 0, shadowAlpha);
      ellipse(0, groundY - this.y + 10, this.width, 10);
      
      // Draw obstacle image
      imageMode(CENTER);
      tint(this.color); // Apply color tint to match original theme
      image(this.image, 0, 0, this.size * 1.2, this.size);
      noTint(); // Reset tint
      
      pop();
    },
    
    isOffScreen: function() {
      return this.x < -this.size * 2;
    },
    
    // Bounding box for collision detection
    getBounds: function() {
      return {
        left: this.x - this.width / 2,
        right: this.x + this.width / 2,
        top: this.y - this.size / 2,
        bottom: this.y + this.size / 2
      };
    }
  };
}

// --- Joist Object ---
function createJoist(forceGolden = false) {
  let w = JOIST_WIDTH;
  let h = JOIST_HEIGHT;
  // Spawn slightly above ground or higher up
  let spawnY = random() > 0.6 ? groundY - h * 1.5 : groundY - h * 3.5;
  spawnY = max(spawnY, h * 2); // Don't spawn too high off screen top
  
  // Determine if this joist is golden (rare)
  let isGolden = forceGolden || random() < 0.15;
  
  return {
    x: width + w,
    y: spawnY,
    width: w,
    height: h,
    isGolden: isGolden,
    rotation: 0,
    hover: 0,
    
    update: function() {
      this.x -= gameSpeed;
      // Hover animation
      this.hover = sin(frameCount * 0.1) * 3;
      // Slight rotation based on position
      this.rotation = sin(frameCount * 0.03 + this.x * 0.01) * 0.05;
    },
    
    draw: function() {
      push();
      translate(this.x, this.y + this.hover);
      rotate(this.rotation);
      
      // Draw shadow
      fill(0, 0, 0, 30);
      ellipse(0, 15, this.width * 0.8, 10);
      
      // Draw joist with gold or normal color
      fill(this.isGolden ? COLORS.joistGold : COLORS.joist);
      stroke(this.isGolden ? COLORS.joistGold[0] - 50 : 80);
      strokeWeight(2);
      
      let topY = -this.height / 2;
      let bottomY = this.height / 2;
      let leftX = -this.width / 2;
      let rightX = this.width / 2;
      
      // Top and bottom chords
      rect(leftX, topY, this.width, 5);
      rect(leftX, bottomY - 5, this.width, 5);
      
      // Webbing (diagonal pattern)
      let segments = 5;
      for (let i = 0; i < segments; i++) {
        let x1 = leftX + (this.width / segments) * i;
        let x2 = leftX + (this.width / segments) * (i + 1);
        if (i % 2 === 0) {
          line(x1, bottomY - 5, x2, topY + 5);
        } else {
          line(x1, topY + 5, x2, bottomY - 5);
        }
      }
      
      // Add vertical end posts
      line(leftX + 1, topY + 5, leftX + 1, bottomY - 5);
      line(rightX - 1, topY + 5, rightX - 1, bottomY - 5);
      
      // Add shine effect for golden joists
      if (this.isGolden) {
        noStroke();
        fill(255, 255, 220, 150);
        ellipse(0, 0, this.width * 0.6, this.height * 0.6);
      }
      
      noStroke();
      pop();
    },
    
    isOffScreen: function() {
      return this.x < -this.width;
    },
    
    // Bounding box for collision detection
    getBounds: function() {
      return {
        left: this.x - this.width / 2,
        right: this.x + this.width / 2,
        top: this.y - this.height / 2 + this.hover,
        bottom: this.y + this.height / 2 + this.hover
      };
    }
  };
}

// --- Collision Detection ---
function checkCollisions() {
  let playerBounds = player.getBounds();
  
  // Player vs Obstacles
  for (let obs of obstacles) {
    let obsBounds = obs.getBounds();
    if (rectOverlap(playerBounds, obsBounds)) {
      gameOver = true;
      
      // Create "explosion" particles
      for (let i = 0; i < 30; i++) {
        particles.push({
          x: player.x,
          y: player.y,
          vx: random(-5, 5),
          vy: random(-8, 2),
          size: random(5, 15),
          color: [...COLORS.nucorGreen, 255],
          life: PARTICLE_LIFETIME * 1.5
        });
      }
      
      // Play sound
      // if (crashSound) crashSound.play();
      
      // Save high score
      if (score > highScore) {
        highScore = score;
        try {
          localStorage.setItem('nucorGameHighScore', highScore);
        } catch (e) {
          console.log('Could not save high score to localStorage');
        }
      }
      
      return; // Exit early if collision detected
    }
  }
  
  // Player vs Joists
  for (let i = joists.length - 1; i >= 0; i--) {
    let joistBounds = joists[i].getBounds();
    if (rectOverlap(playerBounds, joistBounds)) {
      // Check if it's a golden joist (5 points) or regular joist (1 point)
      if (joists[i].isGolden) {
        score += 5;
        // Create gold collection particles
        createCollectParticles(joists[i].x, joists[i].y, COLORS.joistGold);
      } else {
        score += 1;
        // Create regular collection particles
        createCollectParticles(joists[i].x, joists[i].y, COLORS.joistHighlight);
      }
      
      // Remove collected joist
      joists.splice(i, 1);
      
      // Play sound
      // if (collectSound) collectSound.play();
    }
  }
}

// --- Rectangle Overlap Helper Function ---
function rectOverlap(rect1, rect2) {
  return rect1.left < rect2.right &&
         rect1.right > rect2.left &&
         rect1.top < rect2.bottom &&
         rect1.bottom > rect2.top;
}

// --- Draw UI Elements ---
function drawUI() {
  // Score panel at top
  fill(COLORS.uiBackground);
  rect(0, 0, width, 50);
  
  // Score
  fill(COLORS.uiText);
  textAlign(LEFT, CENTER);
  textSize(24);
  text(`Joists: ${score}`, 20, 25);
  
  // High score
  textAlign(RIGHT, CENTER);
  text(`Best: ${highScore}`, width - 20, 25);
  
  // Distance
  textAlign(CENTER, CENTER);
  text(`Distance: ${floor(distance)}m`, width / 2, 25);
  
  // Jump indicator (fades out)
  let jumpIndicatorAlpha = map(millis() - lastJumpTime, 0, 1000, 255, 0);
  if (jumpIndicatorAlpha > 0) {
    fill(COLORS.uiText[0], COLORS.uiText[1], COLORS.uiText[2], jumpIndicatorAlpha);
    textSize(20);
    text("JUMP!", width / 2, height / 2 - 100);
  }
}

// --- Draw Start Screen ---
function drawStartScreen() {
  // Draw a semi-transparent overlay
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Game title
  fill(COLORS.nucorGreen);
  textSize(64);
  textAlign(CENTER, CENTER);
  text("NUCOR RUNNER", width / 2, height / 3);
  
  // Nucor logo
  imageMode(CENTER);
  image(nucorImg, width / 2, height / 2, 120, 120);
  
  // Instructions
  fill(255);
  textSize(24);
  text("Press SPACE to Jump", width / 2, height * 0.65);
  text("Collect Joists and Avoid Obstacles", width / 2, height * 0.7);
  
  // Start prompt
  textSize(32);
  fill(255);
  if (frameCount % 60 < 30) { // Blinking effect
    text("PRESS SPACE TO START", width / 2, height * 0.8);
  }
}

// --- Draw Game Over Screen ---
function drawGameOverScreen() {
  // Semi-transparent overlay
  fill(COLORS.uiBackground);
  rect(0, 0, width, height);
  
  // Game over text
  fill(COLORS.uiText);
  textSize(64);
  textAlign(CENTER, CENTER);
  text("GAME OVER", width / 2, height / 3);
  
  // Final score
  textSize(32);
  text(`Joists Collected: ${score}`, width / 2, height / 2 - 30);
  text(`Distance: ${floor(distance)}m`, width / 2, height / 2 + 10);
  
  // High score
  if (score >= highScore) {
    fill(COLORS.nucorGreen);
    textSize(40);
    text("NEW HIGH SCORE!", width / 2, height / 2 + 60);
  } else {
    fill(COLORS.uiText);
    textSize(24);
    text(`High Score: ${highScore}`, width / 2, height / 2 + 50);
  }
  
  // Restart instructions
  fill(COLORS.uiText);
  textSize(24);
  if (frameCount % 60 < 30) { // Blinking effect
    text("Click or Press SPACE to Restart", width / 2, height * 0.7);
  }
}

// --- Input Handling ---
function keyPressed() {
  if (keyCode === 32) { // SPACEBAR
    if (!gameStarted) {
      gameStarted = true;
    } else if (gameOver) {
      resetGame();
    } else {
      player.jump();
    }
  }
}

function mousePressed() {
  if (!gameStarted) {
    gameStarted = true;
  } else if (gameOver) {
    resetGame();
  } else {
    player.jump();
  }
}

// --- Reset Game State ---
function resetGame() {
  score = 0;
  distance = 0;
  gameSpeed = INITIAL_GAME_SPEED;
  obstacles = [];
  joists = [];
  particles = [];
  player = createPlayer();
  gameOver = false;
  frameCount = 0;
}

// Ensure canvas resizes with window
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  groundY = height * GROUND_OFFSET;
  
  // Recreate background elements
  clouds = [];
  mountains = [];
  groundTiles = [];
  createClouds();
  createMountains();
  createGroundTiles();
  
  // Re-center player
  if (!gameOver && player) {
    player.x = width * 0.15;
    if (player.y > groundY - player.size / 2) {
      player.y = groundY - player.size / 2;
    }
  }
}