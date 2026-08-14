import assert from 'node:assert/strict';

const moduleUrl = process.env.DARTS_ENGINE_MODULE;
if (!moduleUrl) {
  throw new Error('DARTS_ENGINE_MODULE must point to the compiled darts engine module.');
}

const { getCheckoutRoutes, getScore, parseTarget } = await import(moduleUrl);

for (let remaining = 2; remaining <= 170; remaining++) {
  const routes = getCheckoutRoutes(remaining);
  for (const route of routes) {
    assert.ok(route.darts.length >= 1 && route.darts.length <= 3, `Invalid dart count for ${remaining}.`);
    assert.equal(
      route.darts.reduce((total, target) => total + getScore(target), 0),
      remaining,
      `Route ${route.description} must total ${remaining}.`,
    );
    for (const target of route.darts) {
      assert.equal(parseTarget(target), target, `Route ${route.description} contains an invalid target: ${target}.`);
    }
    const finish = route.darts.at(-1);
    assert.ok(finish === 'BULL' || finish.startsWith('D'), `Route ${route.description} must finish on a double or bull.`);
  }
}

assert.deepEqual(getCheckoutRoutes(169), [], '169 is a bogey number and must not show a finish.');
assert.ok(getCheckoutRoutes(170).some(route => route.description === 'T20 -> T20 -> BULL'));
assert.ok(getCheckoutRoutes(100).every(route => !route.description.includes('D23')));

console.log('Checkout route regression tests passed.');
