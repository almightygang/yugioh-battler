import { Element, FieldState, PrimaryStatus } from "../types";

export const FIELD_DURATION = 5;

export const FieldRegistry: Record<string, { id: string; duration: number; description: string }> = {
  ZOMBIE_WORLD: {
    id: 'ZOMBIE_WORLD',
    duration: FIELD_DURATION,
    description: 'All monsters on the field become DARK attribute. Lasts 5 turns.',
  },
  MEGALITH_PORTAL: {
    id: 'MEGALITH_PORTAL',
    duration: FIELD_DURATION,
    description: 'Boosts EARTH and ROCK-type monsters. Lasts 5 turns.',
  },
};

export function getFieldElementOverride(field: FieldState | null): Element | null {
  if (!field) return null;
  if (field.id === 'ZOMBIE_WORLD') return Element.DARK;
  return null;
}

export function fieldDamageModifier(field: FieldState | null, moveElement: Element): number {
  if (!field) return 1.0;
  if (field.id === 'MEGALITH_PORTAL' && moveElement === Element.EARTH) return 1.3;
  return 1.0;
}

export function fieldDefenseModifier(field: FieldState | null, targetPrimaryStatus: PrimaryStatus): number {
  if (!field) return 1.0;
  if (field.id === 'MEGALITH_PORTAL' && targetPrimaryStatus === PrimaryStatus.PIERCED) return 0.75;
  return 1.0;
}
