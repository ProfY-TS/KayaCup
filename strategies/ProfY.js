/**
 * ProfY's Strategy: The Kamikaze Cat Chaser (Enhanced Chaos Edition)
 * All the silliness, with extra randomness and questionable life choices
 */
let frameCount = 0;
let spinCounter = 0;

export default function(context) {
    const { me, npcs, maxSpeed, dt } = context;
    frameCount++;
    
    // Find Kaya
    let kaya = null;
    for (let npc of npcs) {
        if (npc.type === "demon") {
            kaya = npc;
            break;
        }
    }
    
    if (!kaya) {
        // Wander randomly like a confused cat
        const angle = Math.random() * 2 * Math.PI;
        return {
            dx: Math.cos(angle) * maxSpeed * 0.3,
            dy: Math.sin(angle) * maxSpeed * 0.3
        };
    }
    
    const dx = kaya.x - me.x;
    const dy = kaya.y - me.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // Silly logging every 50 frames
    if (frameCount % 50 === 0) {
        const distanceStr = distance.toFixed(3);
        console.log(`🐱 ProfY chasing Kaya! Distance: ${distanceStr}`);
        if (distance < 0.2) {
            console.log(`💀 ProfY: "I'm touching the cat! This is fine!"`);
        }
    }
    
    // If very close to Kaya, do a victory dance (spin)
    if (distance < 0.15) {
        spinCounter += dt;
        const spinSpeed = 2.0;
        // Circular motion - dancing around Kaya
        const angle = spinCounter * spinSpeed;
        return {
            dx: Math.cos(angle) * 0.15,
            dy: Math.sin(angle) * 0.15
        };
    }
    
    // If at low HP but STILL chasing Kaya (true dedication)
    if (me.hp < 20 && distance < 0.3) {
        // Even more reckless - double speed!
        console.log(`🔥 ProfY: "I'm almost dead but I SEE THE CAT!"`);
        const recklessSpeed = maxSpeed * 1.5;  // Reckless abandon!
        return {
            dx: (dx / distance) * recklessSpeed,
            dy: (dy / distance) * recklessSpeed
        };
    }
    
    // Normal behavior: CHASE THAT CAT!
    return {
        dx: (dx / distance) * maxSpeed,
        dy: (dy / distance) * maxSpeed
    };
}