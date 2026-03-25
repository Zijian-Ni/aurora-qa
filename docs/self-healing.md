# Self-Healing Tests

The `HealerAgent` provides Aurora QA's self-healing capability. It automatically analyzes test failures, classifies their root causes, suggests fixes, applies patches, and learns from outcomes to improve over time.

## How It Works

```
Test Failure
     │
     ▼
┌─────────────────────┐
│  1. Analyze Failure  │  ← Error message, stack trace, context, optional screenshot
│     (AI reasoning)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  2. Classify Cause   │  ← selector_stale, timing_race, env_flakiness,
│                      │     logic_change, data_dependency, unknown
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  3. Suggest Fix      │  ← Strategy name, description, confidence score,
│                      │     optional code patch
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  4. Apply Patch      │  ← Modify test code automatically
│     (if confident)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  5. Learn Outcome    │  ← Success/failure feedback stored in KnowledgeBase
│                      │
└─────────────────────┘
```

## Failure Classification

When a test fails, the HealerAgent first classifies the root cause into one of six categories:

### `selector_stale`

UI element selectors that no longer match the DOM. Common after frontend refactors that change element structure, class names, or IDs.

**Typical error patterns:**
- `Element not found: #submit-btn`
- `Unable to find role="button" with name "Submit"`
- `Timeout waiting for selector .modal-content`

**Healing strategies:**
- Regenerate selectors using semantic targeting (role, label, test ID)
- Broaden selectors to be more resilient (partial text match)
- Update test IDs in both source and test code

### `timing_race`

Race conditions or timing-dependent failures. The test asserts before an async operation completes, or system timing varies between environments.

**Typical error patterns:**
- `Expected element to be visible` (but it appears after a delay)
- `Received: undefined` (data not yet loaded)
- Intermittent pass/fail on the same test

**Healing strategies:**
- Add explicit `waitFor` or `waitForSelector` calls
- Increase timeout thresholds
- Replace polling with event-based assertions
- Add retry logic for async assertions

### `env_flakiness`

Environment-specific issues where the test passes locally but fails in CI, or vice versa.

**Typical error patterns:**
- Different behavior on Linux vs. macOS
- Port conflicts in CI
- Missing environment variables
- Network-dependent tests failing in sandboxed environments

**Healing strategies:**
- Mock external dependencies
- Use environment-agnostic assertions
- Add setup/teardown for environment normalization

### `logic_change`

An intentional code change that requires corresponding test updates. The test itself is not broken; the expected behavior has legitimately changed.

**Typical error patterns:**
- `Expected: "old value", Received: "new value"`
- API response shape changed
- Feature flag toggled

**Healing strategies:**
- Update expected values to match new behavior
- Adjust assertions to match new API contracts
- Flag for human review when confidence is low

### `data_dependency`

Test data assumptions that are no longer valid. The test depends on specific database state, fixture data, or external service responses that have changed.

**Typical error patterns:**
- `User with ID 42 not found`
- `Expected array of length 5, received 3`
- Tests pass only in a specific execution order

**Healing strategies:**
- Generate fresh test data in setup
- Use factories or builders instead of fixed fixtures
- Isolate test data per test case

### `unknown`

The root cause cannot be determined with sufficient confidence. These cases are flagged for human review.

## Fix Suggestion

After classification, the HealerAgent generates a `HealingSuggestion`:

```typescript
interface HealingSuggestion {
  fix: string;         // Human-readable description of the fix
  confidence: number;  // 0-1 confidence score
  strategy: string;    // Named strategy (e.g., "add-wait-for", "update-selector")
  patch?: {
    code: string;      // Code patch to apply
  };
}
```

### Confidence Thresholds

| Confidence | Action                                      |
|------------|---------------------------------------------|
| > 0.8      | Auto-apply the fix                          |
| 0.5 - 0.8  | Suggest the fix, require human approval    |
| < 0.5      | Flag for manual review                      |

## Applying Fixes

The `applyFix` method applies a code patch to a test case:

```typescript
const { classification, suggestion } = await healer.analyzeFailure(
  error.message,
  { testFile: 'login.spec.ts', line: 42, stack: error.stack },
);

if (suggestion.confidence > 0.8 && suggestion.patch) {
  const result = healer.applyFix(suggestion.patch, { name: 'login test' });
  console.log(result); // { applied: true, result: 'Patch applied to test: login test' }
}
```

## Learning from Outcomes

The HealerAgent improves over time by recording whether each fix actually resolved the failure.

### Recording Outcomes

```typescript
// After applying a fix, re-run the test and record the result
const testPassed = true; // result of re-running the test

healer.learnFromOutcome(suggestion, testPassed, {
  testFile: 'login.spec.ts',
  classification: 'selector_stale',
  environment: 'ci',
});
```

### Knowledge Storage

When a `KnowledgeBase` is provided, each outcome is stored as a `fix-recipe` entry:

```
Healing: update-selector — Replace #submit-btn with getByRole('button', { name: 'Submit' }) (succeeded)
```

These entries are tagged with the strategy name and success/failure status. Future classification and suggestion runs can query the knowledge base to find strategies that worked in similar contexts.

### Healing Stats

Track healing effectiveness over time:

```typescript
const stats = healer.getHealingStats();
console.log(stats);
// {
//   totalAttempts: 47,
//   successRate: 0.83,
//   topStrategies: [
//     { strategy: 'add-wait-for', count: 15, successRate: 0.93 },
//     { strategy: 'update-selector', count: 12, successRate: 0.83 },
//     { strategy: 'mock-external', count: 8, successRate: 0.75 },
//     ...
//   ]
// }
```

## Integration with CI/CD

### Automatic Healing in GitHub Actions

```yaml
- name: Run tests
  id: test
  run: pnpm test
  continue-on-error: true

- name: Self-heal failing tests
  if: steps.test.outcome == 'failure'
  run: |
    npx tsx scripts/self-heal.ts \
      --test-output=test-results.json \
      --auto-apply-threshold=0.8

- name: Re-run healed tests
  if: steps.test.outcome == 'failure'
  run: pnpm test
```

### Healing Reports

The HealerAgent can generate structured reports of all healing actions taken:

```json
{
  "run": "2026-03-25T10:30:00Z",
  "failures_analyzed": 5,
  "fixes_applied": 3,
  "fixes_succeeded": 3,
  "fixes_deferred": 2,
  "details": [
    {
      "test": "login.spec.ts:42",
      "classification": "selector_stale",
      "strategy": "update-selector",
      "confidence": 0.92,
      "applied": true,
      "succeeded": true
    }
  ]
}
```

## Best Practices

1. **Always provide context**: include the full error message, stack trace, test file path, and line number when calling `analyzeFailure`.
2. **Set appropriate thresholds**: start with a high auto-apply threshold (0.8+) and lower it as you gain confidence in the healer.
3. **Review deferred fixes**: regularly check fixes with confidence < 0.5 to understand recurring failure patterns.
4. **Monitor stats**: track `getHealingStats()` over time to identify which strategies are most effective.
5. **Provide screenshots**: for UI test failures, passing a base64 screenshot significantly improves classification accuracy.
6. **Connect the KnowledgeBase**: the healer improves dramatically when it can learn from past outcomes.
