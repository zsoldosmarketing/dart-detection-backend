import assert from 'node:assert/strict';

const moduleUrl = process.env.DARTS_ENGINE_MODULE;
if (!moduleUrl) {
  throw new Error('DARTS_ENGINE_MODULE must point to the compiled darts engine module.');
}

const { getSetupSuggestions } = await import(moduleUrl);

assert.deepEqual(getSetupSuggestions(100, 0), [], 'No setup advice is valid with zero darts remaining.');

const twoDartSuggestions = getSetupSuggestions(100, 2);
const t20WithTwoDarts = twoDartSuggestions.find(suggestion => suggestion.target === 'T20');
assert.ok(t20WithTwoDarts, 'T20 should be suggested from 100 with two darts left.');
assert.equal(t20WithTwoDarts.canFinishThisVisit, true, 'T20 leaves D20 with one dart remaining.');
assert.equal(t20WithTwoDarts.priority, 'high');

const oneDartSuggestions = getSetupSuggestions(100, 1);
const t20WithOneDart = oneDartSuggestions.find(suggestion => suggestion.target === 'T20');
assert.ok(t20WithOneDart, 'T20 should remain a valid setup target with one dart left.');
assert.equal(t20WithOneDart.canFinishThisVisit, false, 'A second dart is required to finish after T20 from 100.');

const threeDartSuggestions = getSetupSuggestions(181, 3);
assert.ok(threeDartSuggestions.every(suggestion => suggestion.canFinishThisVisit === false));

console.log('Setup suggestion regression tests passed.');
