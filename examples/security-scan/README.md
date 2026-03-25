# Security Scan Example

Demonstrates running Aurora QA's SecurityAgent on intentionally vulnerable code.

## Run

```bash
ANTHROPIC_API_KEY=sk-... npx tsx examples/security-scan/index.ts
```

## What it does

1. Scans `vulnerable-code.ts` which contains intentional vulnerabilities:
   - SQL Injection
   - XSS (innerHTML, eval)
   - Hardcoded secrets (API keys, passwords)
   - Missing authentication middleware
   - Insecure CORS configuration
2. Runs both pattern-based and AI-powered analysis
3. Produces OWASP-categorized security report
