/**
 * Background mystery. One cause is chosen per world. Evidence is scattered
 * in containers and never forms a quest chain.
 */
export interface LoreCause {
  id: string;
  /** hidden summary, revealed only by piecing documents together */
  summary: string;
  docs: { id: string; title: string; text: string }[];
  radio: string[];
}

export const LORE_CAUSES: LoreCause[] = [
  {
    id: 'fever',
    summary: 'A fast-spreading respiratory illness overwhelmed hospitals within weeks. Cities were sealed, then abandoned.',
    docs: [
      { id: 'fever_1', title: 'Notice from the Canton', text: 'KANTON ZÜRICH - GESUNDHEITSDIREKTION\nAll residents of the districts of Bülach and Dielsdorf are instructed to remain at home. Gatherings of more than five people are prohibited. Report fever above 39 degrees to the hotline only. Do not come to the hospital.' },
      { id: 'fever_2', title: 'Torn newspaper page', text: '... the Federal Council confirmed that the Kloten field hospital has reached capacity. Army medical units are being withdrawn to ... "we are not in a position to say when" ... grey discolouration of the fingertips has been reported in ...' },
      { id: 'fever_3', title: 'Handwritten note', text: 'Mama, we went to Tante Ruth in Eglisau. Papa has the cough now. Do not follow us if you are sick. I love you. - M.' },
      { id: 'fever_4', title: 'Diary page', text: 'Day 11. No trains. The Migros is empty. Herr Baumann two houses down has not opened his shutters in four days. We keep the windows closed and the radio on. They keep saying stay home.' },
      { id: 'fever_5', title: 'Printed leaflet', text: 'SYMPTOMS: high fever, dry cough, grey or blue fingertips, confusion. If a household member shows symptoms, isolate them in a separate room. Boil all water. Wear a mask. Wait for instructions.' },
      { id: 'fever_6', title: 'Note pinned to a door', text: 'SICK INSIDE. DO NOT ENTER. Food left by the step is welcome. God bless.' },
      { id: 'fever_7', title: 'Forester\'s logbook', text: 'Stopped the rounds. Karl is ill. I have moved into the hut to keep away from the village. Drank from the spring, boiled. The deer are coming right up to the road now. Nobody drives any more.' },
    ],
    radio: [
      '... hospitals in Winterthur and Baden are no longer admitting ...',
      '... repeat, do not attempt to travel to Zurich. The city is closed ...',
      '... the number of new cases can no longer be ... [static] ...',
      '... if you can hear this, stay where you are. Boil your water. Help is ... [static]',
    ],
  },
  {
    id: 'blackout',
    summary: 'A continent-wide power grid failure cascaded into the collapse of water, fuel and food supply. Order broke down within weeks.',
    docs: [
      { id: 'blackout_1', title: 'Civil Protection notice', text: 'BEVÖLKERUNGSSCHUTZ - The power outage will continue for an indefinite period. Water pressure cannot be guaranteed. Use emergency supplies. Assemble at the designated emergency meeting point (Notfalltreffpunkt) of your municipality.' },
      { id: 'blackout_2', title: 'Newspaper fragment', text: '... third week without electricity across most of Europe. Grid operators describe damage to transformer stations as "systematic". Fuel deliveries have stopped. Supermarkets in Bülach were ...' },
      { id: 'blackout_3', title: 'Handwritten note', text: 'Pump station dead since the second day. Tanks lasted a week. We are walking to the Rhine. Take what you need from here but leave the seeds.' },
      { id: 'blackout_4', title: 'Diary page', text: 'The phones went first, then the water. Now there is shouting at night on the Hauptstrasse. Papa says the army is guarding the depots in Kloten. Nobody knows who ordered what anymore.' },
      { id: 'blackout_5', title: 'Maintenance log', text: 'Substation 14 - no remote telemetry. Manual isolation performed. Relay protection tripped in sequence at 03:12, 03:12, 03:13. Not a fault. Someone did this. Reported to Swissgrid, no answer.' },
      { id: 'blackout_6', title: 'List on cardboard', text: 'WATER 40L. RICE 8KG. CANDLES. BATTERIES (CHECK). LEAVE BY SUNDAY. DO NOT GO NEAR THE AIRPORT.' },
      { id: 'blackout_7', title: 'Forester\'s logbook', text: 'Village without power for 30 days. People are cutting the trees along the road for firewood. Went to the hut to watch over the forest. There is no point anymore.' },
    ],
    radio: [
      '... grid restoration is not expected in the coming ... [static]',
      '... emergency meeting points in the following municipalities ...',
      '... this is an automated message from ... fuel rationing is in effect ...',
      '... anyone with medical training please report to ... [static] ... Embrach ...',
    ],
  },
  {
    id: 'war',
    summary: 'A European war escalated with high-altitude detonations that destroyed electronics across the continent. Evacuations to shelters failed.',
    docs: [
      { id: 'war_1', title: 'Evacuation order', text: 'ARMEE / ZIVILSCHUTZ - Due to the security situation, residents are to report to their assigned civil protection shelter immediately. Bring: identification, blankets, food for 2 days, medication. Follow instructions of the civil protection personnel.' },
      { id: 'war_2', title: 'Newspaper fragment', text: '... flashes observed over southern Germany shortly after midnight. Communication networks across ... the Federal Council has declared ... neutrality will not protect us from the consequences ...' },
      { id: 'war_3', title: 'Handwritten note', text: 'The shelter in Bachenbülach was full. They turned us away. We are going into the Hardwald. If you find this, the car does not start. None of them do.' },
      { id: 'war_4', title: 'Diary page', text: 'Every car on the road just stopped. Phones dead. Even my watch. Helicopters the first day, then nothing. The sky was a strange colour for a week.' },
      { id: 'war_5', title: 'Military leaflet', text: 'Keep off the main roads. Do not approach military vehicles. Do not drink surface water near industrial sites. Listen to the radio on the hour.' },
      { id: 'war_6', title: 'Scrawled on a crate', text: 'FOR WHOEVER COMES NEXT. Everything here is yours. We are heading south to the mountains.' },
      { id: 'war_7', title: 'Forester\'s logbook', text: 'Machines dead. Chainsaw dead. Radio dead except for the old crank set. Heard the jets over Kloten and then silence. Moved to the hut.' },
    ],
    radio: [
      '... all civilians are to remain in shelters until further ...',
      '... [static] ... this is Beromünster emergency service ... [static]',
      '... ceasefire negotiations ... no ... [static] ... Geneva ...',
      '... do not approach the airport area. I repeat, do not ...',
    ],
  },
];

export const causeById = (id: string): LoreCause => LORE_CAUSES.find((c) => c.id === id) ?? LORE_CAUSES[0];

/** Documents not tied to the cause: survivors' traces. */
export const COMMON_DOCS = [
  { id: 'common_1', title: 'Scrawled map note', text: 'Spring below the old oak - good water. Pond by the north road - do not drink without boiling.' },
  { id: 'common_2', title: 'Recipe card', text: 'Bärlauchsuppe: two handfuls of wild garlic, potatoes, salt, water. Grandmother\'s way.' },
  { id: 'common_3', title: 'Hiking club flyer', text: 'Wanderverein Bülach - Sunday tour through the Hardwald, meeting point Grillstelle, bring your own sausages!' },
];
