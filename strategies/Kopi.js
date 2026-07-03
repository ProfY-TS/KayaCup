// strategies/Kopi.js
export default function(context) {
    console.log("🧠 KOPI STRATEGY IS RUNNING!");
    
    const { me, npcs, maxSpeed } = context;
    
    // Find Butter
    let butter = null;
    for (let npc of npcs) {
        if (npc.name === "Butter") {
            butter = npc;
            break;
        }
    }
    
    if (!butter) {
        console.warn("Butter not found!");
        return { dx: 0, dy: 0 };
    }
    
    const dx = butter.x - me.x;
    const dy = butter.y - me.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if (distance < 0.05) {
        return { dx: 0, dy: 0 };
    }
    
    console.log(`Kopi moving toward Butter, distance: ${distance.toFixed(3)}`);
    
    return {
        dx: (dx / distance) * maxSpeed,
        dy: (dy / distance) * maxSpeed
    };
}