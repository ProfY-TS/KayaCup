/**
 * Kaya Cup 2026 - Game Engine
 * All simulation logic, rendering, and state management
 */

const KayaEngine = (function() {
    'use strict';

    // --- Constants ---
    const STUDENT_NAMES = [
        "JAC", "ZSSS", "Tungston", "Lim1555", "RayNA", "QRun", "Hao_T", 
        "Leslie", "Fyna", "Poh", "LiY", "CXian", "Bunny", "Ivan", "XCY666", 
        "ProfY", "Thorston", "Telur", "Kopi", "Puchong_123"
    ];
    const DT = 0.05;
    const MAX_STRATEGY_SPEED = 1.2;  // Maximum velocity (units per second)

    // --- State ---
    let players = [];
    let npcs = [];
    let simTime = 0.0;
    let isRunning = false;
    let animationFrameId = null;
    let hpChart = null;
    let firstBloodOccurred = false;

    // Visual Animation Tracking Arrays
    let countdownTime = null;
    let countdownTimerId = null;
    let screenShakeFrames = 0;
    let visualRipples = [];
    let floatingTexts = [];
    let arenaAlertText = null;
    let lastFrameTimestamp = 0;

    // --- DOM References (set by host page) ---
    let canvas = null;
    let ctx = null;
    let tickerBox = null;
    let btnToggle = null;
    let btnReset = null;

    // --- Strategy Cache ---
    const strategyCache = new Map();
    const strategyLoadErrors = new Set();

    // --- Chart Plugin ---
    const lineEndLabelsPlugin = {
        id: 'lineEndLabels',
        afterDatasetsDraw(chart) {
            const { ctx, chartArea: { right } } = chart;
            ctx.save();
            ctx.font = 'bold 12px sans-serif';
            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                const data = dataset.data;
                const lastPoint = data[data.length - 1];
                if (!lastPoint || typeof lastPoint.y === 'undefined' || lastPoint.y === null) return;
                const lastMetaPoint = meta.data[meta.data.length - 1];
                if (lastMetaPoint) {
                    ctx.fillStyle = dataset.borderColor;
                    ctx.fillText(dataset.label, lastMetaPoint.x + 5, lastMetaPoint.y + 4);
                }
            });
            ctx.restore();
        }
    };

    // --- Utility Functions ---
    function randomNormal() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function getParams() {
        return {
            sigma: parseFloat(document.getElementById('param-sigma').value),
            r_limit: parseFloat(document.getElementById('param-r').value),
            lam: parseFloat(document.getElementById('param-lam').value),
            r_prime: parseFloat(document.getElementById('param-rprime').value),
            beta: parseFloat(document.getElementById('param-beta').value),
            qty: parseInt(document.getElementById('param-qty').value),
            speed: parseFloat(document.getElementById('param-speed').value)
        };
    }

    function generateDistinctColors(num) {
        const colors = [];
        for(let i=0; i<num; i++) {
            const hue = (i * (360 / Math.max(num, 1))) % 360;
            colors.push(`hsl(${hue}, 85%, 60%)`);
        }
        return colors;
    }

    function getHpColor(hp) {
        if (hp <= 0) return "#444444";
        let frac = hp / 100.0;
        let r = Math.floor((1.0 - frac) * 255);
        let g = Math.floor(frac * 255);
        return `rgb(${r}, ${g}, 0)`;
    }

    // --- Logging ---
    function logEvent(message, color = "#ffffff") {
        if (!tickerBox) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.style.color = color;
        entry.innerHTML = `[${simTime.toFixed(1)}s] ${message}`;
        tickerBox.appendChild(entry);
        if (tickerBox.children.length > 12) {
            tickerBox.removeChild(tickerBox.firstChild);
        }
    }

    // --- Visual Effects ---
    function triggerShake() {
        screenShakeFrames = 15;
    }

    function createFloatingText(x, y, text, color) {
        floatingTexts.push({ x, y, text, color, alpha: 0.7, lifetime: 55 });
    }

    function createRipple(x, y, maxRadius) {
        visualRipples.push({ x, y, radius: 2, maxRadius, alpha: 0.8 });
    }

    function triggerArenaAlert(text, subtitle = "") {
        arenaAlertText = { text, subtitle, lifetime: 45, scale: 0.5 };
    }

    // --- Strategy Loading System ---
    async function loadPlayerStrategy(playerName) {
        // Check cache first
        if (strategyCache.has(playerName)) {
            return strategyCache.get(playerName);
        }
        
        // Check if we've already tried and failed to load this strategy
        if (strategyLoadErrors.has(playerName)) {
            return null;
        }
        
        try {
            // Attempt to dynamically import the strategy
            const module = await import(`./strategies/${playerName}.js`);
            const strategy = module.default || module;
            
            // Validate that it's a function
            if (typeof strategy !== 'function') {
                console.warn(`Strategy for ${playerName} is not a function`);
                strategyLoadErrors.add(playerName);
                strategyCache.set(playerName, null);
                return null;
            }
            
            // Cache the strategy
            strategyCache.set(playerName, strategy);
            return strategy;
            
        } catch(e) {
            // Strategy file not found or has errors
            console.log(`No strategy found for ${playerName}, using random movement`);
            strategyLoadErrors.add(playerName);
            strategyCache.set(playerName, null);
            return null;
        }
    }

    // Pre-load all strategies when game starts
    async function preloadStrategies(playerNames) {
        const loadPromises = playerNames.map(name => loadPlayerStrategy(name));
        await Promise.allSettled(loadPromises);
    }

    // --- Initialization ---
    function initializeGame(qty) {
        const arr = [];
        for (let i = 0; i < qty; i++) {
            // Fixed radius = 0.8
            let r = 0.8;
            // Equi-angled distribution: divide 360 degrees evenly
            let theta = (i / qty) * 2 * Math.PI;
            
            arr.push({
                name: STUDENT_NAMES[i] || `Student ${i+1}`,
                x: r * Math.cos(theta),
                y: r * Math.sin(theta),
                hp: 100.0,
                strategy: null,  // Will be loaded later
                hasStrategy: false
            });
        }

        // NPCs start at center (0,0)
        const npcList = [
            { name: "Kaya", type: "demon", emoji: "🐱", x: 0, y: 0, hp: null },
            { name: "Butter", type: "healer", emoji: "🐶", x: 0, y: 0, hp: null }
        ];

        firstBloodOccurred = false;
        if (tickerBox) tickerBox.innerHTML = "";
        visualRipples = [];
        floatingTexts = [];
        arenaAlertText = null;
        countdownTime = null;
        if(countdownTimerId) clearInterval(countdownTimerId);

        logEvent("⚔️ Contestants dropped! NPCs Kaya (demon cat) & Butter (healer dog) roam the arena.", "#00d4ff");
        return { contestants: arr, npcs: npcList };
    }

    // --- Simulation Steps ---

    // Step only for NPCs: diffusion (random walk)
    function stepNPCs(npcsList, sigmaStep) {
        npcsList.forEach(npc => {
            let newX = npc.x + randomNormal() * sigmaStep;
            let newY = npc.y + randomNormal() * sigmaStep;
            let dist = Math.sqrt(newX*newX + newY*newY);
            if (dist > 1) {
                newX /= dist;
                newY /= dist;
            }
            npc.x = newX;
            npc.y = newY;
        });
    }

    // NPC special abilities
    function applyNPCInteractions(contestants, npcsList, params, dt) {
        const { r_limit } = params;
        
        // Separate rates for Kaya and Butter
        const KAYA_ATTACK_RATE = 2.0;    // Kaya attacks 2 times per second
        const BUTTER_HEAL_RATE = 1.0;    // Butter heals 1 time per second
        const BUTTER_HEAL_CAP = 50;      // Butter only heals up to 50 HP!
        
        // Calculate probabilities separately
        let kayaEffectProb = 1 - Math.exp(-KAYA_ATTACK_RATE * dt);
        let butterEffectProb = 1 - Math.exp(-BUTTER_HEAL_RATE * dt);

        for (let npc of npcsList) {
            for (let p of contestants) {
                if (p.hp <= 0) continue;
                let dx = p.x - npc.x;
                let dy = p.y - npc.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < r_limit) {
                    if (npc.type === "demon") {
                        // Kaya uses kayaEffectProb
                        if (Math.random() < kayaEffectProb) {
                            let oldHp = p.hp;
                            p.hp = Math.max(0, p.hp - 1.0);
                            createRipple((p.x + npc.x)/2, (p.y + npc.y)/2, r_limit * 80);
                            createFloatingText(p.x, p.y, "-1 HP", "#ff6666");
                            if (p.hp === 0 && oldHp > 0) {
                                triggerShake();
                                let livingCount = contestants.filter(c => c.hp > 0).length;
                                if (!firstBloodOccurred) {
                                    firstBloodOccurred = true;
                                    isRunning = false;
                                    triggerArenaAlert("🩸 FIRST BLOOD!", "");
                                    setTimeout(() => {
                                        logEvent(`🩸 FIRST BLOOD! [${p.name}] was struck down by Kaya the demon cat!`, "#ff3333");
                                        triggerArenaAlert(`${p.name.toUpperCase()} OUT!`, "Neutralized by Kaya 🐱");
                                        triggerShake();
                                        isRunning = true;
                                        lastFrameTimestamp = performance.now();
                                        animationFrameId = requestAnimationFrame(gameLoop);
                                    }, 2000);
                                } else {
                                    logEvent(`💀 ELIMINATED! Kaya the demon cat knocked out [${p.name}]!`, "#ff4560");
                                    triggerArenaAlert(`${p.name.toUpperCase()} OUT!`, "Slain by Kaya 🐱");
                                }
                                if (livingCount === 3) {
                                    logEvent(`👑 DOWN TO THE WIRE! Only 3 contestants left!`, "#ffea00");
                                }
                            } else if (p.hp > 0 && p.hp <= 25) {
                                if (Math.random() < 0.08) logEvent(`😾 Kaya claws [${p.name}]! (-1 HP)`, "#ff9f43");
                            }
                        }
                    } else if (npc.type === "healer") {
                        // Butter uses butterEffectProb - ONLY heals if HP < 50!
                        if (p.hp < BUTTER_HEAL_CAP && Math.random() < butterEffectProb) {
                            let newHp = Math.min(BUTTER_HEAL_CAP, p.hp + 1.0);
                            p.hp = newHp;
                            createFloatingText(p.x, p.y, "+1 HP", "#88ffaa");
                            if (Math.random() < 0.06) logEvent(`💖 Butter heals [${p.name}]! (+1 HP)`, "#aaffdd");
                        }
                    }
                }
            }
        }
    }

    // --- Apply Player Strategies ---
    function applyPlayerStrategies(playerList, npcsList, params) {
        const dt = DT;
        
        playerList.forEach((p, index) => {
            if (p.hp <= 0) return;
            
            // Load strategy if not already loaded
            if (!p.hasStrategy && !strategyLoadErrors.has(p.name)) {
                // Strategy loading is async, but we need to handle it
                // We'll use a flag to track if we're loading
                if (!p._loadingStrategy) {
                    p._loadingStrategy = true;
                    loadPlayerStrategy(p.name).then(strategy => {
                        if (strategy) {
                            p.strategy = strategy;
                            p.hasStrategy = true;
                        }
                        p._loadingStrategy = false;
                    }).catch(() => {
                        p._loadingStrategy = false;
                    });
                }
                return; // Skip this frame while loading
            }
            
            // Skip if no strategy
            if (!p.strategy || !p.hasStrategy) {
                return;
            }
            
            try {
                // Build context with clean separation (Method A)
                const context = {
                    me: {
                        name: p.name,
                        x: p.x,
                        y: p.y,
                        hp: p.hp
                    },
                    others: playerList
                        .filter(other => other.name !== p.name && other.hp > 0)
                        .map(other => ({
                            name: other.name,
                            x: other.x,
                            y: other.y,
                            hp: other.hp
                        })),
                    npcs: npcsList.map(npc => ({
                        name: npc.name,
                        type: npc.type,
                        x: npc.x,
                        y: npc.y,
                        emoji: npc.emoji,
                        hp: npc.hp !== null ? npc.hp : Infinity
                    })),
                    params: params,
                    dt: dt,
                    maxSpeed: MAX_STRATEGY_SPEED  // Maximum velocity (units per second)
                };
                
                // Execute strategy - returns velocity (units per second)
                const move = p.strategy(context);
                
                // Validate return value
                if (move && typeof move === 'object') {
                    let dx = typeof move.dx === 'number' ? move.dx : 0;
                    let dy = typeof move.dy === 'number' ? move.dy : 0;
                    
                    // --- APPLY SPEED CONSTRAINT ---
                    const speed = Math.sqrt(dx*dx + dy*dy);
                    if (speed > MAX_STRATEGY_SPEED) {
                        // Scale down to max allowed speed (preserve direction)
                        const scale = MAX_STRATEGY_SPEED / speed;
                        dx *= scale;
                        dy *= scale;
                    }
                    
                    // Apply deterministic movement: velocity * time step
                    p.x += dx * dt;
                    p.y += dy * dt;
                    
                    // Clamp to arena bounds
                    const dist = Math.sqrt(p.x*p.x + p.y*p.y);
                    if (dist > 1) {
                        p.x /= dist;
                        p.y /= dist;
                    }
                }
            } catch(e) {
                console.warn(`Strategy error for ${p.name}:`, e);
                // Disable strategy for this player to prevent repeated errors
                p.hasStrategy = false;
                p.strategy = null;
            }
        });
    }

    // --- Modified stepSimulation with Strategy Support ---
    function stepSimulation(playerList, npcsList, params) {
        const { sigma, r_limit, lam, r_prime, beta } = params;
        let stepSize = sigma * Math.sqrt(DT);

        // 0. Apply player strategies (deterministic movement)
        applyPlayerStrategies(playerList, npcsList, params);

        // 1. Diffusion for contestants (Brownian motion)
        playerList.forEach(p => {
            if (p.hp <= 0) return;
            let newX = p.x + randomNormal() * stepSize;
            let newY = p.y + randomNormal() * stepSize;
            let dist = Math.sqrt(newX*newX + newY*newY);
            if (dist > 1) {
                newX /= dist;
                newY /= dist;
            }
            p.x = newX;
            p.y = newY;
        });

        // 1b. Diffusion for NPCs
        stepNPCs(npcsList, stepSize);

        // 2. Fight Step (contestants vs contestants)
        let fightProb = 1 - Math.exp(-lam * DT);
        for (let i = 0; i < playerList.length; i++) {
            for (let j = i + 1; j < playerList.length; j++) {
                if (playerList[i].hp <= 0 || playerList[j].hp <= 0) continue;

                let dx = playerList[i].x - playerList[j].x;
                let dy = playerList[i].y - playerList[j].y;
                let distance = Math.sqrt(dx*dx + dy*dy);

                if (distance < r_limit) {
                    if (Math.random() < fightProb) {
                        let p_i_wins = playerList[i].hp / (playerList[i].hp + playerList[j].hp + 1e-9);
                        let winner, loser;

                        if (Math.random() < p_i_wins) {
                            playerList[j].hp = Math.max(0, playerList[j].hp - 1.0);
                            winner = playerList[i]; loser = playerList[j];
                        } else {
                            playerList[i].hp = Math.max(0, playerList[i].hp - 1.0);
                            winner = playerList[j]; loser = playerList[i];
                        }

                        createRipple((winner.x + loser.x)/2, (winner.y + loser.y)/2, r_limit * 80);
                        createFloatingText(loser.x, loser.y, "-1 HP", "#ff3333");

                        if (loser.hp === 0) {
                            triggerShake();
                            let livingCount = playerList.filter(p => p.hp > 0).length;
                            if (!firstBloodOccurred) {
                                firstBloodOccurred = true;
                                isRunning = false;
                                triggerArenaAlert("🩸 FIRST BLOOD!", "");
                                setTimeout(() => {
                                    logEvent(`🩸 FIRST BLOOD! [${loser.name}] has been neutralized by [${winner.name}]!`, "#ff3333");
                                    triggerArenaAlert(`${loser.name.toUpperCase()} OUT!`, `Neutralized by ${winner.name}`);
                                    triggerShake();
                                    isRunning = true;
                                    lastFrameTimestamp = performance.now();
                                    animationFrameId = requestAnimationFrame(gameLoop);
                                }, 2000);
                            } else {
                                logEvent(`💀 ELIMINATED! [${winner.name}] has knocked out [${loser.name}]!`, "#ff4560");
                                triggerArenaAlert(`${loser.name.toUpperCase()} OUT!`, `Neutralized by ${winner.name}`);
                            }
                            if (livingCount === 3) {
                                logEvent(`👑 DOWN TO THE WIRE! Only 3 contestants left!`, "#ffea00");
                            }
                        } else {
                            if (loser.hp <= 25 && Math.random() < 0.03) {
                                logEvent(`🚨 [${loser.name}] is in critical condition! [${winner.name}] is pressing hard!`, "#ff9f43");
                            } else if (Math.random() < 0.01) {
                                const verbs = [
                                    `⚔️ [${winner.name}] lands a swift hit on [${loser.name}]! (-1 HP)`,
                                    `💥 [${winner.name}] breaks through [${loser.name}]'s defense! (-1 HP)`,
                                    `⚡ [${winner.name}] won a quick clash against [${loser.name}]!`
                                ];
                                logEvent(verbs[Math.floor(Math.random() * verbs.length)], "#ffffff");
                            }
                        }
                    }
                }
            }
        }

        // 3. NPC special abilities
        applyNPCInteractions(playerList, npcsList, params, DT);

        // 4. Border Recovery Step
        let recoveryProb = 1 - Math.exp(-beta * DT);
        let boundaryThreshold = 1.0 - r_prime;
        playerList.forEach(p => {
            if (p.hp > 0 && p.hp <= 25) {
                let distFromOrigin = Math.sqrt(p.x*p.x + p.y*p.y);
                if (distFromOrigin >= boundaryThreshold) {
                    if (Math.random() < recoveryProb) {
                        p.hp = Math.min(25.0, p.hp + 1.0);
                        if(Math.random() < 0.2) createFloatingText(p.x, p.y, "+1 HP", "#00ff88");
                    }
                }
            }
        });

        return playerList;
    }

    // --- Chart Management ---
    function resetChartInstance() {
        if (hpChart) hpChart.destroy();
        const colors = generateDistinctColors(players.length);
        const datasets = players.map((p, idx) => ({
            label: p.name,
            data: [{x: 0, y: 100}],
            borderColor: colors[idx],
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.1
        }));
        const ctxChart = document.getElementById('hpChart').getContext('2d');
        hpChart = new Chart(ctxChart, {
            type: 'line',
            data: { datasets: datasets },
            plugins: [lineEndLabelsPlugin],
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                layout: { padding: { right: 70 } },
                scales: {
                    x: { type: 'linear', position: 'bottom', title: { display: true, text: 'Time (seconds)', color: '#8b949e' }, ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
                    y: { min: 0, max: 100, title: { display: true, text: 'Health Points (HP)', color: '#8b949e' }, ticks: { color: '#8b949e' }, grid: { color: '#21262d' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function appendChartData(timeValue) {
        if (!hpChart) return;
        players.forEach((p, idx) => {
            if (hpChart.data.datasets[idx]) {
                hpChart.data.datasets[idx].data.push({ x: timeValue, y: p.hp });
            }
        });
        if (timeValue > 15) {
            hpChart.options.scales.x.min = timeValue - 15;
            hpChart.options.scales.x.max = timeValue;
        } else {
            hpChart.options.scales.x.min = 0;
            hpChart.options.scales.x.max = 15;
        }
        hpChart.update('none');
    }

    // --- Rendering ---
    function drawScene() {
        if (!canvas || !ctx) return;
        ctx.save();
        if (screenShakeFrames > 0) {
            let dx = (Math.random() - 0.5) * 7;
            let dy = (Math.random() - 0.5) * 7;
            ctx.translate(dx, dy);
            screenShakeFrames--;
        }
        const params = getParams();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = canvas.width * 0.45;

        let boundaryRadius = radius * (1 - params.r_prime);
        let pulseGrad = ctx.createRadialGradient(cx, cy, boundaryRadius, cx, cy, radius);
        let pulseIntensity = 0.06 + 0.04 * Math.sin(Date.now() / 150);
        pulseGrad.addColorStop(0, 'rgba(0, 255, 136, 0)');
        pulseGrad.addColorStop(1, `rgba(0, 255, 136, ${pulseIntensity})`);
        ctx.fillStyle = pulseGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, boundaryRadius, 0, 2 * Math.PI);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1.0;

        let highestHp = -1;
        let leaderRef = null;
        players.forEach(p => { if (p.hp > highestHp && p.hp > 0) { highestHp = p.hp; leaderRef = p; } });

        visualRipples.forEach((ripple, idx) => {
            ripple.radius += 2.5;
            ripple.alpha -= 0.03;
            if (ripple.alpha <= 0 || ripple.radius >= ripple.maxRadius) { visualRipples.splice(idx, 1); return; }
            ctx.save();
            ctx.globalAlpha = ripple.alpha;
            ctx.beginPath();
            ctx.arc(cx + ripple.x * radius, cy + ripple.y * radius, ripple.radius, 0, 2 * Math.PI);
            ctx.strokeStyle = '#ff3366';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        });

        // Draw Contestants
        players.forEach(p => {
            let screenX = cx + p.x * radius, screenY = cy + p.y * radius;
            if (p.hp > 0) {
                if (p.hp <= 25) {
                    let distressPulse = 10 + 6 * Math.sin(Date.now() / 60);
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, distressPulse, 0, 2 * Math.PI);
                    ctx.fillStyle = 'rgba(255, 69, 96, 0.25)';
                    ctx.fill();
                }
                if (p === leaderRef) {
                    ctx.beginPath();
                    ctx.arc(screenX, screenY, 12, 0, 2 * Math.PI);
                    ctx.strokeStyle = '#ffd700';
                    ctx.lineWidth = 1.5;
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ffd700';
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                }
            }
            ctx.beginPath();
            ctx.arc(screenX, screenY, 7, 0, 2 * Math.PI);
            ctx.fillStyle = getHpColor(p.hp);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.stroke();
            ctx.fillStyle = p.hp > 0 ? '#FFFFFF' : '#555555';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(p.name, screenX + 11, screenY + 4);
            if (p === leaderRef && p.hp > 0) { ctx.fillStyle = '#ffd700'; ctx.fillText('👑', screenX - 6, screenY - 10); }
            
            // Show strategy indicator (small green dot)
            if (p.hasStrategy && p.hp > 0) {
                ctx.beginPath();
                ctx.arc(screenX - 10, screenY - 10, 3, 0, 2 * Math.PI);
                ctx.fillStyle = '#00ff88';
                ctx.fill();
            }
        });

        // Draw NPCs
        npcs.forEach(npc => {
            let screenX = cx + npc.x * radius, screenY = cy + npc.y * radius;
            ctx.font = '28px sans-serif';
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillText(npc.emoji, screenX - 14, screenY + 10);
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = '#dddddd';
            ctx.fillText(npc.name, screenX - 12, screenY - 8);
            ctx.shadowBlur = 0;
        });

        floatingTexts.forEach((ft, idx) => {
            ft.y -= 0.05; ft.lifetime--; ft.alpha -= 0.03;
            if (ft.lifetime <= 0 || ft.alpha <= 0) { floatingTexts.splice(idx, 1); return; }
            ctx.save();
            ctx.globalAlpha = ft.alpha;
            ctx.fillStyle = ft.color;
            ctx.font = 'bold 12px monospace';
            ctx.fillText(ft.text, cx + ft.x * radius - 10, cy + ft.y * radius - 12);
            ctx.restore();
        });

        if (countdownTime !== null) {
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(7, 9, 14, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = 'bold 85px sans-serif';
            ctx.fillStyle = countdownTime === "FIGHT!" ? '#ff4560' : '#00d4ff';
            ctx.fillText(countdownTime, cx, cy);
            ctx.restore();
        }

        if (arenaAlertText !== null) {
            arenaAlertText.lifetime--;
            if (arenaAlertText.scale < 1.0) arenaAlertText.scale += 0.05;
            ctx.save();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.globalAlpha = Math.min(1.0, arenaAlertText.lifetime / 10);
            ctx.translate(cx, cy - 80);
            ctx.scale(arenaAlertText.scale, arenaAlertText.scale);
            ctx.font = 'bold 36px sans-serif';
            ctx.fillStyle = '#ff4560';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 4;
            ctx.strokeText(arenaAlertText.text, 0, 0);
            ctx.fillText(arenaAlertText.text, 0, 0);
            if (arenaAlertText.subtitle) {
                ctx.font = 'bold 14px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.strokeText(arenaAlertText.subtitle, 0, 30);
                ctx.fillText(arenaAlertText.subtitle, 0, 30);
            }
            ctx.restore();
            if (arenaAlertText.lifetime <= 0) arenaAlertText = null;
        }
        ctx.restore();
    }

    function updateLeaderboard() {
        document.getElementById('timer').innerText = `Tournament Time: ${simTime.toFixed(1)}s`;
        const sorted = [...players].sort((a,b) => b.hp - a.hp);
        const tbody = document.querySelector('#leaderboard tbody');
        tbody.innerHTML = '';
        sorted.forEach((p, index) => {
            const strategyIndicator = p.hasStrategy ? ' 🧠' : '';
            let row = `<tr><td>${index+1}</td><td style="font-weight:bold; color:${p.hp>0?'#fff':'#555'}">${p.name}${strategyIndicator} ${index===0 && p.hp>0?'👑':''}</td><td style="color:${getHpColor(p.hp)}">${p.hp.toFixed(1)}</td></tr>`;
            tbody.innerHTML += row;
        });
    }

    // --- Game Loop ---
    function gameLoop(currentTimestamp) {
        if (!isRunning) return;
        if (!lastFrameTimestamp) lastFrameTimestamp = currentTimestamp;
        let elapsed = currentTimestamp - lastFrameTimestamp;
        const params = getParams();
        let optimalStepDelay = 50 / params.speed;
        if (countdownTime === null) {
            while (elapsed >= optimalStepDelay) {
                players = stepSimulation(players, npcs, params);
                simTime = Math.round((simTime + DT) * 100) / 100;
                elapsed -= optimalStepDelay;
                lastFrameTimestamp = currentTimestamp - elapsed;
                let survivors = players.filter(p => p.hp > 0);
                if(survivors.length <= 1) {
                    isRunning = false;
                    btnToggle.innerText = "🚀 Start Tournament";
                    btnToggle.style.backgroundColor = "#238636";
                    if(survivors.length === 1) {
                        logEvent(`👑 TOURNAMENT OVER! [${survivors[0].name}] is the ultimate champion!`, "#ffea00");
                        triggerArenaAlert("VICTORY!", `${survivors[0].name.toUpperCase()} IS CHAMPION`);
                    } else {
                        logEvent("💀 MUTUAL DESTRUCTION! No survivors remain on the field.", "#ff4560");
                    }
                    updateLeaderboard();
                    appendChartData(simTime);
                    drawScene();
                    cancelAnimationFrame(animationFrameId);
                    return;
                }
            }
            updateLeaderboard();
            appendChartData(simTime);
        } else {
            lastFrameTimestamp = currentTimestamp;
        }
        drawScene();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    // --- Countdown ---
    function runCountdownSequence() {
        let count = 3;
        countdownTime = count;
        logEvent(`⏱️ Tournament starting in ${count}...`, "#00d4ff");
        countdownTimerId = setInterval(() => {
            count--;
            if (count > 0) { countdownTime = count; logEvent(`⏱️ ${count}...`, "#00d4ff"); }
            else if (count === 0) { countdownTime = "FIGHT!"; logEvent("⚔️ FIGHT! Arena system is active!", "#ff4560"); }
            else { clearInterval(countdownTimerId); countdownTime = null; lastFrameTimestamp = performance.now(); }
            drawScene();
        }, 900);
    }

    // --- Public Methods ---
    function resetSim() {
        isRunning = false;
        if(countdownTimerId) clearInterval(countdownTimerId);
        cancelAnimationFrame(animationFrameId);
        btnToggle.innerText = "🚀 Start Tournament";
        btnToggle.style.backgroundColor = "#238636";
        const params = getParams();
        const gameData = initializeGame(params.qty);
        players = gameData.contestants;
        npcs = gameData.npcs;
        simTime = 0.0;
        lastFrameTimestamp = 0;
        
        // Clear strategy cache for new game
        strategyCache.clear();
        strategyLoadErrors.clear();
        
        // Preload strategies asynchronously
        const playerNames = players.map(p => p.name);
        preloadStrategies(playerNames);
        
        updateLeaderboard();
        drawScene();
        resetChartInstance();
    }

    function toggleSimulation() {
        if (isRunning) {
            isRunning = false;
            btnToggle.innerText = "🚀 Start Tournament";
            btnToggle.style.backgroundColor = "#238636";
            if(countdownTimerId) clearInterval(countdownTimerId);
            cancelAnimationFrame(animationFrameId);
        } else {
            isRunning = true;
            btnToggle.innerText = "⏸️ Pause Tournament";
            btnToggle.style.backgroundColor = "#d13b3b";
            if (simTime === 0.0 && countdownTime === null) runCountdownSequence();
            else lastFrameTimestamp = performance.now();
            animationFrameId = requestAnimationFrame(gameLoop);
        }
    }

    function isRunningState() {
        return isRunning;
    }

    // --- DOM Setter Methods ---
    function setCanvas(c, context) {
        canvas = c;
        ctx = context;
    }

    function setTickerBox(box) {
        tickerBox = box;
    }

    function setToggleButton(btn) {
        btnToggle = btn;
    }

    function setResetButton(btn) {
        btnReset = btn;
    }

    // --- Public API ---
    return {
        setCanvas: setCanvas,
        setTickerBox: setTickerBox,
        setToggleButton: setToggleButton,
        setResetButton: setResetButton,
        resetSim: resetSim,
        toggleSimulation: toggleSimulation,
        isRunning: isRunningState,
        drawScene: drawScene
    };

})();