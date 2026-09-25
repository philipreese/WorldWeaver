import { GUIDE_STEP_IDS } from './customization.js';
import { getInterventions } from './sim/world.js';

const CHAPTERS = Object.freeze({
  meet: 'Meet the neighbors', style: 'Meet the neighbors',
  watch: 'Notice what changes', why: 'Notice what changes',
  possibility: 'Try another possibility', branch: 'Try another possibility',
});
const INTERVENTION_EVENTS = new Set(['passage-opened', 'relic-exposed', 'spring-restored', 'refuge-possible']);
const POSSIBILITY_COPY = Object.freeze({
  'open-route': ['Open the path', 'The Silt Saddle can carry a path between Hearth and Lattice. People decide what to do with the connection.'],
  'reveal-relic': ['Uncover the chamber', 'There is a chamber under the silt at Old Hollow. Uncovering it would let someone take a closer look.'],
  'restore-habitat': ['Restore the spring', 'Water can reach Hearth’s old garden channels again. What might the neighbors do with it?'],
  'offer-refuge': ['Make room', 'The shared channels can support new neighbors by the river. Make room, then see whether anyone chooses to move.'],
});

function records(world) {
  return (world.events ?? []).filter(event => Number.isInteger(event.tick) && event.tick <= world.tick);
}

function localPlace(world, targetId) {
  const route = (world.routes ?? []).find(item => item.id === targetId);
  return (world.settlements ?? []).find(place =>
    place.id === targetId || place.id === route?.from || (place.structures ?? []).some(item => item.id === targetId),
  );
}

function card(id, values) {
  return { id, chapter: CHAPTERS[id], ...values };
}

/**
 * Return one optional action, never execute it or infer that the player did it.
 * `guide` is persisted {version,completed,dismissed}, plus optional transient
 * context {historical,branchLimitReached}. Never persist that context.
 *
 * Actions: inspect/style use targetId; advance allows exactly days:1; event
 * uses eventId (why also openExplanation:true); possibilities opens the dialog
 * for settlementId and identifies an available intervention without applying it.
 * Timeline uses tick and comparisonOnly; it never creates a branch.
 * Historical mutation steps instead offer a safe inspection and point to the
 * existing Return to present control. They keep their original, unfinished ID.
 */
