/**
 * Telur's Strategy: Hunt the Weakest
 * Telur will always move toward the player with the lowest HP
 * This is an aggressive, predatory strategy
 */
export default function(context) {
    const { me, others, maxSpeed } = context;
    
    // If Telur is the only one alive, just stay put
    if (others.length === 0) {
        return { dx: 0, dy: 0 };
    }
    
    // Find the player with the lowest HP (excluding self)
    let target = null;
    let lowestHp = Infinity;
    
    for (let player of others) {
        if (player.hp < lowestHp) {
            lowestHp = player.hp;
            target = player;
        }
    }
    
    // If no target found (shouldn't happen), don't move
    if (!target) {
        return { dx: 0, dy: 0 };
    }
    
    // Calculate direction to the weakest player
    const dx = target.x - me.x;
    const dy = target.y - me.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    // If already on top of the target, stay put
    if (distance < 0.05) {
        return { dx: 0, dy: 0 };
    }
    
    // Move toward the weakest player at maximum speed
    return {
        dx: (dx / distance) * maxSpeed,
        dy: (dy / distance) * maxSpeed
    };
}