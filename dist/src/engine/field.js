"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldRegistry = exports.FIELD_DURATION = void 0;
exports.getFieldElementOverride = getFieldElementOverride;
exports.fieldDamageModifier = fieldDamageModifier;
exports.fieldDefenseModifier = fieldDefenseModifier;
const types_1 = require("../types");
exports.FIELD_DURATION = 5;
exports.FieldRegistry = {
    ZOMBIE_WORLD: {
        id: 'ZOMBIE_WORLD',
        duration: exports.FIELD_DURATION,
        description: 'All monsters on the field become DARK attribute. Lasts 5 turns.',
    },
    MEGALITH_PORTAL: {
        id: 'MEGALITH_PORTAL',
        duration: exports.FIELD_DURATION,
        description: 'Boosts EARTH and ROCK-type monsters. Lasts 5 turns.',
    },
};
function getFieldElementOverride(field) {
    if (!field)
        return null;
    if (field.id === 'ZOMBIE_WORLD')
        return types_1.Element.DARK;
    return null;
}
function fieldDamageModifier(field, moveElement) {
    if (!field)
        return 1.0;
    if (field.id === 'MEGALITH_PORTAL' && moveElement === types_1.Element.EARTH)
        return 1.3;
    return 1.0;
}
function fieldDefenseModifier(field, targetPrimaryStatus) {
    if (!field)
        return 1.0;
    if (field.id === 'MEGALITH_PORTAL' && targetPrimaryStatus === types_1.PrimaryStatus.PIERCED)
        return 0.75;
    return 1.0;
}
