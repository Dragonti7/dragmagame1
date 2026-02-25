// ============================================================
//  🐱 Cat City Jump - Main Game Engine
// ============================================================

(() => {
    'use strict';

    // ---- Constants ----
    const CANVAS_W = 400;
    const CANVAS_H = 700;
    const GRAVITY = 0.45;
    const JUMP_FORCE = -12;
    const SUPER_JUMP_FORCE = -18;
    const PLAYER_W = 36;
    const PLAYER_H = 36;
    const MAX_VX = 7;
    const FRICTION = 0.88;

    // ---- Floor (Level) Definitions ----
    const FLOORS = [
        //                                                     gap  platW  moving  trap  obst   item                     wind   windP  zoom  zoomF  delay
        { name: '1F 골목길', scoreMin: 0, gapY: 50, platW: 80, movingRate: 0, trapRate: 0, obstacleRate: 0, itemRate: 0.12, bgPhase: 'sunset', windForce: 0, windParticles: 0, camZoom: 0, camZoomFreq: 0, camDelay: 0 },
        { name: '2F 주택가', scoreMin: 1000, gapY: 58, platW: 74, movingRate: 0.08, trapRate: 0, obstacleRate: 0.03, itemRate: 0.11, bgPhase: 'sunset', windForce: 0, windParticles: 0, camZoom: 0, camZoomFreq: 0, camDelay: 0 },
        { name: '3F 도심', scoreMin: 3000, gapY: 66, platW: 68, movingRate: 0.14, trapRate: 0, obstacleRate: 0.06, itemRate: 0.10, bgPhase: 'dusk', windForce: 0.10, windParticles: 3, camZoom: 0, camZoomFreq: 0, camDelay: 0 },
        { name: '4F 마천루', scoreMin: 6000, gapY: 82, platW: 58, movingRate: 0.25, trapRate: 0.08, obstacleRate: 0.10, itemRate: 0.09, bgPhase: 'night', windForce: 0.22, windParticles: 6, camZoom: 0.12, camZoomFreq: 0.25, camDelay: 0 },
        { name: '5F 하늘 위', scoreMin: 10000, gapY: 100, platW: 50, movingRate: 0.35, trapRate: 0.15, obstacleRate: 0.14, itemRate: 0.08, bgPhase: 'dawn', windForce: 0.35, windParticles: 10, camZoom: 0.20, camZoomFreq: 0.4, camDelay: 0.15 },
    ];

    // ---- Background Color Palettes ----
    const BG_PALETTES = {
        sunset: { top: '#e84393', mid: '#c44569', bot: '#2d1b69', skyGlow: 'rgba(232,67,147,0.12)' },
        dusk: { top: '#4a2c7a', mid: '#1e1145', bot: '#0d0b2e', skyGlow: 'rgba(100,50,200,0.1)' },
        night: { top: '#0b0c2a', mid: '#0f1035', bot: '#060714', skyGlow: 'rgba(0,180,255,0.06)' },
        dawn: { top: '#1a0a3e', mid: '#0d0b2e', bot: '#020112', skyGlow: 'rgba(80,0,180,0.08)' },
    };

    // ---- Item Types ----
    const ITEM_TYPES = [
        { type: 'tuna', emoji: '🐟', effect: 'score', value: 100, duration: 0 },
        { type: 'rocket', emoji: '🚀', effect: 'rocket', value: 0, duration: 2500 },
        { type: 'balloon', emoji: '🎈', effect: 'balloon', value: 0, duration: 3500 },
        { type: 'star', emoji: '⭐', effect: 'x2', value: 0, duration: 8000 },
        { type: 'box', emoji: '📦', effect: 'shield', value: 0, duration: 0 },
    ];

    // ---- Obstacle Types ----
    const OBSTACLE_TYPES = [
        { type: 'pigeon', emoji: '🐦', speed: 2, pattern: 'horizontal', size: 28 },
        { type: 'acwater', emoji: '💧', speed: 3, pattern: 'falling', size: 16 },
        { type: 'drone', emoji: '🐕', speed: 1.5, pattern: 'tracking', size: 30, minScore: 4000 },
    ];

    // ---- DOM ----
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // Screens
    const titleScreen = document.getElementById('title-screen');
    const hudScreen = document.getElementById('hud');
    const pauseScreen = document.getElementById('pause-screen');
    const gameoverScreen = document.getElementById('gameover-screen');
    const floorBanner = document.getElementById('floor-banner');
    const floorBannerText = document.getElementById('floor-banner-text');

    // HUD elements
    const hudScoreVal = document.getElementById('hud-score-value');
    const hudFloorName = document.getElementById('hud-floor-name');
    const titleHighScore = document.getElementById('title-high-score');
    const finalScore = document.getElementById('final-score');
    const finalHighScore = document.getElementById('final-high-score');
    const finalFloor = document.getElementById('final-floor');
    const newRecordEl = document.getElementById('new-record');

    // ---- Game State ----
    let state = 'title'; // title | playing | paused | gameover
    let score = 0;
    let highScore = parseInt(localStorage.getItem('catCityJump_highScore') || '0');
    let currentFloorIdx = 0;
    let cameraY = 0;
    let maxHeight = 0;
    let frameCount = 0;
    let scoreMultiplier = 1;
    let multiplierTimer = 0;
    let shieldActive = false;
    let rocketTimer = 0;
    let balloonTimer = 0;
    let floorBannerTimer = 0;
    let lastMilestoneScore = 0; // Track score milestones for pop effect
    let particles = [];
    let bgStars = [];
    let bgBuildings = [];
    let ambientObjects = []; // Decorative flying objects (birds, planes, etc.)

    // ---- Background Transition ----
    let bgTransition = {
        active: false,
        fromPalette: null,
        toPalette: null,
        progress: 0,      // 0 = fully old, 1 = fully new
        speed: 1 / 180,    // ~3 seconds at 60fps
    };

    // ---- Camera Effects ----
    let cam = {
        zoom: 1.0,                     // Current zoom level (1.0 = normal)
        targetZoom: 1.0,               // Zoom target for smooth lerp
        zoomActive: false,             // Whether zoom is currently active
        zoomCooldown: 0,               // Jumps remaining before zoom can trigger again
        jumpsSinceZoom: 0,             // Counter for zoom frequency
    };

    // ---- Wind System ----
    let wind = {
        dir: 0,                        // -1 left, 0 none, 1 right
        force: 0,                      // Current wind force applied
        timer: 0,                      // Time remaining for current wind/calm phase
        calmPhase: true,               // true = no wind, false = wind blowing
        particles: [],                 // Wind streak particles
        warningTimer: 0,               // Flash warning before direction change
    };

    // ---- Player ----
    let player = {
        x: CANVAS_W / 2 - PLAYER_W / 2,
        y: CANVAS_H - 120,
        w: PLAYER_W, h: PLAYER_H,
        vx: 0, vy: 0,
        grounded: false,
        facingRight: true,
        jumpCount: 0,
    };

    // ---- Platforms ----
    let platforms = [];
    let items = [];
    let obstacles = [];

    // ---- Input ----
    let keys = {};
    let touchLeft = false;
    let touchRight = false;
    let tiltX = 0;
    let controlMode = 'keyboard'; // keyboard | tilt | touch
    let isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    // ============================================================
    //  Initialization
    // ============================================================
    function init() {
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        scaleCanvas();
        generateBgStars();
        generateBgBuildings();
        titleHighScore.textContent = highScore.toLocaleString();
        setupInput();
        setupButtons();
        gameLoop();
    }

    function scaleCanvas() {
        const wrapper = document.getElementById('game-wrapper');
        const ww = wrapper.clientWidth;
        const wh = wrapper.clientHeight;
        const scaleX = ww / CANVAS_W;
        const scaleY = wh / CANVAS_H;
        const scale = Math.min(scaleX, scaleY, 1.5);
        canvas.style.width = (CANVAS_W * scale) + 'px';
        canvas.style.height = (CANVAS_H * scale) + 'px';
    }

    // ============================================================
    //  Background Generation
    // ============================================================
    function generateBgStars() {
        bgStars = [];
        for (let i = 0; i < 80; i++) {
            bgStars.push({
                x: Math.random() * CANVAS_W,
                y: Math.random() * 5000,
                size: Math.random() * 2 + 0.5,
                twinkle: Math.random() * Math.PI * 2,
                speed: Math.random() * 0.02 + 0.005,
            });
        }
    }

    function generateBgBuildings() {
        bgBuildings = [];
        // Generate several layers of background buildings
        for (let layer = 0; layer < 3; layer++) {
            const count = 8 + layer * 4;
            for (let i = 0; i < count; i++) {
                bgBuildings.push({
                    layer,
                    x: (i / count) * CANVAS_W + (Math.random() - 0.5) * 30,
                    w: 20 + Math.random() * 40 - layer * 5,
                    h: 60 + Math.random() * 120 + layer * 30,
                    hue: 200 + Math.random() * 40,
                    hasAntenna: Math.random() > 0.6,
                    windows: Math.floor(Math.random() * 6 + 2),
                });
            }
        }
    }

    // ============================================================
    //  Game Start / Reset
    // ============================================================
    function startGame() {
        score = 0;
        cameraY = 0;
        maxHeight = 0;
        currentFloorIdx = 0;
        frameCount = 0;
        scoreMultiplier = 1;
        multiplierTimer = 0;
        shieldActive = false;
        rocketTimer = 0;
        balloonTimer = 0;
        particles = [];
        lastMilestoneScore = 0;

        // Reset camera effects
        cam.zoom = 1.0; cam.targetZoom = 1.0;
        cam.zoomActive = false; cam.zoomCooldown = 0;
        cam.jumpsSinceZoom = 0;

        // Reset wind
        wind.dir = 0; wind.force = 0; wind.timer = 0;
        wind.calmPhase = true; wind.particles = [];
        wind.warningTimer = 0;

        ambientObjects = [];

        player.x = CANVAS_W / 2 - PLAYER_W / 2;
        player.y = CANVAS_H - 120;
        player.vx = 0;
        player.vy = 0;
        player.grounded = false;
        player.facingRight = true;

        platforms = [];
        items = [];
        obstacles = [];

        // Generate initial platforms
        generateInitialPlatforms();

        state = 'playing';
        showScreen('hud');
    }

    function generateInitialPlatforms() {
        // Starting platform (guaranteed safe)
        platforms.push(createPlatform(CANVAS_W / 2 - 45, CANVAS_H - 60, 90, 'normal'));

        let y = CANVAS_H - 60;
        const floor = FLOORS[0];
        for (let i = 0; i < 30; i++) {
            y -= floor.gapY + Math.random() * 20;
            const x = Math.random() * (CANVAS_W - floor.platW);
            platforms.push(createPlatform(x, y, floor.platW, 'normal'));
        }
    }

    function createPlatform(x, y, w, type, moveDir) {
        return {
            x, y, w, h: 14,
            type, // normal | breakable | neon | moving | trap
            moveDir: moveDir || (Math.random() > 0.5 ? 1 : -1),
            moveSpeed: 1 + Math.random() * 1.5,
            broken: false,
            breakAnim: 0,
            neonPhase: Math.random() * Math.PI * 2,
        };
    }

    // ============================================================
    //  Platform Generation (Endless)
    // ============================================================
    function generatePlatformsAbove() {
        const floor = FLOORS[currentFloorIdx];
        const topMost = platforms.reduce((min, p) => Math.min(min, p.y), Infinity);
        const generateTo = cameraY - CANVAS_H;

        let y = topMost;
        while (y > generateTo) {
            y -= floor.gapY + Math.random() * 25;
            const x = Math.random() * (CANVAS_W - floor.platW);
            let type = 'normal';
            const r = Math.random();

            if (r < floor.trapRate) {
                type = 'trap';
            } else if (r < floor.trapRate + floor.movingRate) {
                type = 'moving';
            } else if (r < floor.trapRate + floor.movingRate + 0.08) {
                type = 'neon';
            } else if (r < floor.trapRate + floor.movingRate + 0.15) {
                type = 'breakable';
            }

            const plat = createPlatform(x, y, floor.platW + (type === 'neon' ? 10 : 0), type);
            platforms.push(plat);

            // Items on platforms
            if (Math.random() < floor.itemRate && type !== 'trap') {
                const itemDef = pickWeightedItem();
                items.push({
                    x: x + floor.platW / 2 - 12,
                    y: y - 28,
                    w: 24, h: 24,
                    ...itemDef,
                    collected: false,
                    bobPhase: Math.random() * Math.PI * 2,
                });
            }

            // Obstacles
            if (Math.random() < floor.obstacleRate) {
                const obsDef = pickObstacle();
                if (obsDef) {
                    obstacles.push({
                        x: Math.random() * (CANVAS_W - 30),
                        y: y - 40 - Math.random() * 60,
                        ...obsDef,
                        startX: 0,
                        dir: Math.random() > 0.5 ? 1 : -1,
                        phase: Math.random() * Math.PI * 2,
                    });
                    obstacles[obstacles.length - 1].startX = obstacles[obstacles.length - 1].x;
                }
            }
        }
    }

    function pickWeightedItem() {
        const weights = [50, 10, 10, 8, 12]; // tuna heavy
        const total = weights.reduce((a, b) => a + b, 0);
        let r = Math.random() * total;
        for (let i = 0; i < ITEM_TYPES.length; i++) {
            r -= weights[i];
            if (r <= 0) return { ...ITEM_TYPES[i] };
        }
        return { ...ITEM_TYPES[0] };
    }

    function pickObstacle() {
        const available = OBSTACLE_TYPES.filter(o => !o.minScore || score >= o.minScore);
        if (available.length === 0) return null;
        return { ...available[Math.floor(Math.random() * available.length)] };
    }

    // ============================================================
    //  Input Setup
    // ============================================================
    function setupInput() {
        window.addEventListener('keydown', e => { keys[e.key] = true; });
        window.addEventListener('keyup', e => { keys[e.key] = false; });
        window.addEventListener('resize', scaleCanvas);

        // Touch controls
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Tilt controls
        if (isMobile && window.DeviceOrientationEvent) {
            if (typeof DeviceOrientationEvent.requestPermission === 'function') {
                // iOS 13+ needs permission
                controlMode = 'touch'; // Default to touch, switch when permission granted
            } else {
                window.addEventListener('deviceorientation', handleOrientation);
                controlMode = 'tilt';
            }
        } else if (isMobile) {
            controlMode = 'touch';
        }
    }

    function handleTouchStart(e) {
        e.preventDefault();
        for (const touch of e.touches) {
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const mid = rect.width / 2;
            if (tx < mid) touchLeft = true;
            else touchRight = true;
        }
    }

    function handleTouchMove(e) {
        e.preventDefault();
        touchLeft = false;
        touchRight = false;
        for (const touch of e.touches) {
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const mid = rect.width / 2;
            if (tx < mid) touchLeft = true;
            else touchRight = true;
        }
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        touchLeft = false;
        touchRight = false;
        for (const touch of e.touches) {
            const rect = canvas.getBoundingClientRect();
            const tx = touch.clientX - rect.left;
            const mid = rect.width / 2;
            if (tx < mid) touchLeft = true;
            else touchRight = true;
        }
    }

    function handleOrientation(e) {
        if (e.gamma !== null) {
            tiltX = e.gamma / 30; // Normalize: -1 to 1
            tiltX = Math.max(-1, Math.min(1, tiltX));
        }
    }

    async function requestMotionPermission() {
        if (typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const perm = await DeviceOrientationEvent.requestPermission();
                if (perm === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    controlMode = 'tilt';
                    return true;
                }
            } catch (e) { /* denied */ }
        }
        return false;
    }

    // ============================================================
    //  Button Setup
    // ============================================================
    function setupButtons() {
        document.getElementById('start-btn').addEventListener('click', () => {
            startGame();
        });
        document.getElementById('pause-btn').addEventListener('click', () => {
            state = 'paused';
            showScreen('pause');
        });
        document.getElementById('resume-btn').addEventListener('click', () => {
            state = 'playing';
            showScreen('hud');
        });
        document.getElementById('restart-btn-pause').addEventListener('click', () => {
            startGame();
        });
        document.getElementById('main-btn').addEventListener('click', () => {
            state = 'title';
            titleHighScore.textContent = highScore.toLocaleString();
            showScreen('title');
        });
        document.getElementById('retry-btn').addEventListener('click', () => {
            startGame();
        });
        document.getElementById('main-btn-go').addEventListener('click', () => {
            state = 'title';
            titleHighScore.textContent = highScore.toLocaleString();
            showScreen('title');
        });
    }

    function showScreen(name) {
        titleScreen.classList.remove('active');
        hudScreen.classList.remove('active');
        pauseScreen.classList.remove('active');
        gameoverScreen.classList.remove('active');
        pauseScreen.classList.add('hidden');
        gameoverScreen.classList.add('hidden');

        switch (name) {
            case 'title':
                titleScreen.classList.add('active');
                break;
            case 'hud':
                hudScreen.classList.add('active');
                pauseScreen.classList.add('hidden');
                gameoverScreen.classList.add('hidden');
                break;
            case 'pause':
                hudScreen.classList.add('active');
                pauseScreen.classList.add('active');
                pauseScreen.classList.remove('hidden');
                break;
            case 'gameover':
                hudScreen.classList.remove('active');
                gameoverScreen.classList.add('active');
                gameoverScreen.classList.remove('hidden');
                break;
        }
    }

    // ============================================================
    //  Game Loop
    // ============================================================
    function gameLoop() {
        update();
        render();
        requestAnimationFrame(gameLoop);
    }

    function update() {
        if (state !== 'playing') return;
        frameCount++;

        updatePlayer();
        updatePlatforms();
        updateItems();
        updateObstacles();
        updateParticles();
        updateCamera();
        updateCameraEffects();
        updateWind();
        updateAmbient();
        updateScore();
        updateFloor();
        updateTimers();

        // Generate more platforms
        generatePlatformsAbove();

        // Cleanup off-screen objects
        cleanup();
    }

    // ============================================================
    //  Player Update
    // ============================================================
    function updatePlayer() {
        // Input
        let inputX = 0;
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) inputX = -1;
        if (keys['ArrowRight'] || keys['d'] || keys['D']) inputX = 1;

        if (controlMode === 'touch' || (isMobile && controlMode !== 'tilt')) {
            if (touchLeft) inputX = -1;
            if (touchRight) inputX = 1;
        } else if (controlMode === 'tilt') {
            inputX = tiltX;
        }

        // Horizontal movement
        player.vx += inputX * 0.8;

        // Wind push (only when airborne)
        if (player.vy !== 0 && wind.dir !== 0 && !wind.calmPhase) {
            player.vx += wind.force * wind.dir;
        }

        player.vx *= FRICTION;
        if (Math.abs(player.vx) > MAX_VX) player.vx = MAX_VX * Math.sign(player.vx);
        if (Math.abs(player.vx) < 0.1) player.vx = 0;

        player.x += player.vx;
        if (player.vx > 0.3) player.facingRight = true;
        else if (player.vx < -0.3) player.facingRight = false;

        // Screen wrapping
        if (player.x + player.w < 0) player.x = CANVAS_W;
        if (player.x > CANVAS_W) player.x = -player.w;

        // Rocket / Balloon override
        if (rocketTimer > 0) {
            player.vy = -16;
            rocketTimer -= 16.67;
            if (frameCount % 3 === 0) {
                spawnParticle(player.x + player.w / 2, player.y + player.h, '#ff6b35', 'fire');
            }
        } else if (balloonTimer > 0) {
            player.vy = -4;
            balloonTimer -= 16.67;
        } else {
            // Gravity
            player.vy += GRAVITY;
        }

        player.y += player.vy;

        // Platform collision (only when falling)
        if (player.vy >= 0) {
            for (const p of platforms) {
                if (p.broken) continue;
                if (rectOverlap(
                    player.x + 4, player.y + player.h - 8, player.w - 8, 8,
                    p.x, p.y, p.w, p.h
                )) {
                    // Land on platform
                    if (p.type === 'trap') {
                        p.broken = true;
                        p.breakAnim = 1;
                        continue;
                    }
                    if (p.type === 'breakable') {
                        player.vy = JUMP_FORCE;
                        p.broken = true;
                        p.breakAnim = 1;
                        spawnParticle(p.x + p.w / 2, p.y, '#aaa', 'burst');
                    } else if (p.type === 'neon') {
                        player.vy = SUPER_JUMP_FORCE;
                        spawnParticle(p.x + p.w / 2, p.y, '#00d4ff', 'burst');
                        spawnParticle(p.x + p.w / 2, p.y, '#ff6bff', 'burst');
                    } else {
                        player.vy = JUMP_FORCE;
                    }
                    player.grounded = true;
                    player.jumpCount++;
                    triggerZoomOnJump();
                    break;
                }
            }
        }

        // Game over check (fell below camera)
        if (player.y > cameraY + CANVAS_H + 50) {
            gameOver();
        }
    }

    // ============================================================
    //  Platform Update
    // ============================================================
    function updatePlatforms() {
        for (const p of platforms) {
            if (p.type === 'moving' && !p.broken) {
                p.x += p.moveSpeed * p.moveDir;
                if (p.x <= 0 || p.x + p.w >= CANVAS_W) {
                    p.moveDir *= -1;
                }
            }
            if (p.breakAnim > 0) {
                p.breakAnim += 0.08;
            }
            if (p.type === 'neon') {
                p.neonPhase += 0.05;
            }
        }
    }

    // ============================================================
    //  Items Update
    // ============================================================
    function updateItems() {
        for (const item of items) {
            if (item.collected) continue;
            item.bobPhase += 0.06;

            if (rectOverlap(
                player.x, player.y, player.w, player.h,
                item.x, item.y + Math.sin(item.bobPhase) * 3, item.w, item.h
            )) {
                item.collected = true;
                applyItem(item);
                spawnParticle(item.x + item.w / 2, item.y, '#ffd700', 'burst');
            }
        }
    }

    function applyItem(item) {
        switch (item.effect) {
            case 'score':
                score += item.value * scoreMultiplier;
                break;
            case 'rocket':
                rocketTimer = item.duration;
                break;
            case 'balloon':
                balloonTimer = item.duration;
                break;
            case 'x2':
                scoreMultiplier = 2;
                multiplierTimer = item.duration;
                break;
            case 'shield':
                shieldActive = true;
                break;
        }
    }

    // ============================================================
    //  Obstacles Update
    // ============================================================
    function updateObstacles() {
        for (const obs of obstacles) {
            // Movement
            switch (obs.pattern) {
                case 'horizontal':
                    obs.x += obs.speed * obs.dir;
                    if (obs.x < -30) obs.x = CANVAS_W + 30;
                    if (obs.x > CANVAS_W + 30) obs.x = -30;
                    break;
                case 'falling':
                    obs.phase += 0.02;
                    obs.y += obs.speed;
                    break;
                case 'tracking':
                    const dx = player.x - obs.x;
                    obs.x += Math.sign(dx) * obs.speed;
                    obs.phase += 0.05;
                    obs.y += Math.sin(obs.phase) * 0.5;
                    break;
            }

            // Collision with player
            if (rocketTimer > 0) continue; // Invincible during rocket
            if (rectOverlap(
                player.x + 4, player.y + 4, player.w - 8, player.h - 8,
                obs.x, obs.y, obs.size, obs.size
            )) {
                if (shieldActive) {
                    shieldActive = false;
                    spawnParticle(player.x + player.w / 2, player.y, '#ffd700', 'burst');
                    obs.y = -9999; // Remove
                } else {
                    player.vy = 5; // Knock down
                    gameOver();
                }
            }
        }
    }

    // ============================================================
    //  Camera
    // ============================================================
    function updateCamera() {
        const floor = FLOORS[currentFloorIdx];
        const targetY = player.y - CANVAS_H * 0.4;

        // Camera delay: higher floors = camera follows more slowly
        const lerpSpeed = floor.camDelay > 0 ? 0.07 : 0.1;
        if (targetY < cameraY) {
            cameraY += (targetY - cameraY) * lerpSpeed;
        }
    }

    // ============================================================
    //  Camera Effects (Zoom, Delay)
    // ============================================================
    function updateCameraEffects() {
        const floor = FLOORS[currentFloorIdx];

        // --- Zoom lerp ---
        // Smooth transition towards target zoom
        const zoomLerpSpeed = 0.04; // ~0.3s at 60fps
        cam.zoom += (cam.targetZoom - cam.zoom) * zoomLerpSpeed;

        // If zoomed in and player is falling (past peak), zoom back out
        if (cam.zoomActive && player.vy > 0) {
            cam.targetZoom = 1.0;
            cam.zoomActive = false;
        }

        // Clamp zoom
        if (Math.abs(cam.zoom - 1.0) < 0.005) cam.zoom = 1.0;

        // --- Cooldown ---
        // Cooldown decrements per jump (handled in triggerZoomOnJump)
    }

    function triggerZoomOnJump() {
        const floor = FLOORS[currentFloorIdx];
        if (floor.camZoom <= 0) return; // No zoom on this floor

        cam.jumpsSinceZoom++;

        if (cam.zoomCooldown > 0) {
            cam.zoomCooldown--;
            return;
        }

        // Random chance based on frequency
        if (Math.random() < floor.camZoomFreq) {
            cam.targetZoom = 1.0 + floor.camZoom;
            cam.zoomActive = true;
            cam.zoomCooldown = 2; // Minimum 2 jumps before next zoom
            cam.jumpsSinceZoom = 0;
        }
    }

    function getNextPlatformHint() {
        // Find the nearest platform above the player
        let bestPlat = null;
        let bestDist = Infinity;
        for (const p of platforms) {
            if (p.broken) continue;
            const dist = player.y - p.y;
            if (dist > 0 && dist < bestDist) {
                bestDist = dist;
                bestPlat = p;
            }
        }
        return bestPlat;
    }

    // ============================================================
    //  Wind System
    // ============================================================
    function updateWind() {
        const floor = FLOORS[currentFloorIdx];
        if (floor.windForce <= 0) {
            wind.dir = 0;
            wind.force = 0;
            wind.particles = [];
            return;
        }

        wind.force = floor.windForce;

        // Timer countdown (in frames, ~60fps)
        wind.timer--;

        if (wind.timer <= 0) {
            if (wind.calmPhase) {
                // Start new wind phase
                wind.calmPhase = false;
                wind.dir = Math.random() > 0.5 ? 1 : -1;
                wind.timer = 300 + Math.random() * 180; // 5~8 seconds
                wind.warningTimer = 0;
            } else {
                // Enter calm phase
                wind.calmPhase = true;
                wind.dir = 0;
                wind.timer = 120 + Math.random() * 120; // 2~4 seconds
            }
        }

        // Warning blink before direction change (last 60 frames of wind)
        if (!wind.calmPhase && wind.timer < 60) {
            wind.warningTimer = wind.timer;
        }

        // Spawn wind particles
        if (!wind.calmPhase && wind.dir !== 0) {
            const density = floor.windParticles;
            for (let i = 0; i < density; i++) {
                if (Math.random() < 0.3) {
                    const startX = wind.dir > 0 ? -10 : CANVAS_W + 10;
                    wind.particles.push({
                        x: startX,
                        y: cameraY + Math.random() * CANVAS_H,
                        len: 15 + Math.random() * 30,
                        speed: 4 + Math.random() * 6 + floor.windForce * 8,
                        alpha: 0.08 + Math.random() * 0.15,
                        thickness: 0.5 + Math.random() * 1.5,
                    });
                }
            }
        }

        // Update wind particles
        for (let i = wind.particles.length - 1; i >= 0; i--) {
            const wp = wind.particles[i];
            wp.x += wp.speed * wind.dir;
            // Remove when off-screen
            if ((wind.dir > 0 && wp.x > CANVAS_W + 50) ||
                (wind.dir < 0 && wp.x < -50)) {
                wind.particles.splice(i, 1);
            }
        }

        // Cap particle count
        if (wind.particles.length > 150) {
            wind.particles.splice(0, wind.particles.length - 150);
        }
    }

    function drawWindParticles() {
        if (wind.particles.length === 0 && wind.dir === 0) return;

        // Draw wind streaks
        for (const wp of wind.particles) {
            const sy = wp.y - cameraY;
            if (sy < -20 || sy > CANVAS_H + 20) continue;

            ctx.save();
            ctx.globalAlpha = wp.alpha;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = wp.thickness;
            ctx.beginPath();
            ctx.moveTo(wp.x, sy);
            ctx.lineTo(wp.x - wp.len * wind.dir, sy);
            ctx.stroke();
            ctx.restore();
        }

        // Wind direction indicator (HUD-like, at top)
        if (!wind.calmPhase && wind.dir !== 0) {
            const indicatorAlpha = (wind.warningTimer > 0 && wind.warningTimer < 60)
                ? (Math.sin(frameCount * 0.3) * 0.3 + 0.3) // Blink warning
                : 0.5;

            ctx.save();
            ctx.globalAlpha = indicatorAlpha;
            ctx.fillStyle = '#aaddff';
            ctx.font = 'bold 16px Outfit, sans-serif';
            ctx.textAlign = 'center';

            const arrow = wind.dir > 0 ? '🌬️ →→→' : '←←← 🌬️';
            ctx.fillText(arrow, CANVAS_W / 2, 55);

            ctx.restore();
        }
    }

    // ============================================================
    //  Score & Floor
    // ============================================================
    function updateScore() {
        const height = Math.max(0, -player.y);
        if (height > maxHeight) {
            const diff = height - maxHeight;
            score += Math.floor(diff * 0.2 * scoreMultiplier);
            maxHeight = height;
        }
        hudScoreVal.textContent = score.toLocaleString();

        // Score pop every 500 points
        if (score - lastMilestoneScore >= 500) {
            lastMilestoneScore = Math.floor(score / 500) * 500;
            triggerScorePop();
        }
    }

    function triggerScorePop() {
        hudScoreVal.classList.remove('score-pop');
        // Force reflow to restart animation
        void hudScoreVal.offsetWidth;
        hudScoreVal.classList.add('score-pop');
        setTimeout(() => hudScoreVal.classList.remove('score-pop'), 400);
    }

    function triggerScoreMega() {
        const hudScoreBox = document.querySelector('.hud-score');
        hudScoreVal.classList.remove('score-pop', 'score-mega');
        void hudScoreVal.offsetWidth;
        hudScoreVal.classList.add('score-mega');
        hudScoreBox.classList.add('score-highlight');
        setTimeout(() => {
            hudScoreVal.classList.remove('score-mega');
            hudScoreBox.classList.remove('score-highlight');
        }, 2000);
    }

    function updateFloor() {
        let newFloor = 0;
        for (let i = FLOORS.length - 1; i >= 0; i--) {
            if (score >= FLOORS[i].scoreMin) {
                newFloor = i;
                break;
            }
        }
        if (newFloor !== currentFloorIdx) {
            // Start background transition
            const oldPhase = FLOORS[currentFloorIdx].bgPhase;
            const newPhase = FLOORS[newFloor].bgPhase;
            if (oldPhase !== newPhase) {
                bgTransition.active = true;
                bgTransition.fromPalette = BG_PALETTES[oldPhase];
                bgTransition.toPalette = BG_PALETTES[newPhase];
                bgTransition.progress = 0;
            }

            currentFloorIdx = newFloor;
            hudFloorName.textContent = FLOORS[currentFloorIdx].name;
            showFloorBanner(FLOORS[currentFloorIdx].name + ' 돌파!');
            triggerScoreMega(); // Big score celebration on floor change

            // Bonus zone: spawn extra tuna
            spawnBonusZone();
        }
    }

    function showFloorBanner(text) {
        floorBannerText.textContent = text;
        floorBanner.classList.remove('hidden');
        floorBannerTimer = 120; // ~2 seconds
    }

    function spawnBonusZone() {
        const baseY = platforms.reduce((min, p) => Math.min(min, p.y), Infinity) - 30;
        for (let i = 0; i < 6; i++) {
            const x = 40 + Math.random() * (CANVAS_W - 80);
            const y = baseY - i * 45;
            platforms.push(createPlatform(x, y, 80, 'normal'));
            items.push({
                x: x + 30,
                y: y - 28,
                w: 24, h: 24,
                ...ITEM_TYPES[0], // tuna
                collected: false,
                bobPhase: Math.random() * Math.PI * 2,
            });
        }
    }

    function updateTimers() {
        if (multiplierTimer > 0) {
            multiplierTimer -= 16.67;
            if (multiplierTimer <= 0) scoreMultiplier = 1;
        }
        if (floorBannerTimer > 0) {
            floorBannerTimer--;
            if (floorBannerTimer <= 0) {
                floorBanner.classList.add('hidden');
            }
        }
    }

    // ============================================================
    //  Ambient Background Objects (Canvas-drawn animated)
    // ============================================================
    const AMBIENT_TYPES = [
        { type: 'bird', minFloor: 0, maxFloor: 2, speed: [1.5, 3], yRange: [0.1, 0.5], depth: [0.4, 0.8] },
        { type: 'flock', minFloor: 0, maxFloor: 2, speed: [2, 3.5], yRange: [0.05, 0.35], depth: [0.3, 0.5] },
        { type: 'bag', minFloor: 2, maxFloor: 3, speed: [0.8, 2], yRange: [0.3, 0.7], depth: [0.5, 0.7] },
        { type: 'heli', minFloor: 3, maxFloor: 4, speed: [0.6, 1.5], yRange: [0.05, 0.25], depth: [0.6, 0.9] },
        { type: 'plane', minFloor: 3, maxFloor: 4, speed: [3, 5.5], yRange: [0.02, 0.15], depth: [0.3, 0.5] },
    ];

    function updateAmbient() {
        // Spawn new ambient objects
        if (frameCount % 120 === 0 || (frameCount % 60 === 0 && currentFloorIdx >= 2)) {
            const available = AMBIENT_TYPES.filter(a => currentFloorIdx >= a.minFloor && currentFloorIdx <= a.maxFloor);
            if (available.length > 0 && ambientObjects.length < 5) {
                const tmpl = available[Math.floor(Math.random() * available.length)];
                const goRight = Math.random() > 0.5;
                const depth = tmpl.depth[0] + Math.random() * (tmpl.depth[1] - tmpl.depth[0]);
                const yRatio = tmpl.yRange[0] + Math.random() * (tmpl.yRange[1] - tmpl.yRange[0]);

                const obj = {
                    type: tmpl.type,
                    x: goRight ? -50 : CANVAS_W + 50,
                    y: cameraY + CANVAS_H * yRatio,
                    baseSpeed: tmpl.speed[0] + Math.random() * (tmpl.speed[1] - tmpl.speed[0]),
                    dir: goRight ? 1 : -1,
                    depth,  // 0=far, 1=near → affects size & alpha
                    phase: Math.random() * Math.PI * 2, // Animation phase
                    phaseSpeed: 0.08 + Math.random() * 0.06,
                    wobbleY: Math.random() * Math.PI * 2,
                    speedWobble: Math.random() * Math.PI * 2,
                    trail: [], // For planes
                };

                // Flock: spawn sub-birds
                if (tmpl.type === 'flock') {
                    obj.birds = [];
                    const count = 3 + Math.floor(Math.random() * 4);
                    for (let i = 0; i < count; i++) {
                        obj.birds.push({
                            offX: (i % 2 === 0 ? -1 : 1) * (8 + i * 6 + Math.random() * 4),
                            offY: -Math.abs(i) * 5 - Math.random() * 4,
                            phaseOff: Math.random() * 1.5,
                        });
                    }
                }

                ambientObjects.push(obj);
            }
        }

        // Update each object
        for (let i = ambientObjects.length - 1; i >= 0; i--) {
            const obj = ambientObjects[i];

            // Speed variation (sine wave accel/decel)
            obj.speedWobble += 0.015;
            const speedMult = 1 + Math.sin(obj.speedWobble) * 0.2;
            obj.x += obj.baseSpeed * obj.dir * speedMult;

            // Vertical float
            obj.wobbleY += 0.02 + obj.depth * 0.01;
            obj.phase += obj.phaseSpeed;

            // Plane trail
            if (obj.type === 'plane' && frameCount % 3 === 0) {
                obj.trail.push({ x: obj.x - obj.dir * 10, y: obj.y, life: 1 });
            }
            // Update trail
            for (let t = obj.trail.length - 1; t >= 0; t--) {
                obj.trail[t].life -= 0.025;
                if (obj.trail[t].life <= 0) obj.trail.splice(t, 1);
            }

            // Remove off-screen
            if ((obj.dir > 0 && obj.x > CANVAS_W + 80) ||
                (obj.dir < 0 && obj.x < -80)) {
                ambientObjects.splice(i, 1);
            }
        }
    }

    function drawAmbient() {
        for (const obj of ambientObjects) {
            const sy = obj.y - cameraY + Math.sin(obj.wobbleY) * (3 + obj.depth * 4);
            if (sy < -60 || sy > CANVAS_H + 60) continue;

            const alpha = 0.15 + obj.depth * 0.2;
            const scale = 0.5 + obj.depth * 0.6;

            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(obj.x, sy);
            ctx.scale(scale * obj.dir, scale); // dir flips horizontally

            switch (obj.type) {
                case 'bird': drawBird(obj); break;
                case 'flock': drawFlock(obj); break;
                case 'bag': drawBag(obj); break;
                case 'heli': drawHeli(obj); break;
                case 'plane': drawPlane(obj, sy); break;
            }

            ctx.restore();
        }
    }

    function drawBird(obj) {
        const wingY = Math.sin(obj.phase) * 6;
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        // Left wing
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(-6, wingY - 4, -14, wingY);
        ctx.stroke();
        // Right wing
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(6, wingY - 4, 14, wingY);
        ctx.stroke();
        // Body dot
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    function drawFlock(obj) {
        // Leader bird
        drawBird(obj);
        // Follower birds
        if (obj.birds) {
            for (const b of obj.birds) {
                ctx.save();
                ctx.translate(b.offX, b.offY);
                const wingY = Math.sin(obj.phase + b.phaseOff) * 5;
                ctx.strokeStyle = '#1a1a2e';
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(-4, wingY - 3, -10, wingY);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(4, wingY - 3, 10, wingY);
                ctx.stroke();
                ctx.fillStyle = '#1a1a2e';
                ctx.beginPath();
                ctx.arc(0, 0, 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }
    }

    function drawBag(obj) {
        ctx.save();
        ctx.rotate(obj.phase * 0.7); // Tumbling rotation
        ctx.fillStyle = 'rgba(200, 200, 220, 0.6)';
        ctx.strokeStyle = 'rgba(150, 150, 170, 0.5)';
        ctx.lineWidth = 1;
        // Crinkled bag shape
        ctx.beginPath();
        ctx.moveTo(-6, -8);
        ctx.lineTo(6, -8);
        ctx.quadraticCurveTo(9, 0, 6, 8);
        ctx.quadraticCurveTo(0, 10 + Math.sin(obj.phase * 2) * 2, -6, 8);
        ctx.quadraticCurveTo(-9, 0, -6, -8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // Handle strings
        ctx.beginPath();
        ctx.moveTo(-3, -8);
        ctx.lineTo(-2, -12);
        ctx.moveTo(3, -8);
        ctx.lineTo(2, -12);
        ctx.stroke();
        ctx.restore();
    }

    function drawHeli(obj) {
        // Body
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail
        ctx.fillRect(10, -2, 12, 3);
        ctx.fillStyle = '#636e72';
        ctx.fillRect(20, -6, 2, 8);
        // Cockpit window
        ctx.fillStyle = 'rgba(116, 185, 255, 0.6)';
        ctx.beginPath();
        ctx.ellipse(-5, -1, 4, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Main rotor (spinning!)
        ctx.save();
        ctx.rotate(obj.phase * 3);
        ctx.strokeStyle = '#636e72';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-18, -6);
        ctx.lineTo(18, -6);
        ctx.stroke();
        ctx.restore();
        // Landing skid
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-8, 5);
        ctx.lineTo(-10, 8);
        ctx.lineTo(8, 8);
        ctx.lineTo(6, 5);
        ctx.stroke();
    }

    function drawPlane(obj, screenY) {
        // Exhaust trail (drawn in world space, need to undo scale)
        ctx.save();
        ctx.scale(obj.dir, 1); // Undo the horizontal flip for trail
        ctx.restore();

        // Draw trail particles behind plane
        for (const t of obj.trail) {
            const tx = (t.x - obj.x) * obj.dir;
            const ty = t.y - obj.y;
            ctx.fillStyle = `rgba(200, 200, 220, ${t.life * 0.3})`;
            ctx.beginPath();
            ctx.arc(tx - obj.dir * 14, ty + screenY - (obj.y - cameraY), t.life * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Fuselage
        ctx.fillStyle = '#dfe6e9';
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillStyle = '#b2bec3';
        ctx.beginPath();
        ctx.moveTo(-2, 0);
        ctx.lineTo(-6, -9);
        ctx.lineTo(4, -9);
        ctx.lineTo(2, 0);
        ctx.closePath();
        ctx.fill();
        // Tail wing
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(14, -5);
        ctx.lineTo(16, -5);
        ctx.lineTo(13, 0);
        ctx.closePath();
        ctx.fill();
        // Window line
        ctx.fillStyle = 'rgba(116, 185, 255, 0.5)';
        for (let w = -8; w < 6; w += 3) {
            ctx.fillRect(w, -1, 1.5, 2);
        }
    }

    // ============================================================
    //  Particles
    // ============================================================
    function spawnParticle(x, y, color, type) {
        const count = type === 'fire' ? 2 : 6;
        for (let i = 0; i < count; i++) {
            particles.push({
                x, y,
                vx: (Math.random() - 0.5) * (type === 'burst' ? 6 : 2),
                vy: (Math.random() - 0.5) * (type === 'burst' ? 6 : 2) + (type === 'fire' ? 2 : 0),
                life: 1,
                decay: 0.02 + Math.random() * 0.03,
                size: 3 + Math.random() * 4,
                color,
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ============================================================
    //  Game Over
    // ============================================================
    function gameOver() {
        state = 'gameover';
        const isNewRecord = score > highScore;
        if (isNewRecord) {
            highScore = score;
            localStorage.setItem('catCityJump_highScore', highScore.toString());
        }

        finalScore.textContent = score.toLocaleString();
        finalHighScore.textContent = highScore.toLocaleString();
        finalFloor.textContent = FLOORS[currentFloorIdx].name;
        newRecordEl.classList.toggle('hidden', !isNewRecord);

        // --- Progress Tower ---
        updateProgressTower();

        showScreen('gameover');
    }

    function updateProgressTower() {
        const towerFill = document.getElementById('tower-fill');
        const towerCatMarker = document.getElementById('tower-cat-marker');
        const towerFloors = document.querySelectorAll('.tower-floor');

        // Calculate progress percentage based on floor segments
        // Each floor occupies 20% of the bar (5 floors = 100%)
        // Within each floor segment, lerp between that floor's min and the next floor's min
        const floorCount = FLOORS.length;
        const segmentSize = 100 / floorCount; // 20% per floor

        let progress = 0;
        if (currentFloorIdx >= floorCount - 1) {
            // At the highest floor
            const floorMin = FLOORS[floorCount - 1].scoreMin;
            const overflowMax = floorMin + 5000; // Assume 5000 points to fill last segment
            const withinFloor = Math.min((score - floorMin) / (overflowMax - floorMin), 1);
            progress = (floorCount - 1) * segmentSize + withinFloor * segmentSize;
        } else {
            const floorMin = FLOORS[currentFloorIdx].scoreMin;
            const floorMax = FLOORS[currentFloorIdx + 1].scoreMin;
            const withinFloor = Math.min((score - floorMin) / (floorMax - floorMin), 1);
            progress = currentFloorIdx * segmentSize + withinFloor * segmentSize;
        }

        progress = Math.min(progress, 100);

        // Map floor index: tower-floor data-floor => FLOORS index
        // Reset all floors first
        towerFloors.forEach(f => {
            f.classList.remove('reached', 'current');
        });

        // Mark reached and current floors
        towerFloors.forEach(f => {
            const floorDataIdx = parseInt(f.getAttribute('data-floor'));
            if (floorDataIdx <= currentFloorIdx) {
                f.classList.add('reached');
            }
            if (floorDataIdx === currentFloorIdx) {
                f.classList.add('current');
            }
        });

        // Reset tower fill for animation
        towerFill.style.height = '0%';
        towerCatMarker.style.bottom = '0%';

        // Animate after a short delay so transition plays
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                towerFill.style.height = progress + '%';
                towerCatMarker.style.bottom = progress + '%';
            });
        });
    }

    // ============================================================
    //  Cleanup
    // ============================================================
    function cleanup() {
        const cutoff = cameraY + CANVAS_H + 200;
        platforms = platforms.filter(p => p.y < cutoff && (!p.broken || p.breakAnim < 2));
        items = items.filter(i => !i.collected && i.y < cutoff);
        obstacles = obstacles.filter(o => o.y < cutoff && o.y > cameraY - 200);
    }

    // ============================================================
    //  Rendering
    // ============================================================
    function render() {
        ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

        if (state === 'title') {
            drawTitleBackground();
            return;
        }

        // Apply camera effects (zoom)
        ctx.save();
        if (state === 'playing' || state === 'gameover') {
            // Zoom: scale from center of canvas
            if (cam.zoom !== 1.0) {
                const cx = CANVAS_W / 2;
                const cy = CANVAS_H / 2;
                ctx.translate(cx, cy);
                ctx.scale(cam.zoom, cam.zoom);
                ctx.translate(-cx, -cy);
            }
        }

        drawBackground();
        drawAmbient();
        drawPlatforms();
        drawItems();
        drawObstacles();
        drawPlayer();
        drawParticles();
        drawWindParticles();
        drawHintArrow();
        drawEffectOverlays();

        ctx.restore();
    }

    // ---- Directional Hint Arrow ----
    function drawHintArrow() {
        // Only show when zoomed in
        if (cam.zoom < 1.05) return;

        const nextPlat = getNextPlatformHint();
        if (!nextPlat) return;

        const platCenterX = nextPlat.x + nextPlat.w / 2;
        const platScreenY = nextPlat.y - cameraY;
        const playerCenterX = player.x + player.w / 2;

        // Arrow at top of screen pointing towards next platform
        const arrowX = Math.max(30, Math.min(CANVAS_W - 30, platCenterX));
        const arrowY = Math.max(50, platScreenY - 20);

        // Pulsing opacity
        const pulse = 0.4 + Math.sin(frameCount * 0.15) * 0.3;

        ctx.save();
        ctx.globalAlpha = pulse;

        // Triangle arrow
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY - 10);
        ctx.lineTo(arrowX - 8, arrowY + 5);
        ctx.lineTo(arrowX + 8, arrowY + 5);
        ctx.closePath();
        ctx.fill();

        // Glow
        ctx.shadowColor = '#ff6b35';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();
    }

    // ---- Title Background ----
    function drawTitleBackground() {
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, '#ff7b54');
        grad.addColorStop(0.5, '#2d1b69');
        grad.addColorStop(1, '#0a0e1a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Silhouette buildings
        ctx.fillStyle = 'rgba(10, 14, 26, 0.8)';
        for (let i = 0; i < 12; i++) {
            const bx = i * 38 - 10;
            const bh = 80 + Math.sin(i * 1.5) * 50;
            ctx.fillRect(bx, CANVAS_H - bh, 32, bh);
            // Small window
            ctx.fillStyle = 'rgba(255, 200, 80, 0.3)';
            for (let wy = CANVAS_H - bh + 10; wy < CANVAS_H - 10; wy += 18) {
                ctx.fillRect(bx + 5, wy, 6, 8);
                ctx.fillRect(bx + 18, wy, 6, 8);
            }
            ctx.fillStyle = 'rgba(10, 14, 26, 0.8)';
        }

        // Animated stars
        const t = Date.now() * 0.001;
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 20; i++) {
            const sx = (i * 73.7) % CANVAS_W;
            const sy = (i * 47.3) % (CANVAS_H * 0.5);
            const alpha = 0.3 + Math.sin(t * 2 + i) * 0.3;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Hex Color Utilities ----
    function hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return [r, g, b];
    }

    function lerpColor(hex1, hex2, t) {
        const [r1, g1, b1] = hexToRgb(hex1);
        const [r2, g2, b2] = hexToRgb(hex2);
        const r = Math.round(r1 + (r2 - r1) * t);
        const g = Math.round(g1 + (g2 - g1) * t);
        const b = Math.round(b1 + (b2 - b1) * t);
        return `rgb(${r},${g},${b})`;
    }

    // ---- Game Background ----
    function drawBackground() {
        const floor = FLOORS[currentFloorIdx];
        const palette = BG_PALETTES[floor.bgPhase];

        // Update transition
        let topColor, midColor, botColor;
        if (bgTransition.active) {
            bgTransition.progress += bgTransition.speed;
            if (bgTransition.progress >= 1) {
                bgTransition.progress = 1;
                bgTransition.active = false;
            }
            const t = bgTransition.progress;
            // Ease in-out for smoother feel
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            topColor = lerpColor(bgTransition.fromPalette.top, bgTransition.toPalette.top, eased);
            midColor = lerpColor(bgTransition.fromPalette.mid, bgTransition.toPalette.mid, eased);
            botColor = lerpColor(bgTransition.fromPalette.bot, bgTransition.toPalette.bot, eased);
        } else {
            topColor = palette.top;
            midColor = palette.mid;
            botColor = palette.bot;
        }

        // Sky gradient
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
        grad.addColorStop(0, topColor);
        grad.addColorStop(0.6, midColor);
        grad.addColorStop(1, botColor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Stars (visible in dusk/night/dawn)
        if (floor.bgPhase !== 'sunset') {
            for (const star of bgStars) {
                const sy = (star.y - cameraY * 0.05) % (CANVAS_H + 200) - 100;
                if (sy < 0 || sy > CANVAS_H) continue;
                star.twinkle += star.speed;
                const alpha = 0.3 + Math.sin(star.twinkle) * 0.4;
                ctx.globalAlpha = Math.max(0, alpha);
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(star.x, sy, star.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }

        // Background buildings (parallax)
        for (const b of bgBuildings) {
            const parallax = [0.08, 0.15, 0.25][b.layer];
            const brightness = [15, 22, 32][b.layer];
            const by = CANVAS_H - b.h + 40 - (cameraY * parallax) % (b.h + 80);

            ctx.fillStyle = `hsl(${b.hue}, 20%, ${brightness}%)`;
            ctx.fillRect(b.x, by, b.w, b.h + 200);

            // Windows
            if (floor.bgPhase !== 'sunset') {
                const winColors = ['rgba(255,200,80,0.5)', 'rgba(0,200,255,0.3)', 'rgba(255,100,200,0.3)'];
                for (let wy = by + 8; wy < by + b.h; wy += 14) {
                    for (let wx = b.x + 3; wx < b.x + b.w - 6; wx += 9) {
                        if (Math.random() > 0.4) {
                            ctx.fillStyle = winColors[Math.floor(Math.random() * winColors.length)];
                            ctx.fillRect(wx, wy, 4, 6);
                        }
                    }
                }
            }

            if (b.hasAntenna) {
                ctx.fillStyle = `hsl(${b.hue}, 15%, ${brightness + 5}%)`;
                ctx.fillRect(b.x + b.w / 2 - 1, by - 15, 2, 15);
                // Blinking light
                if (Math.sin(frameCount * 0.05 + b.x) > 0.5) {
                    ctx.fillStyle = '#ff3333';
                    ctx.beginPath();
                    ctx.arc(b.x + b.w / 2, by - 15, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    // ---- Platforms ----
    function drawPlatforms() {
        for (const p of platforms) {
            const sy = p.y - cameraY;
            if (sy < -30 || sy > CANVAS_H + 30) continue;

            if (p.broken && p.breakAnim > 0) {
                ctx.globalAlpha = Math.max(0, 1 - p.breakAnim);
                ctx.save();
                ctx.translate(p.x + p.w / 2, sy + p.h / 2);
                ctx.rotate(p.breakAnim * 0.3);
                ctx.translate(-(p.x + p.w / 2), -(sy + p.h / 2));
            }

            const floor = FLOORS[currentFloorIdx];
            switch (p.type) {
                case 'normal':
                    drawBuildingPlatform(p.x, sy, p.w, p.h, '#556677', '#445566');
                    break;
                case 'breakable':
                    drawBuildingPlatform(p.x, sy, p.w, p.h, '#887755', '#776644');
                    // Cracks
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(p.x + p.w * 0.3, sy + 2);
                    ctx.lineTo(p.x + p.w * 0.5, sy + p.h - 2);
                    ctx.moveTo(p.x + p.w * 0.7, sy + 3);
                    ctx.lineTo(p.x + p.w * 0.6, sy + p.h - 3);
                    ctx.stroke();
                    break;
                case 'neon':
                    const glow = Math.sin(p.neonPhase) * 0.3 + 0.7;
                    ctx.shadowColor = '#00d4ff';
                    ctx.shadowBlur = 15 * glow;
                    drawBuildingPlatform(p.x, sy, p.w, p.h, '#006688', '#005577');
                    ctx.shadowBlur = 0;
                    // Neon strip
                    ctx.fillStyle = `rgba(0, 212, 255, ${glow})`;
                    ctx.fillRect(p.x + 2, sy + p.h - 3, p.w - 4, 2);
                    break;
                case 'moving':
                    drawBuildingPlatform(p.x, sy, p.w, p.h, '#665577', '#554466');
                    // Arrow indicators
                    ctx.fillStyle = 'rgba(255,255,255,0.3)';
                    ctx.font = '10px sans-serif';
                    ctx.fillText(p.moveDir > 0 ? '→' : '←', p.x + p.w / 2 - 4, sy + 11);
                    break;
                case 'trap':
                    drawBuildingPlatform(p.x, sy, p.w, p.h, '#774444', '#663333');
                    // Danger marks
                    ctx.fillStyle = 'rgba(255,100,100,0.5)';
                    ctx.font = '8px sans-serif';
                    ctx.fillText('⚠', p.x + p.w / 2 - 4, sy + 10);
                    break;
            }

            if (p.broken && p.breakAnim > 0) {
                ctx.restore();
                ctx.globalAlpha = 1;
            }
        }
    }

    function drawBuildingPlatform(x, y, w, h, topColor, sideColor) {
        // Rooftop
        ctx.fillStyle = topColor;
        ctx.fillRect(x, y, w, h);
        // Edge highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, w, 2);
        // Side shadow
        ctx.fillStyle = sideColor;
        ctx.fillRect(x, y + h - 3, w, 3);
    }

    // ---- Items ----
    function drawItems() {
        for (const item of items) {
            if (item.collected) continue;
            const sy = item.y - cameraY + Math.sin(item.bobPhase) * 3;
            if (sy < -30 || sy > CANVAS_H + 30) continue;

            ctx.font = '20px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(item.emoji, item.x + item.w / 2, sy + item.h / 2);
        }
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    // ---- Obstacles ----
    function drawObstacles() {
        for (const obs of obstacles) {
            const sy = obs.y - cameraY;
            if (sy < -50 || sy > CANVAS_H + 50) continue;

            ctx.font = `${obs.size}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obs.emoji, obs.x + obs.size / 2, sy + obs.size / 2);
        }
        ctx.textAlign = 'start';
        ctx.textBaseline = 'alphabetic';
    }

    // ---- Player (Cat) ----
    function drawPlayer() {
        const sx = player.x;
        const sy = player.y - cameraY;
        if (sy < -50 || sy > CANVAS_H + 50) return;

        ctx.save();
        ctx.translate(sx + player.w / 2, sy + player.h / 2);
        if (!player.facingRight) ctx.scale(-1, 1);

        // Shield glow
        if (shieldActive) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, player.w * 0.7, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Rocket visual
        if (rocketTimer > 0) {
            ctx.font = '28px serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🚀', 0, 0);
            ctx.restore();
            // Cat on top
            ctx.save();
            ctx.translate(sx + player.w / 2, sy + player.h / 2 - 20);
            drawCatSprite(ctx, 0, 0, player.vy < 0);
            ctx.restore();
            return;
        }

        // Balloon visual
        if (balloonTimer > 0) {
            ctx.font = '22px serif';
            ctx.textAlign = 'center';
            ctx.fillText('🎈', 0, -24);
            // String
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, -14);
            ctx.lineTo(0, 0);
            ctx.stroke();
        }

        drawCatSprite(ctx, 0, 0, player.vy < 0);
        ctx.restore();
    }

    function drawCatSprite(ctx, cx, cy, jumping) {
        // Body - orange cat
        ctx.fillStyle = '#ff9933';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 14, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stripes
        ctx.strokeStyle = '#cc6600';
        ctx.lineWidth = 1.5;
        for (let i = -6; i <= 6; i += 6) {
            ctx.beginPath();
            ctx.moveTo(cx + i - 2, cy - 6);
            ctx.lineTo(cx + i + 2, cy + 8);
            ctx.stroke();
        }

        // Head
        ctx.fillStyle = '#ff9933';
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 10, 0, Math.PI * 2);
        ctx.fill();

        // Ears
        ctx.fillStyle = '#ff9933';
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 15);
        ctx.lineTo(cx - 12, cy - 24);
        ctx.lineTo(cx - 3, cy - 17);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 8, cy - 15);
        ctx.lineTo(cx + 12, cy - 24);
        ctx.lineTo(cx + 3, cy - 17);
        ctx.fill();

        // Inner ears
        ctx.fillStyle = '#ffaaaa';
        ctx.beginPath();
        ctx.moveTo(cx - 7, cy - 16);
        ctx.lineTo(cx - 10, cy - 22);
        ctx.lineTo(cx - 4, cy - 17);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + 7, cy - 16);
        ctx.lineTo(cx + 10, cy - 22);
        ctx.lineTo(cx + 4, cy - 17);
        ctx.fill();

        // Eyes
        if (jumping) {
            // Big round eyes when jumping up
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx - 4, cy - 12, 4, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy - 12, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(cx - 4, cy - 12, 2.5, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy - 12, 2.5, 0, Math.PI * 2);
            ctx.fill();
            // Eye highlight
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx - 3, cy - 13, 1, 0, Math.PI * 2);
            ctx.arc(cx + 5, cy - 13, 1, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Worried eyes when falling
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(cx - 4, cy - 11, 3.5, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy - 11, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(cx - 4, cy - 10, 2, 0, Math.PI * 2);
            ctx.arc(cx + 4, cy - 10, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        // Nose
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 7);
        ctx.lineTo(cx - 2, cy - 5);
        ctx.lineTo(cx + 2, cy - 5);
        ctx.fill();

        // Mouth
        ctx.strokeStyle = '#cc6644';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5);
        ctx.quadraticCurveTo(cx - 3, cy - 2, cx - 5, cy - 4);
        ctx.moveTo(cx, cy - 5);
        ctx.quadraticCurveTo(cx + 3, cy - 2, cx + 5, cy - 4);
        ctx.stroke();

        // Whiskers
        ctx.strokeStyle = '#ddaa66';
        ctx.lineWidth = 0.8;
        // Left whiskers
        ctx.beginPath();
        ctx.moveTo(cx - 6, cy - 7);
        ctx.lineTo(cx - 16, cy - 9);
        ctx.moveTo(cx - 6, cy - 5);
        ctx.lineTo(cx - 16, cy - 5);
        ctx.stroke();
        // Right whiskers
        ctx.beginPath();
        ctx.moveTo(cx + 6, cy - 7);
        ctx.lineTo(cx + 16, cy - 9);
        ctx.moveTo(cx + 6, cy - 5);
        ctx.lineTo(cx + 16, cy - 5);
        ctx.stroke();

        // Legs (spread when falling)
        ctx.fillStyle = '#ff9933';
        if (jumping || player.vy < -2) {
            // Legs tucked up
            ctx.fillRect(cx - 10, cy + 10, 6, 5);
            ctx.fillRect(cx + 4, cy + 10, 6, 5);
        } else {
            // Legs spread out
            ctx.fillRect(cx - 12, cy + 8, 6, 8);
            ctx.fillRect(cx + 6, cy + 8, 6, 8);
        }

        // Tail
        ctx.strokeStyle = '#ff9933';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const tailWag = Math.sin(frameCount * 0.1) * 5;
        ctx.beginPath();
        ctx.moveTo(cx + 10, cy + 4);
        ctx.quadraticCurveTo(cx + 18, cy - 2, cx + 16 + tailWag, cy - 10);
        ctx.stroke();
        ctx.lineCap = 'butt';
    }

    // ---- Particles ----
    function drawParticles() {
        for (const p of particles) {
            const sy = p.y - cameraY;
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, sy, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ---- Effect Overlays ----
    function drawEffectOverlays() {
        // Multiplier indicator
        if (scoreMultiplier > 1) {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
            ctx.font = 'bold 16px Outfit, sans-serif';
            ctx.fillStyle = '#ffd700';
            ctx.textAlign = 'center';
            ctx.fillText('⭐ x2 점수!', CANVAS_W / 2, 70);
            ctx.textAlign = 'start';
        }
    }

    // ============================================================
    //  Utility
    // ============================================================
    function rectOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }

    // ============================================================
    //  Start
    // ============================================================
    showScreen('title');
    init();

})();
