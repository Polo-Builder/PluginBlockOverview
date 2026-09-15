import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { initialize, readState, setWeb, applyEco, restore } from "../settings.js";

let stored, rules, underlying, override, locked, failRules, failSet, failClear, changes;
beforeEach(() => {
  stored = {}; rules = []; underlying = true; override = undefined;
  locked = null; failRules = false; failSet = false; failClear = false; changes = 0;
  globalThis.chrome = {
    storage: { local: {
      get: async () => structuredClone(stored),
      set: async (value) => { stored = structuredClone(value); }
    } },
    declarativeNetRequest: {
      getDynamicRules: async () => structuredClone(rules),
      updateDynamicRules: async ({ addRules }) => {
        if (failRules) throw new Error("DNR failure");
        rules = structuredClone(addRules);
      }
    },
    privacy: { network: { networkPredictionEnabled: {
      get: async () => ({ value: locked ? underlying : (override ?? underlying),
        levelOfControl: locked ?? (override === undefined ? "controllable_by_this_extension" : "controlled_by_this_extension") }),
      set: async ({ value }) => { if (failSet) throw new Error("set failure"); override = value; changes++; },
      clear: async () => { if (failClear) throw new Error("clear failure"); override = undefined; }
    } } }
  };
});
test("installation ON ; OFF persiste au redémarrage", async () => {
  assert.equal((await initialize()).enabled, true);
  assert.equal(rules.length, 4);
  await setWeb(false);
  await initialize();
  assert.equal(rules.length, 0);
  assert.equal((await readState()).enabled, false);
});
test("bouton automatique idempotent, sauvegarde et restauration", async () => {
  await initialize(); await setWeb(false);
  const applied = await applyEco();
  assert.equal(applied.enabled, true);
  assert.equal(override, false);
  assert.equal(applied.backup.web, false);
  assert.equal(applied.backup.prediction.previousValue, true);
  await applyEco();
  assert.equal(changes, 1);
  const restored = await restore();
  assert.equal(restored.enabled, false);
  assert.equal(override, undefined);
  assert.deepEqual(restored.backup, {});
  assert.equal(rules.length, 0);
});
test("préchargement déjà OFF : aucune prise de contrôle", async () => {
  underlying = false;
  const state = await applyEco();
  assert.equal(changes, 0);
  assert.deepEqual(state.backup, {});
  await restore();
  assert.equal(underlying, false);
});
test("OFF désactive toutes les fonctions et libère le préchargement", async () => {
  await applyEco();
  assert.equal(override, false);
  const state = await setWeb(false);
  assert.equal(state.enabled, false);
  assert.equal(override, undefined);
  assert.deepEqual(state.backup, {});
  assert.equal(rules.length, 0);
});
for (const policy of ["not_controllable", "controlled_by_other_extensions"]) {
  test(`respecte ${policy}`, async () => {
    locked = policy;
    const state = await applyEco();
    assert.equal(changes, 0);
    assert.equal(state.report.applied.some((x) => x.includes("tout Chrome")), false);
    assert.equal(state.report.skipped.some((x) => x.includes("organisation")), true);
  });
}
test("restauration conserve un choix Chrome sous-jacent plus récent", async () => {
  await applyEco();
  underlying = false;
  await restore();
  assert.equal(override, undefined);
  assert.equal(underlying, false);
});
test("restauration ne reprend pas la priorité sur une autre extension", async () => {
  await applyEco(); locked = "controlled_by_other_extensions";
  await restore();
  assert.equal(override, undefined);
  assert.equal(locked, "controlled_by_other_extensions");
});
test("un choix Web manuel ultérieur prévaut sur la sauvegarde", async () => {
  await setWeb(false); await applyEco();
  await setWeb(false); await setWeb(true);
  await restore();
  assert.equal((await readState()).enabled, true);
});
test("échec DNR : retour à la préférence précédente", async () => {
  await initialize(); failRules = true;
  await assert.rejects(setWeb(false));
  assert.equal((await readState()).enabled, true);
  assert.equal(rules.length, 4);
});
test("échec privacy : jamais de faux succès, sauvegarde conservée", async () => {
  failSet = true;
  const state = await applyEco();
  assert.equal(state.report.applied.length, 1);
  assert.equal(state.report.skipped.some((x) => x.includes("non confirmée")), true);
  assert.ok(state.backup.prediction);
});
test("échec restauration : sauvegarde conservée pour réessayer", async () => {
  await applyEco(); failClear = true;
  const state = await restore();
  assert.equal(state.report.title, "Restauration incomplète");
  assert.ok(state.backup.prediction);
  failClear = false;
  assert.deepEqual((await restore()).backup, {});
});
test("réveil après interruption : réconcilie le mode Web journalisé", async () => {
  stored = { state: { enabled: false, backup: {}, report: null } };
  await initialize();
  assert.equal(rules.length, 0);
});
