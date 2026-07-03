/**
 * ============================================================
 * SAMPLE STRATEGY FOR KAYA CUP 2026
 * ============================================================
 * 
 * This is a template for creating your own player strategies.
 * Copy this file and rename it to match your player name (e.g., "Kopi.js")
 * 
 * ============================================================
 * STRATEGY FUNCTION SIGNATURE
 * ============================================================
 * 
 * export default function(context) { ... }
 * 
 * The strategy function receives ONE argument: 'context'
 * It must return an object with { dx, dy } where:
 *   - dx: horizontal velocity (units per second)
 *   - dy: vertical velocity (units per second)
 * 
 * ============================================================
 * CONTEXT OBJECT (What you have access to)
 * ============================================================
 * 
 * context = {
 *   me: {                    // YOUR player's information
 *     name: string,          // Player's name (e.g., "Kopi")
 *     x: number,             // X position in arena [-1, 1]
 *     y: number,             // Y position in arena [-1, 1]
 *     hp: number             // Health points (0 to 100)
 *   },
 *   
 *   others: [                // Array of OTHER players (excluding yourself)
 *     {
 *       name: string,        // Player's name
 *       x: number,           // X position in arena [-1, 1]
 *       y: number,           // Y position in arena [-1, 1]
 *       hp: number           // Health points (0 to 100)
 *     },
 *     // ... more players
 *   ],
 *   
 *   npcs: [                  // Array of NPCs (non-player characters)
 *     {
 *       name: string,        // "Kaya" or "Butter"
 *       type: string,        // "demon" (Kaya) or "healer" (Butter)
 *       x: number,           // X position in arena [-1, 1]
 *       y: number,           // Y position in arena [-1, 1]
 *       emoji: string,       // 🐱 for Kaya, 🐶 for Butter
 *       hp: number | Infinity // NPC health (Infinity for invincible)
 *     },
 *     // ... both NPCs
 *   ],
 *   
 *   params: {                // Current game parameters
 *     sigma: number,         // Diffusion rate (random movement)
 *     r_limit: number,       // Fight/heal radius
 *     lam: number,           // Fight rate (Poisson)
 *     r_prime: number,       // Boundary width for recovery
 *     beta: number,          // Recovery rate
 *     qty: number,           // Number of contestants
 *     speed: number          // Simulation speed multiplier
 *   },
 *   
 *   dt: number,              // Time step (usually 0.05 seconds)
 *   maxSpeed: number         // Maximum allowed velocity (1.2 units/sec)
 * }
 * 
 * ============================================================
 * IMPORTANT CONSTRAINTS
 * ============================================================
 * 
 * 1. Your strategy must return { dx, dy } where:
 *    - dx and dy are numbers
 *    - The magnitude sqrt(dx² + dy²) will be capped at maxSpeed (1.2)
 * 
 * 2. The arena is a circle with radius 1.0 centered at (0, 0)
 *    - x and y range from -1 to 1
 *    - Positions outside will be clamped automatically
 * 
 * 3. NPCs:
 *    - Kaya (demon cat 🐱): Deals 1 HP damage when nearby
 *    - Butter (healer dog 🐶): Heals 1 HP when nearby (up to 50 HP cap)
 * 
 * 4. HP ranges:
 *    - 0: Eliminated (dead)
 *    - 1-25: Critical (border recovery available)
 *    - 26-49: Wounded
 *    - 50-100: Healthy
 * 
 * ============================================================
 * HELPFUL SNIPPETS (Copy and modify as needed)
 * ============================================================
 * 
 * // Find a specific NPC:
 * let kaya = npcs.find(n => n.type === "demon");
 * let butter = npcs.find(n => n.name === "Butter");
 * 
 * // Find the closest player:
 * let closest = null;
 * let minDist = Infinity;
 * for (let player of others) {
 *     const dist = Math.sqrt((player.x - me.x)**2 + (player.y - me.y)**2);
 *     if (dist < minDist) {
 *         minDist = dist;
 *         closest = player;
 *     }
 * }
 * 
 * // Find the weakest player:
 * let weakest = null;
 * let minHp = Infinity;
 * for (let player of others) {
 *     if (player.hp < minHp) {
 *         minHp = player.hp;
 *         weakest = player;
 *     }
 * }
 * 
 * // Calculate distance to a point:
 * const dist = Math.sqrt((target.x - me.x)**2 + (target.y - me.y)**2);
 * 
 * // Normalize a direction vector:
 * const dx = target.x - me.x;
 * const dy = target.y - me.y;
 * const dist = Math.sqrt(dx*dx + dy*dy);
 * if (dist > 0.01) {
 *     return {
 *         dx: (dx / dist) * maxSpeed,
 *         dy: (dy / dist) * maxSpeed
 *     };
 * }
 * 
 * // Random movement:
 * const angle = Math.random() * 2 * Math.PI;
 * return {
 *     dx: Math.cos(angle) * maxSpeed * 0.5,
 *     dy: Math.sin(angle) * maxSpeed * 0.5
 * };
 * 
 * ============================================================
 */

// ============================================================
// YOUR STRATEGY FUNCTION
// ============================================================
// 
// Replace this function with your own strategy.
// Use the context object to access game state.
// Return { dx, dy } with your movement decision.
// 
// Note: The order of variables in destructuring doesn't matter.
//       You can write: const { me, others, npcs, maxSpeed } = context;
//       Or: const { maxSpeed, npcs, others, me } = context;
//       Both work the same!
// 
// ============================================================

export default function(context) {
    
    // ==========================================================
    // DESIGN YOUR STRATEGY HERE
    // ==========================================================
    // 
    // Step 1: Destructure what you need from context
    // Note: Order doesn't matter!
    // ==========================================================
    
    const { me, others, npcs, maxSpeed } = context;
    
    // ==========================================================
    // Step 2: Write your logic
    // - Decide where to move
    // - Calculate direction vector
    // - Return { dx, dy }
    // ==========================================================
    
    // Example structure (uncomment and modify):
    // 
    // // Find a target (e.g., closest player)
    // let target = null;
    // let minDist = Infinity;
    // for (let player of others) {
    //     const dist = Math.sqrt((player.x - me.x)**2 + (player.y - me.y)**2);
    //     if (dist < minDist) {
    //         minDist = dist;
    //         target = player;
    //     }
    // }
    // 
    // // If no target, don't move
    // if (!target) {
    //     return { dx: 0, dy: 0 };
    // }
    // 
    // // Calculate direction to target
    // const dx = target.x - me.x;
    // const dy = target.y - me.y;
    // const dist = Math.sqrt(dx*dx + dy*dy);
    // 
    // // If already close, don't move
    // if (dist < 0.05) {
    //     return { dx: 0, dy: 0 };
    // }
    // 
    // // Move toward target at max speed
    // return {
    //     dx: (dx / dist) * maxSpeed,
    //     dy: (dy / dist) * maxSpeed
    // };
    
    // ==========================================================
    // TODO: Implement your strategy here
    // ==========================================================
    
    // Default: Don't move (replace this with your logic)
    return { dx: 0, dy: 0 };
}