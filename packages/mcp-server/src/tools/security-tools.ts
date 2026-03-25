import { z } from 'zod';
import type { Orchestrator } from '@aurora-qa/core';
import { SecurityAgent, loadConfig } from '@aurora-qa/core';

export const ScanSecuritySchema = z.object({
  code: z.string().describe('Source code to scan for security vulnerabilities'),
  filePath: z.string().optional().describe('Path of the file being scanned'),
  language: z.string().optional().describe('Programming language'),
});

export const CheckDependenciesSchema = z.object({
  packageJsonPath: z.string().describe('Content of package.json to check for vulnerable dependencies'),
});

export function createSecurityTools(_orchestrator: Orchestrator) {
  return {
    scan_security: {
      description:
        'Scan source code for OWASP-aligned security vulnerabilities including SQL injection, XSS, secrets exposure, and auth issues.',
      inputSchema: ScanSecuritySchema,
      async handler(input: z.infer<typeof ScanSecuritySchema>) {
        const agent = new SecurityAgent(loadConfig());
        const report = await agent.generateSecurityReport(input.code, input.filePath);
        return {
          findingCount: report.findings.length,
          riskScore: report.riskScore,
          summary: report.summary,
          findings: report.findings.map(f => ({
            severity: f.severity,
            category: f.category,
            description: f.description,
            line: f.location.line,
            recommendation: f.recommendation,
            owaspCategory: f.owaspCategory,
          })),
        };
      },
    },

    check_dependencies: {
      description: 'Check package.json for insecure or unpinned dependencies.',
      inputSchema: CheckDependenciesSchema,
      async handler(input: z.infer<typeof CheckDependenciesSchema>) {
        const agent = new SecurityAgent(loadConfig());
        const findings = agent.scanForInsecureDependencies(input.packageJsonPath);
        return {
          findingCount: findings.length,
          findings: findings.map(f => ({
            severity: f.severity,
            description: f.description,
            recommendation: f.recommendation,
          })),
        };
      },
    },
  };
}
