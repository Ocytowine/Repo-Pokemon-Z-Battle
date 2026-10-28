import assert from "node:assert/strict";

const base = "http://127.0.0.1:8791/api/saves/1/manual";
const snapshot = { schemaVersion: 1, savedAt: Date.now(), eventState: {}, worldSave: null,
  player: null, newGame: null, fieldShortcuts: null };
const put = (expectedRevisionId, money) => fetch(base, { method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ expectedRevisionId, snapshot: { ...snapshot, eventState: { money } } }) });

const existing = await fetch(base);
const previous = existing.status === 404 ? null : (await existing.json()).head.revisionId;
const first = await put(previous, 100);
assert.equal(first.status, 201);
const firstHead = (await first.json()).head;
const conflict = await put(previous, 200);
assert.equal(conflict.status, 409, "a second device must not overwrite the first");
const second = await put(firstHead.revisionId, 300);
assert.equal(second.status, 201);
const latest = await fetch(base);
assert.equal(latest.status, 200);
assert.equal((await latest.json()).snapshot.eventState.money, 300);
const otherSlot = await fetch("http://127.0.0.1:8791/api/saves/2/manual");
assert.equal(otherSlot.status, 404, "a different slot must remain empty");

let autoRevision = null;
for (let index = 0; index < 34; index += 1) {
  const response = await fetch("http://127.0.0.1:8791/api/saves/1/auto", { method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ expectedRevisionId: autoRevision,
      snapshot: { ...snapshot, savedAt: snapshot.savedAt + index,
        eventState: { money: index } } }) });
  assert.equal(response.status, 201, `automatic revision ${index} must be accepted`);
  autoRevision = (await response.json()).head.revisionId;
}
const latestAuto = await fetch("http://127.0.0.1:8791/api/saves/1/auto");
assert.equal((await latestAuto.json()).snapshot.eventState.money, 33);
console.log("Local cloud smoke test passed: conflict, R2 read, independent slot, automatic revision retention.");
