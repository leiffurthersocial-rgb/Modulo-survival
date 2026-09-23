import { useState } from 'react';
import type { GameSession } from '../session';
import { ItemSlot, Panel, useSession } from '../common';
import { itemDef } from '@/content/items';
import { objectDef } from '@/content/objects';
import type { EquipSlot, ItemStack } from '@/sim/types';
import { addItem, carryCapacity, describeStack, totalWeight, slotCapacity } from '@/sim/inventory';
import { consumeNow, itemActions, unequip } from '@/sim/interactions';
import { boxAccepts, boxPurpose, STORAGE_TYPES } from '@/sim/storage';
import { ensureLoot } from '@/sim/loot';

const EQUIP: [EquipSlot, string][] = [
  ['head', 'Head'],
  ['outer', 'Jacket'],
  ['torso', 'Shirt'],
  ['legs', 'Legs'],
  ['feet', 'Feet'],
  ['hands', 'Hands'],
  ['back', 'Back'],
  ['hand', 'Held'],
];

type Sel = { from: 'inv' | 'eq' | 'box' | 'person'; i: number | EquipSlot } | null;

export function InventoryPanel({ session }: { session: GameSession }) {
  useSession(session);
  const g = session.game;
  const p = g.player;
  const [sel, setSel] = useState<Sel>(null);
  const box = session.ui.container !== undefined ? g.state.objects[session.ui.container] : undefined;
  const boxInRange = box && Math.hypot(box.x + 0.5 - p.x, box.y + 0.5 - p.y) < 3.2;
  const person = session.ui.person ? g.state.characters[session.ui.person] : undefined;
  const personInRange = !!person?.alive && Math.hypot(person.x - p.x, person.y - p.y) < 3.2;
  const takeFromPerson = (i: number) => {
    if (!person || !personInRange) return;
    const s = person.inventory[i];
    if (!s) return;
    if (!g.social.takeFromPerson(p, person, i)) return session.bump();
    person.inventory[i] = addItem(p.inventory, s);
    session.bump();
  };
  const giveToPerson = (i: number) => {
    if (!person || !personInRange) return;
    const s = p.inventory[i];
    if (!s) return;
    const left = addItem(person.inventory, s);
    if (left && left.qty === s.qty) return session.toast(`${person.name} has no room for that.`, 'warn');
    p.inventory[i] = left;
    g.social.giveToPerson(p, person, s);
    session.bump();
  };
  if (box && boxInRange) ensureLoot(g, box);
  const close = () => session.openPanel(null);

  const selStack: ItemStack | null | undefined =
    sel?.from === 'inv'
      ? p.inventory[sel.i as number]
      : sel?.from === 'eq'
        ? p.equipment[sel.i as EquipSlot]
        : sel?.from === 'box'
          ? box?.inv?.[sel.i as number]
          : sel?.from === 'person'
            ? person?.inventory[sel.i as number]
            : undefined;

  const weight = totalWeight(p);
  const cap = carryCapacity(p);

  const moveToBox = (i: number) => {
    if (!box?.inv) return;
    const s = p.inventory[i];
    if (!s) return;
    if (!boxAccepts(box, s.id)) {
      session.toast(`The ${objectDef(box.type).name.toLowerCase()} is for ${boxPurpose(box).toLowerCase()}.`, 'warn');
      return;
    }
    const left = addItem(box.inv, s);
    p.inventory[i] = left;
    if (box.type === 'pile' && left) box.inv.push(left), (p.inventory[i] = null);
    session.bump();
  };
  const takeFromBox = (i: number) => {
    if (!box?.inv) return;
    const s = box.inv[i];
    if (!s) return;
    const left = addItem(p.inventory, s);
    box.inv[i] = left;
    if (!left && box.type === 'pile' && box.inv.every((x) => !x)) {
      g.index.removeObject(box.id);
      session.ui.container = undefined;
    }
    if (left) session.toast('No room in your inventory.', 'warn');
    session.bump();
  };
  const takeAll = () => {
    if (!box?.inv) return;
    for (let i = 0; i < box.inv.length; i++) if (box.inv[i]) {
      const left = addItem(p.inventory, box.inv[i]!);
      box.inv[i] = left;
    }
    box.inv = box.inv.filter((s, i) => s || i < (objectDef(box.type).container ?? 8));
    if (box.type === 'pile' && box.inv.every((x) => !x)) {
      g.index.removeObject(box.id);
      session.ui.container = undefined;
    }
    session.bump();
  };

  const actions = sel?.from === 'inv' && selStack ? itemActions(g, p, sel.i as number) : [];

  return (
    <Panel title={box && boxInRange ? `Inventory and ${box.type === 'corpse' ? `${box.label}'s belongings` : objectDef(box.type).name}` : person && personInRange ? `Inventory and ${person.name}'s bag` : 'Inventory'} onClose={close}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div className="col" style={{ minWidth: 300 }}>
          <div className="spread">
            <h3>{p.name}</h3>
            <span className={weight > cap ? 'bad' : weight > cap * 0.85 ? 'warn' : 'muted'}>
              {weight.toFixed(1)} / {cap.toFixed(0)} kg
            </span>
          </div>
          <div className="slots" style={{ maxWidth: 6 * 63 }}>
            {p.inventory.map((s, i) => (
              <ItemSlot
                key={i}
                stack={s}
                selected={sel?.from === 'inv' && sel.i === i}
                label={i >= 8 ? 'pack' : undefined}
                onClick={() => setSel({ from: 'inv', i })}
                onDoubleClick={() => {
                  // double-click food or a drink to consume it on the spot; with a box open it moves the item
                  if (box && boxInRange) moveToBox(i);
                  else if (person && personInRange) giveToPerson(i);
                  else if (consumeNow(g, p, i)) session.bump();
                }}
              />
            ))}
          </div>
          <span className="faint" style={{ fontSize: '0.85em' }}>
            {p.inventory.filter(Boolean).length}/{slotCapacity(p)} slots. {weight > cap ? 'Overloaded: you move slowly and tire fast.' : 'Double-click food or a bottle to eat or drink at once.'}
          </span>
          <h3 style={{ marginTop: 6 }}>Worn and carried</h3>
          <div className="slots" style={{ maxWidth: 6 * 63 }}>
            {EQUIP.map(([slot, label]) => (
              <ItemSlot key={slot} stack={p.equipment[slot]} label={label} selected={sel?.from === 'eq' && sel.i === slot} onClick={() => setSel({ from: 'eq', i: slot })} />
            ))}
          </div>
        </div>

        {box && boxInRange && box.inv && (
          <div className="col" style={{ minWidth: 260 }}>
            <div className="spread">
              <h3>{box.type === 'corpse' ? box.label : objectDef(box.type).name}</h3>
              <button onClick={takeAll}>Take all</button>
            </div>
            {STORAGE_TYPES.includes(box.type) && <span className="faint" style={{ fontSize: '0.85em' }}>For: {boxPurpose(box)}</span>}
            <div className="slots" style={{ maxWidth: 5 * 63 }}>
              {box.inv.map((s, i) => (
                <ItemSlot key={i} stack={s} selected={sel?.from === 'box' && sel.i === i} onClick={() => setSel({ from: 'box', i })} onDoubleClick={() => takeFromBox(i)} />
              ))}
            </div>
            <span className="faint" style={{ fontSize: '0.85em' }}>
              Double-click to move items.
            </span>
          </div>
        )}

        {person && personInRange && (
          <div className="col" style={{ minWidth: 260 }}>
            <div className="spread">
              <h3>{person.name}'s bag</h3>
              <span className={opinionTone(g.social.get(person.id, p.id).affinity)}>{opinionWord(g.social.get(person.id, p.id).affinity)}</span>
            </div>
            <span className="faint" style={{ fontSize: '0.85em' }}>
              {person.sleeping ? 'Asleep. They might notice if you go through their things.' : 'Friends let you take things; others mind, and nobody gives up what they need.'}
            </span>
            <div className="slots" style={{ maxWidth: 5 * 63 }}>
              {person.inventory.map((s, i) => (
                <ItemSlot key={i} stack={s} selected={sel?.from === 'person' && sel.i === i} onClick={() => setSel({ from: 'person', i })} onDoubleClick={() => takeFromPerson(i)} />
              ))}
            </div>
            <h3 style={{ marginTop: 4 }}>Wearing</h3>
            <div className="slots" style={{ maxWidth: 5 * 63 }}>
              {EQUIP.map(([slot, label]) => (
                <ItemSlot key={slot} stack={person.equipment[slot]} label={label} />
              ))}
            </div>
            <span className="faint" style={{ fontSize: '0.85em' }}>Double-click their items to take them, or your own to give them.</span>
          </div>
        )}

        <div className="item-card col" style={{ width: 280 }}>
          {selStack ? (
            <>
              <h3>{itemDef(selStack.id).name}{selStack.qty > 1 ? ` x${selStack.qty}` : ''}</h3>
              <span className="muted">{itemDef(selStack.id).desc}</span>
              {describeStack(selStack) && <span>{describeStack(selStack)}</span>}
              <ItemFacts stack={selStack} />
              <div className="row" style={{ flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                {actions.map((a) => (
                  <button key={a.id} disabled={a.enabled === false} onClick={() => (a.run(), setSel(null), session.bump())}>
                    {a.label}
                  </button>
                ))}
                {sel?.from === 'eq' && (
                  <button onClick={() => (unequip(g, p, sel.i as EquipSlot), setSel(null), session.bump())}>Take off</button>
                )}
                {sel?.from === 'person' && (
                  <button className="primary" onClick={() => (takeFromPerson(sel.i as number), setSel(null))}>
                    Take
                  </button>
                )}
                {sel?.from === 'inv' && person && personInRange && (
                  <button onClick={() => (giveToPerson(sel.i as number), setSel(null))}>Give to {person.name}</button>
                )}
                {sel?.from === 'inv' && box && boxInRange && (
                  <button onClick={() => (moveToBox(sel.i as number), setSel(null))}>Store</button>
                )}
                {sel?.from === 'box' && (
                  <button className="primary" onClick={() => (takeFromBox(sel.i as number), setSel(null))}>
                    Take
                  </button>
                )}
              </div>
            </>
          ) : (
            <span className="faint">Select an item.</span>
          )}
        </div>
      </div>
    </Panel>
  );
}

function ItemFacts({ stack }: { stack: ItemStack }) {
  const d = itemDef(stack.id);
  const facts: string[] = [`${(d.weight * stack.qty).toFixed(2)} kg`];
  if (d.food) facts.push(`${d.food.kcal} kcal`);
  if (d.clothing) facts.push(`warmth ${d.clothing.warmth}`, `rain ${Math.round(d.clothing.waterproof * 100)}%`);
  if (d.backpack) facts.push(`+${d.backpack.slots} slots, +${d.backpack.carry} kg`);
  if (d.weapon) facts.push(`damage ${d.weapon.damage}`);
  if (d.fuel) facts.push(`burns ${d.fuel} min`);
  if (d.liquidCapacity) facts.push(`holds ${d.liquidCapacity / 1000} L`);
  return <span className="faint" style={{ fontSize: '0.85em' }}>{facts.join('  |  ')}</span>;
}

function opinionWord(a: number): string {
  return a >= 60 ? 'Close friend' : a >= 35 ? 'Friend' : a >= 10 ? 'Friendly' : a > -10 ? 'Neutral' : a > -25 ? 'Cool towards you' : 'Hostile';
}
function opinionTone(a: number): string {
  return a >= 35 ? 'good' : a > -10 ? 'muted' : 'bad';
}
