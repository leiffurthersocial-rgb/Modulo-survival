import { useState, type ReactNode } from 'react';

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const K = ({ children }: { children: ReactNode }) => <span className="key">{children}</span>;

const SECTIONS: Section[] = [
  {
    id: 'goal',
    title: 'The goal',
    body: (
      <>
        <p>
          Something happened in the city. Sixteen classmates, all eighteen, made it out to the forest near Bülach with one supply bag and what was in their
          pockets. Nobody is coming to help.
        </p>
        <p>
          <b>Stay alive, and keep the group alive.</b> There is no score and no ending: every day you last is the achievement. You play one classmate; the
          other fifteen live on their own, with their own needs, skills and moods. They work, build, argue and help each other without you.
        </p>
        <p>
          New to the game? Follow the <b>First steps</b> list on the right side of the screen. It ticks itself off as you go, and it covers everything you need
          for the first night.
        </p>
      </>
    ),
  },
  {
    id: 'controls',
    title: 'Controls',
    body: (
      <>
        <table className="help-keys">
          <tbody>
            <tr><td><K>W</K><K>A</K><K>S</K><K>D</K> or arrows</td><td>Walk. Hold <K>Shift</K> to sprint (uses stamina).</td></tr>
            <tr><td><K>E</K> or <K>Space</K></td><td>Interact with the thing directly in front of you, if it is within reach (about a step and a half). Turn to face something to use it. With several choices a menu opens; pick with the number keys or a click.</td></tr>
            <tr><td>Mouse click</td><td>Interact with the thing you click on, if it is close.</td></tr>
            <tr><td><K>I</K> / <K>Tab</K></td><td>Bag: your inventory, clothing and anything you have open. Double-click food or a water bottle to eat or drink it instantly.</td></tr>
            <tr><td><K>K</K></td><td>Craft tools, food and supplies.</td></tr>
            <tr><td><K>B</K></td><td>Build: fires, shelters, latrine, storage.</td></tr>
            <tr><td><K>M</K></td><td>Map (pauses the game).</td></tr>
            <tr><td><K>G</K></td><td>Group: everyone's state, orders and expeditions.</td></tr>
            <tr><td><K>O</K></td><td>Camp overview: people, structures, stores.</td></tr>
            <tr><td><K>C</K></td><td>Your character: condition, skills, relationships.</td></tr>
            <tr><td><K>J</K></td><td>Journal of what has happened.</td></tr>
            <tr><td><K>Z</K></td><td>Sleep, or wake up. At night you sleep until morning; in daylight you can only nap when tired.</td></tr>
            <tr><td><K>T</K></td><td>Go to the toilet (uses a latrine if one is next to you).</td></tr>
            <tr><td><K>H</K></td><td>Set the Home Pin where you stand: the group makes camp there.</td></tr>
            <tr><td><K>L</K></td><td>Flashlight or torch on/off.</td></tr>
            <tr><td><K>F</K></td><td>Strike at an animal next to you.</td></tr>
            <tr><td><K>P</K> (or <K>Esc</K>)</td><td>Close a window, cancel building, or pause (save, load, settings).</td></tr>
            <tr><td><K>?</K></td><td>This guide.</td></tr>
          </tbody>
        </table>
        <p className="muted">Every key works on an iPad keyboard: no Esc or function keys needed. Letter keys follow what is printed on your keyboard, so they are right on Swiss and German layouts too. Without a keyboard, turn on touch controls in Settings.</p>
      </>
    ),
  },
  {
    id: 'screen',
    title: 'Reading the screen',
    body: (
      <>
        <p><b>Top left:</b> time, date, season, weather and temperature, and how many days you have been in the forest.</p>
        <p><b>Bottom left:</b> your needs. Full bars are good, except <b>Toilet</b>, which is bad when full. Colours go from green to yellow to red.</p>
        <p><b>Above the bars:</b> status effects such as Hungry, Soaked or Exhausted. Hover or tap one to see what it does to you.</p>
        <p><b>Bottom centre:</b> the prompt tells you what <K>E</K> will do with what you are facing, and a frame marks that thing in the world. Below it is the toolbar with every window.</p>
        <p><b>Top right:</b> the compass points back to camp once you have set a Home Pin. Under it is the First steps list.</p>
        <p><b>Bottom right:</b> messages about what just happened. Notes at the top of the screen explain a situation the first time it happens; click one to dismiss it.</p>
      </>
    ),
  },
  {
    id: 'needs',
    title: 'Your body',
    body: (
      <>
        <p>Everything is connected. Being cold burns food faster, wet clothes make you cold, hunger and exhaustion make you slow and clumsy, and clumsy people get hurt.</p>
        <ul>
          <li><b>Water:</b> the most urgent need. You last only a few days without it.</li>
          <li><b>Food:</b> when your stomach is empty your body lives off its reserves. That buys time, about two weeks, but you get weaker as they run down.</li>
          <li><b>Rest:</b> sleep at night. From an hour before sunset you can turn in, and you sleep through until first light unless cold, rain, thirst or a wound wakes you. In the day you can only nap when the Rest bar is low. Sleep is better in a shelter, on a bed of boughs or in a sleeping bag, and next to a fire.</li>
          <li><b>Warmth:</b> your core temperature. Stay dry, stay out of the wind, sit by a fire, wear warm clothes. Sleeping close to others shares warmth.</li>
          <li><b>Clean:</b> dirt raises the risk of illness and infected wounds. Wash in a stream. Clothes get dirty too; wash them on a mild day or by a fire, since they come back damp.</li>
          <li><b>Toilet:</b> go before it is urgent. A latrine keeps waste away from camp and water.</li>
          <li><b>Health:</b> falls from injuries, illness, cold, heat, hunger and thirst. Bandage wounds, rest, eat and keep warm to recover.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'water',
    title: 'Water and food',
    body: (
      <>
        <p>
          <b>Water</b> from streams, ponds and the lake may carry illness, especially downstream of camp waste. Drinking directly is quick but risky. Fill a
          bottle at the water (<K>E</K>), then <b>boil</b> it in a pot over a fire, or use purification tablets or a filter. Rain collectors give clean water.
        </p>
        <p>
          <b>Food:</b> the rations in the supply bag last a day or two. After that:
        </p>
        <ul>
          <li>Forage berries, wild garlic, nettles and mushrooms in season (unknown mushrooms can be poisonous).</li>
          <li>Fish with a rod (craft one from a branch, cordage and hooks).</li>
          <li>Hunt or set snares, then butcher and cook the meat.</li>
          <li>Search farmhouses, sheds and cars for tins, pasta and tools.</li>
          <li>Later: plant and water crops.</li>
        </ul>
        <p>Cook raw meat and fish at a fire through the Craft window. Food spoils over time, much faster in warm weather.</p>
      </>
    ),
  },
  {
    id: 'camp',
    title: 'Fire and camp',
    body: (
      <>
        <p>
          <b>Pick a spot</b> that is dry, near water and not too far from wood, and press <K>H</K>. The whole group heads there and starts working on the camp.
        </p>
        <p>
          <b>Build</b> (<K>B</K>): choose a structure, place it with <K>E</K> or a click, then work on the site with <K>E</K> until it is finished. While
          placing, the <b>Cancel building</b> button, <K>B</K>, <K>P</K> or right-click puts it away. While working on a site, <b>Stop</b> or <b>Cancel
          construction</b> (all materials back) appear under the progress bar. Dismantling a finished structure always asks first.
        </p>
        <ul>
          <li><b>Campfire:</b> warmth, light, cooking and boiling. Feed it branches or firewood. Light it with matches or a lighter; a fire that just went out can be blown back to life while the embers glow.</li>
          <li><b>Lean-to:</b> keeps the rain off and makes sleep much better.</li>
          <li><b>Latrine:</b> keeps waste out of camp and out of the water.</li>
          <li><b>Storage:</b> shared stockpiles. A woodpile takes only wood, a food store only food (it keeps food almost twice as long), a tool rack only tools. General chests take anything, or you can mark one for a single kind of thing (<K>E</K> on it). The others put things away where they belong and tidy misplaced items.</li>
        </ul>
        <p>Branches come from deadfall and from snapping dead branches off trees. With an axe you can fell trees for logs and firewood.</p>
      </>
    ),
  },
  {
    id: 'craft',
    title: 'Crafting and tools',
    body: (
      <>
        <p>
          The Craft window (<K>K</K>) lists every recipe. Those you can make right now are at the top; the rest show what is missing. Some need a tool (a knife,
          an axe) or a place (a fire for cooking, a workbench for planks).
        </p>
        <p>
          The supply bag holds a full kit: hatchet, hunting and pocket knives, folding saw, hammer and nails, shovel, gloves, pot, flashlight, matches and a
          lighter. When tools run short, make your own from what the forest gives: cordage from plant fibre, a knapped stone blade, stone axe and hammer,
          bow drill for fire, gorge hooks and a fishing rod, spear, digging stick, fibre torch, rope, split planks and wooden pegs in place of nails.
        </p>
        <p>Tools wear out. Better tools and higher skill make work faster and safer.</p>
      </>
    ),
  },
  {
    id: 'group',
    title: 'The group',
    body: (
      <>
        <p>
          The others decide for themselves what matters most: drinking, eating, staying warm, sleeping, then work. Each has traits (brave, anxious,
          hardworking, social and so on), skills and a background, so they are good at different things.
        </p>
        <p>
          In the <b>Group</b> window (<K>G</K>) you can see how everyone is doing and give broad orders: gather wood, fetch water, forage, build, cook, fish or
          hunt. You can also send people on <b>expeditions</b> to search places on the map.
        </p>
        <p>
          Face someone and press <K>E</K>: <b>Talk</b> lets you chat, comfort them when they are low, praise their work, ask about their life or apologise.
          <b>Look in their bag</b> shows what they carry: double-click their things to take them, or your own to give. Friends do not mind; others remember
          it, nobody gives up what they need, and rivals refuse. Going through a sleeper's bag is theft if they notice.
        </p>
        <p>
          Friendships and rivalries grow on their own. People comfort friends who are struggling, share food with the hungry, sometimes make up after a
          fight, and on good evenings the group gathers round the fire to sing or tell stories. Morale matters: hunger, cold, deaths and conflict wear people
          down; a warm fire, food and company lift them.
        </p>
      </>
    ),
  },
  {
    id: 'world',
    title: 'Seasons and exploring',
    body: (
      <>
        <p>
          A season lasts {14} days. Spring is mild and wet, summer is easy, autumn brings mushrooms and nuts, and winter is the real test: plan wood, food and
          warm clothes before it arrives.
        </p>
        <p>
          Weather changes through the day: rain soaks you, wind chills you, and storms bring both. Nights are dark; carry a light.
        </p>
        <p>
          The map (<K>M</K>) fills in as you and the others explore. Buildings, cars and old camps hold supplies, notes and clues to what happened.
        </p>
      </>
    ),
  },
  {
    id: 'death',
    title: 'Death and saving',
    body: (
      <>
        <p>
          Death is permanent for each character. If you die, you continue as any classmate who is still alive. Their body and belongings stay where they fell.
        </p>
        <p>
          <b>Normal</b> mode is forgiving with supplies and injuries. <b>Hardcore</b> has harsher needs, worse injuries and less loot.
        </p>
        <p>
          The game autosaves regularly and when you sleep. From the pause menu (<K>P</K>) you can save to three slots, load, and export your save to a file.
          Saves stay in this browser, so export them if you want a backup.
        </p>
      </>
    ),
  },
  {
    id: 'tips',
    title: 'First day tips',
    body: (
      <ol>
        <li>Open the supply bag first. Take the matches or lighter and a water bottle.</li>
        <li>Walk east until you find the stream. Drink, then fill your bottle.</li>
        <li>Choose a dry spot near the water and press <K>H</K>.</li>
        <li>Build a campfire and gather branches before evening. Light it at dusk.</li>
        <li>Build a lean-to. Sleep under it, next to the fire.</li>
        <li>Tomorrow: a latrine, storage, and start looking for food.</li>
        <li>When a bar turns yellow, deal with it before it turns red.</li>
      </ol>
    ),
  },
];

export function HowToPlay(props: { onClose: () => void; inGame?: boolean }) {
  const [sel, setSel] = useState(SECTIONS[0].id);
  const s = SECTIONS.find((x) => x.id === sel) ?? SECTIONS[0];
  const i = SECTIONS.indexOf(s);
  return (
    <div className="panel help-panel">
      <div className="panel-title">
        <h2>How to play</h2>
        <button className="ghost" onClick={props.onClose} aria-label="Close">
          X
        </button>
      </div>
      <div className="help-body">
        <nav className="help-nav">
          {SECTIONS.map((x) => (
            <button key={x.id} className={x.id === s.id ? 'on' : ''} onClick={() => setSel(x.id)}>
              {x.title}
            </button>
          ))}
        </nav>
        <div className="help-text">
          <h3>{s.title}</h3>
          {s.body}
          <div className="spread" style={{ marginTop: 14 }}>
            <button disabled={i === 0} onClick={() => setSel(SECTIONS[i - 1].id)}>
              Previous
            </button>
            {i < SECTIONS.length - 1 ? (
              <button className="primary" onClick={() => setSel(SECTIONS[i + 1].id)}>
                Next: {SECTIONS[i + 1].title}
              </button>
            ) : (
              <button className="primary" onClick={props.onClose}>
                {props.inGame ? 'Back to the game' : 'Done'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
