"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAIMove = getAIMove;
exports.getAISlot = getAISlot;
function getAIMove(getActiveMon, getMonsterData, slot) {
    const mon = getActiveMon(slot);
    if (!mon)
        return null;
    const lockedMove = mon.lockedMoveId;
    if (lockedMove)
        return lockedMove;
    const schema = getMonsterData(mon.id);
    if (!schema || !schema.learnset.length)
        return null;
    const idx = Math.floor(Math.random() * schema.learnset.length);
    return schema.learnset[idx];
}
function getAISlot(state, side) {
    for (let i = 0; i <= 2; i = (i + 1)) {
        const mon = state[side].active[i];
        if (mon && mon.currentHP > 0)
            return { side, index: i };
    }
    return null;
}
