import type { PrioritizedTest } from '../types/index.js';

interface TestInfo {
  id: string;
  name: string;
  filePath: string;
  executionTimeMs: number;
  tags?: string[];
  businessCriticality?: number; // 0-1
}

interface TestHistory {
  testId: string;
  results: Array<{ passed: boolean; timestamp: Date }>;
}

interface RiskFactor {
  changedFiles?: string[];
  recentlyFailed?: string[];
  criticalPaths?: string[];
}

export class TestPrioritizer {
  prioritize(
    tests: TestInfo[],
    changedFiles: string[],
    riskFactors: RiskFactor = {},
    history: TestHistory[] = [],
  ): PrioritizedTest[] {
    const historyMap = new Map(history.map(h => [h.testId, h]));

    return tests
      .map(test => {
        const changeProximity = this.calculateChangeProximity(test, changedFiles);
        const failureRate = this.calculateFailureRate(test.id, historyMap);
        const executionTime = this.normalizeExecutionTime(test.executionTimeMs, tests);
        const businessCriticality = test.businessCriticality ?? this.inferCriticality(test, riskFactors);

        const priority = Math.round(
          changeProximity * 40 +
          failureRate * 25 +
          (1 - executionTime) * 15 + // Faster tests get higher priority
          businessCriticality * 20,
        );

        return {
          testId: test.id,
          testName: test.name,
          priority: Math.min(100, Math.max(0, priority)),
          factors: { changeProximity, failureRate, executionTime, businessCriticality },
        };
      })
      .sort((a, b) => b.priority - a.priority);
  }

  getQuickSuite(
    tests: PrioritizedTest[],
    timeLimitMs: number,
    testTimeMap: Map<string, number>,
  ): PrioritizedTest[] {
    const suite: PrioritizedTest[] = [];
    let totalTime = 0;

    for (const test of tests) {
      const time = testTimeMap.get(test.testId) ?? 1000;
      if (totalTime + time <= timeLimitMs) {
        suite.push(test);
        totalTime += time;
      }
    }

    return suite;
  }

  predictFlakiness(testId: string, history: TestHistory[]): number {
    const testHistory = history.find(h => h.testId === testId);
    if (!testHistory || testHistory.results.length < 5) return 0;

    const results = testHistory.results.slice(-20); // Last 20 runs
    if (results.length < 2) return 0;

    let transitions = 0;

    for (let i = 1; i < results.length; i++) {
      if (results[i]!.passed !== results[i - 1]!.passed) {
        transitions++;
      }
    }

    // More transitions = more flaky
    return Math.min(1, transitions / (results.length - 1));
  }

  private calculateChangeProximity(test: TestInfo, changedFiles: string[]): number {
    if (changedFiles.length === 0) return 0;

    const testDir = test.filePath.split('/').slice(0, -1).join('/');

    for (const file of changedFiles) {
      // Same file
      if (test.filePath === file) return 1;

      // Same directory
      const fileDir = file.split('/').slice(0, -1).join('/');
      if (testDir === fileDir) return 0.8;

      // Related by naming convention (e.g., foo.ts ↔ foo.test.ts)
      const baseName = file.replace(/\.[^.]+$/, '');
      const baseFileName = baseName.split('/').pop() ?? '';
      if (test.filePath.includes(baseName) || test.name.toLowerCase().includes(baseFileName.toLowerCase())) {
        return 0.9;
      }

      // Same package
      const testParts = testDir.split('/');
      const fileParts = fileDir.split('/');
      const commonPrefix = testParts.filter((p, i) => fileParts[i] === p).length;
      const proximity = commonPrefix / Math.max(testParts.length, fileParts.length);
      if (proximity > 0.5) return proximity * 0.6;
    }

    return 0.1;
  }

  private calculateFailureRate(testId: string, historyMap: Map<string, TestHistory>): number {
    const history = historyMap.get(testId);
    if (!history || history.results.length === 0) return 0.5; // Unknown tests get medium priority

    const recent = history.results.slice(-10);
    const failures = recent.filter(r => !r.passed).length;
    return failures / recent.length;
  }

  private normalizeExecutionTime(timeMs: number, allTests: TestInfo[]): number {
    if (allTests.length === 0) return 0.5;
    const maxTime = Math.max(...allTests.map(t => t.executionTimeMs));
    if (maxTime === 0) return 0;
    return timeMs / maxTime;
  }

  private inferCriticality(test: TestInfo, riskFactors: RiskFactor): number {
    let criticality = 0.5;

    if (riskFactors.criticalPaths?.some(p => test.filePath.includes(p))) {
      criticality = 0.9;
    }

    if (riskFactors.recentlyFailed?.includes(test.id)) {
      criticality = Math.max(criticality, 0.8);
    }

    // Auth/payment/security tests are typically more critical
    const criticalTags = ['auth', 'payment', 'security', 'critical', 'smoke'];
    if (test.tags?.some(t => criticalTags.includes(t.toLowerCase()))) {
      criticality = Math.max(criticality, 0.85);
    }

    return criticality;
  }
}
