const THRESHOLDS = Object.freeze({ quiet: 3, balanced: 2, attentive: 1 });
const DIGEST_EVENT_LIMIT = 6;
const DIGEST_THREAD_LIMIT = 4;

function followSet(followed) {
  return new Set(Array.isArray(followed) || followed instanceof Set ? followed : []);
}

function linkedIds(event) {
  return [
    ...(Array.isArray(event?.entities) ? event.entities : []),
    event?.settlementId,
    event?.decision?.actorId,
  ].filter(id => typeof id === 'string');
}

function isFollowed(event, followed) {
  return linkedIds(event).some(id => followed.has(id));
}

function recordsAtPresent(world) {
  return (world?.events ?? []).filter(event =>
    event && typeof event.id === 'string' && Number.isInteger(event.tick) && event.tick <= world.tick,
  );
}

/** A dramatic event elsewhere never overrides the player's declared interests. */
export function shouldStop(event, followed, attention = 'balanced') {
  const threshold = Object.hasOwn(THRESHOLDS, attention) ? THRESHOLDS[attention] : THRESHOLDS.balanced;
  return Number.isInteger(event?.severity) && event.severity >= threshold && event.severity <= 3
    && isFollowed(event, followSet(followed));
}

/**
 * Protected invariant: a digest selects recorded events and existing open threads.
 * It never creates scenes, predicts an outcome, or infers a motive from later state.
 * Array copies preserve the chronology and objects in the simulation's history.
 */
export function makeDigest(world, followed = [], lastSeenTick = 0) {
  const following = followSet(followed);
  const since = Number.isInteger(lastSeenTick) ? Math.max(0, Math.min(lastSeenTick, world.tick)) : 0;
  const recorded = recordsAtPresent(world);
  const recent = recorded.filter(event => event.tick > since);
  const eventIds = new Set(recorded.map(event => event.id));
  const openThreads = (world.threads ?? []).filter(thread =>
    thread.status === 'open' && eventIds.has(thread.eventId),
  );

  const events = recent.map((event, index) => ({ event, index }))
    .sort((a, b) =>
      Number(isFollowed(b.event, following)) - Number(isFollowed(a.event, following))
      || b.event.severity - a.event.severity
      || b.event.tick - a.event.tick
      || b.index - a.index,
    )
    .slice(0, DIGEST_EVENT_LIMIT)
    .map(item => item.event);

  const threads = openThreads.map((thread, index) => ({ thread, index }))
    .sort((a, b) =>
      Number((b.thread.entityIds ?? []).some(id => following.has(id)))
      - Number((a.thread.entityIds ?? []).some(id => following.has(id)))
      || a.index - b.index,
    )
    .slice(0, DIGEST_THREAD_LIMIT)
    .map(item => item.thread);

  const followedCount = recent.filter(event => isFollowed(event, following)).length;
  const developments = recent.length
    ? `${recent.length} recorded ${recent.length === 1 ? 'development' : 'developments'} since day ${since}.`
    : `No new recorded developments since day ${since}.`;
  const interests = recent.length && following.size
    ? ` ${followedCount} ${followedCount === 1 ? 'involves' : 'involve'} your follow list.`
    : '';
  const unresolved = openThreads.length
    ? ` ${openThreads.length} ${openThreads.length === 1 ? 'thread remains' : 'threads remain'} open.`
    : ' No recorded threads remain open.';

  return {
    title: recent.length ? 'Developments to revisit' : 'A quiet interval',
    summary: developments + interests + unresolved,
    events,
    threads,
  };
}

function findEntity(world, entityId) {
  if (world.power?.id === entityId) return world.power;
  for (const collection of ['regions', 'settlements', 'characters', 'routes', 'cultures', 'institutions', 'threads']) {
    const entity = (world[collection] ?? []).find(item => item.id === entityId);
    if (entity) return entity;
  }
  for (const settlement of world.settlements ?? []) {
    const structure = (settlement.structures ?? []).find(item => item.id === entityId);
    if (structure) return structure;
  }
  return null;
}

/** The history of a place includes its recorded foundation and surviving traces. */
export function relatedEvents(world, entityId) {
  const entity = findEntity(world, entityId);
  const references = new Set([
    entity?.eventId,
    ...['history', 'memories', 'knowledge'].flatMap(key => Array.isArray(entity?.[key]) ? entity[key] : []),
  ].filter(id => typeof id === 'string'));
  return recordsAtPresent(world)
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => linkedIds(event).includes(entityId) || references.has(event.id))
    .sort((a, b) => b.event.tick - a.event.tick || b.index - a.index)
    .map(item => item.event);
}