export function getGuideStep(world, guide = {}) {
  if (!world || guide?.dismissed === true) return null;
  const completed = new Set(Array.isArray(guide?.completed) ? guide.completed : []);
  const id = GUIDE_STEP_IDS.find(step => !completed.has(step));
  if (!id) return null;
  const person = (world.characters ?? []).find(item => item.id === 'c-nera' && item.alive !== false)
    ?? (world.characters ?? []).find(item => item.alive !== false);
  const place = (world.settlements ?? []).find(item => item.id === person?.settlementId)
    ?? (world.settlements ?? [])[0];
  if (!person && !place) return null;
  const targetId = person?.id ?? place.id;
  const events = records(world);
  const choice = events.find(event => event.kind === 'seed-decision' && event.decision);
  const historical = guide?.context?.historical === true;

  if (id === 'meet') return card(id, {
    title: person ? `Meet ${person.name}` : `Visit ${place.name}`,
    text: person?.id === 'c-nera'
      ? 'Nera counts plates before people. Take a look around and get to know her.'
      : 'Pick someone or somewhere to get to know. You can take your time.',
    action: 'inspect', label: person ? `Meet ${person.name}` : `Visit ${place.name}`, targetId,
  });

  if (historical && (id === 'style' || id === 'possibility' || ((id === 'watch' || id === 'why') && !choice))) {
    return card(id, {
      title: 'A visit to an earlier day',
      text: 'You can look around this day without changing it. Choose Return to present when you want to continue your visit.',
      action: 'inspect', label: 'Keep looking around', targetId, readOnly: true,
    });
  }

  if (id === 'style') return card(id, {
    title: 'A little color, if you like',
    text: 'Try a color or a small decoration, or leave things as they are. The neighbors still make their own choices.',
    action: person ? 'style' : 'inspect', label: person ? 'Try a look' : 'Look around', targetId,
  });

  if (id === 'watch' && choice) return card(id, {
    title: 'A moment already in the story',
    text: `“${choice.title}” has already happened in this history. Take a look whenever you like.`,
    action: 'event', label: 'See what changed', eventId: choice.id, targetId: choice.settlementId,
  });

  if (id === 'why' && choice) return card(id, {
    title: 'What mattered to Nera?',
    text: 'Look inside this choice: what she knew, what she cared about, and what else she could have done.',
    action: 'event', label: 'Why did this happen?', eventId: choice.id, targetId: choice.decision.actorId,
    openExplanation: true,
  });

  if (id === 'watch' || id === 'why') return card(id, {
    title: id === 'watch' ? 'Let one day unfold' : 'A moment to wonder about',
    text: 'Let one day pass and notice what changes. The neighbors choose their own answers; you can pause and look around any time.',
    action: 'advance', label: '+1 day', days: 1,
  });

  if (id === 'possibility') {
    const available = getInterventions(world).find(option => option.available);
    if (available) {
      const [title, text] = POSSIBILITY_COPY[available.kind] ?? [available.title, available.description];
      return card(id, {
        title, text, action: 'possibilities', label: 'Lend a hand',
        targetId: available.targetId, settlementId: localPlace(world, available.targetId)?.id,
        interventionId: available.id, interventionKind: available.kind,
      });
    }
    const earlier = events.findLast(event => INTERVENTION_EVENTS.has(event.kind));
    if (earlier) return card(id, {
      title: 'A possibility from earlier',
      text: 'There is no new way to lend a hand right now. You can revisit an earlier change and see what followed.',
      action: 'event', label: 'Revisit a change', eventId: earlier.id, targetId: earlier.settlementId,
    });
    return card(id, {
      title: 'Room to look around', text: 'There is no available change right now. Visit a place or come back to this later.',
      action: 'inspect', label: 'Look around', targetId: place?.id ?? targetId,
    });
  }

  let tick = Math.max(0, Math.min(2, choice ? choice.tick - 1 : world.tick - 1, world.tick));
  // Timeline snapshots include interventions performed on their selected day.
  // Visit an earlier day when the path already opened before this suggested fork.
  const opening = events.find(event => event.kind === 'passage-opened' && event.tick > 0 && event.tick <= tick);
  if (opening) tick = opening.tick - 1;
  const comparisonOnly = guide?.context?.branchLimitReached === true || world.tick === 0;
  return card(id, {
    title: 'Could it have gone another way?',
    text: guide?.context?.branchLimitReached
      ? 'This world has no room for another branch. You can still visit and compare earlier days.'
      : world.tick === 0
        ? 'This is the first day of the story. As more days unfold, you can come back and compare them.'
        : 'Visit an earlier day and notice what was different. Branch here lets you try another future while keeping the original.',
    action: 'timeline', label: `Visit day ${tick}`, tick, comparisonOnly,
  });
}

/** A small invitation to notice something already present; no score or prediction. */
export function getCuriosityPrompt(world) {
  if (!world) return null;
  const events = records(world);
  const latest = kind => events.findLast(event => event.kind === kind);
  const power = latest('power-emerged');
  if (world.power && power) return {
    text: 'Could neighbors see the same change and tell different stories about it?',
    targetId: world.power.id, eventId: power.id,
  };
  const mixed = latest('mixed-refuge-settled');
  const mixedPlace = (world.settlements ?? []).find(place => place.population > 0 && place.synthetics > 0 && place.collective > 0);
  if (mixed && mixedPlace) return { text: 'Can neighbors need different things?', targetId: mixedPlace.id, eventId: mixed.id };
  const passage = events.findLast(event => ['passage-opened', 'inhabitants-open-route'].includes(event.kind) && world.tick - event.tick <= 3);
  const route = (world.routes ?? []).find(item => item.open && passage?.entities?.includes(item.id));
  if (passage && route) return { text: 'What might travel with a newly opened path?', targetId: route.id, eventId: passage.id };
  const channel = latest('common-channel-founded');
  if (channel && (world.institutions ?? []).some(item => item.id === 'i-confluence')) return {
    text: 'Who depends on whom when a channel is shared?', targetId: 'i-confluence', eventId: channel.id,
  };
  const seeds = latest('seed-decision');
  if (seeds) return { text: 'What did Nera give up to keep the seeds safe?', targetId: 'c-nera', eventId: seeds.id };
  const lesson = latest('mending-lesson');
  if (lesson) return { text: 'Why might someone keep a bent nail?', targetId: 'k-hearth-yard', eventId: lesson.id };
  const census = latest('three-forms-recorded');
  if (census) return { text: 'Can neighbors need different things?', targetId: 's-lattice', eventId: census.id };
  return null;
}
