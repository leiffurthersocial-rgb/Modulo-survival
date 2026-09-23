import type { AttributeId, SkillId, TraitId } from '@/sim/types';

export const SKILLS: { id: SkillId; name: string; desc: string }[] = [
  { id: 'survival', name: 'Survival', desc: 'Fire-making, shelter sense, reading the weather.' },
  { id: 'foraging', name: 'Foraging', desc: 'Finding and identifying wild food. Fewer mistakes with mushrooms.' },
  { id: 'cooking', name: 'Cooking', desc: 'Better meals, less waste, fewer upset stomachs.' },
  { id: 'crafting', name: 'Crafting', desc: 'Faster, more durable handmade tools.' },
  { id: 'construction', name: 'Construction', desc: 'Building speed and quality.' },
  { id: 'farming', name: 'Farming', desc: 'Healthier crops and larger harvests.' },
  { id: 'hunting', name: 'Hunting', desc: 'Stalking and striking game.' },
  { id: 'fishing', name: 'Fishing', desc: 'Catch rate and patience.' },
  { id: 'trapping', name: 'Trapping', desc: 'Snare placement and catch chance.' },
  { id: 'medicine', name: 'Medicine', desc: 'Understanding illness and recovery.' },
  { id: 'firstAid', name: 'First Aid', desc: 'Treating wounds quickly and cleanly.' },
  { id: 'mechanics', name: 'Mechanics', desc: 'Salvage and repairs.' },
  { id: 'navigation', name: 'Navigation', desc: 'Sense of direction. Improves the home bearing and map reading.' },
];
export const SKILL_IDS = SKILLS.map((s) => s.id);
export const skillName = (id: SkillId): string => SKILLS.find((s) => s.id === id)?.name ?? id;

export const ATTRIBUTES: { id: AttributeId; name: string; desc: string }[] = [
  { id: 'strength', name: 'Strength', desc: 'Carry capacity, chopping, heavy work, striking power.' },
  { id: 'endurance', name: 'Endurance', desc: 'Stamina pool, cold tolerance, long walks.' },
  { id: 'agility', name: 'Agility', desc: 'Movement speed, avoiding injury, hunting.' },
  { id: 'dexterity', name: 'Dexterity', desc: 'Crafting speed, fishing, fine work.' },
  { id: 'recovery', name: 'Recovery', desc: 'Healing rate, sleep efficiency, resisting illness.' },
  { id: 'constitution', name: 'Constitution', desc: 'Maximum health and resilience to hunger and thirst.' },
];
export const ATTR_IDS = ATTRIBUTES.map((a) => a.id);

export const TRAITS: Record<TraitId, { name: string; desc: string; opposite?: TraitId }> = {
  brave: { name: 'Brave', desc: 'Faces danger and volunteers for expeditions.', opposite: 'cautious' },
  cautious: { name: 'Cautious', desc: 'Avoids risk, returns early, dislikes bad weather.', opposite: 'brave' },
  hardworking: { name: 'Hardworking', desc: 'Keeps working when others rest.', opposite: 'lazy' },
  lazy: { name: 'Easygoing', desc: 'Rests more readily and works slower.', opposite: 'hardworking' },
  social: { name: 'Social', desc: 'Seeks company. Talks often. Lifts group morale.', opposite: 'introverted' },
  introverted: { name: 'Reserved', desc: 'Prefers quiet tasks and small company.', opposite: 'social' },
  curious: { name: 'Curious', desc: 'Wants to explore and find out what happened.' },
  practical: { name: 'Practical', desc: 'Prioritises camp needs over comfort.' },
  riskTaking: { name: 'Risk-taking', desc: 'Pushes on through danger and fatigue.', opposite: 'cautious' },
  compassionate: { name: 'Compassionate', desc: 'Shares food and cares for the injured.' },
  independent: { name: 'Independent', desc: 'Resists orders they disagree with.' },
  optimistic: { name: 'Optimistic', desc: 'Morale recovers faster.', opposite: 'anxious' },
  anxious: { name: 'Anxious', desc: 'Stress builds faster.', opposite: 'optimistic' },
  stubborn: { name: 'Stubborn', desc: 'Holds grudges. Slow to change their mind.' },
};
export const TRAIT_IDS = Object.keys(TRAITS) as TraitId[];
