#!/usr/bin/env tsx
/**
 * Aurora QA — Philiapedia 测试示例
 *
 * 对 Philiapedia 教育平台进行全方位质量检测：
 * - 安全扫描（OWASP）
 * - Bug 分析
 * - 代码审查
 * - 测试生成
 *
 * 使用方式：
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/philiapedia-test/index.ts
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/philiapedia-test/index.ts --mode security
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/philiapedia-test/index.ts --mode review
 *   ANTHROPIC_API_KEY=sk-... npx tsx examples/philiapedia-test/index.ts --mode full
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { Orchestrator, loadConfig } from '@aurora-qa/core'

// ─── 配置 ─────────────────────────────────────────────────────────────────────

const PHILIAPEDIA_PATH = process.env['PHILIAPEDIA_PATH']
  ?? resolve(import.meta.dirname, '../../../.openclaw/workspace/projects/philiapedia')

const MODE = (() => {
  const idx = process.argv.indexOf('--mode')
  if (idx !== -1) return process.argv[idx + 1]
  const eq = process.argv.find(a => a.startsWith('--mode='))
  if (eq) return eq.split('=')[1]
  return 'full'
})()

// 目标文件
const FILES = {
  authController: join(PHILIAPEDIA_PATH, 'server/src/controllers/authController.ts'),
  inputSanitizer: join(PHILIAPEDIA_PATH, 'server/src/utils/inputSanitizer.ts'),
  courseController: join(PHILIAPEDIA_PATH, 'server/src/controllers/coursePurchaseController.ts'),
}

// ─── 辅助 ────────────────────────────────────────────────────────────────────

function readSafe(path: string): string | null {
  if (!existsSync(path)) {
    console.warn(`  ⚠ 文件不存在: ${path}`)
    return null
  }
  try {
    return readFileSync(path, 'utf8')
  } catch {
    console.warn(`  ⚠ 无法读取: ${path}`)
    return null
  }
}

function section(icon: string, title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`${icon}  ${title}`)
  console.log('─'.repeat(60))
}

function summarize(result: unknown): string {
  if (!result) return '(无结果)'
  if (typeof result === 'string') return result.slice(0, 500)
  const obj = result as Record<string, unknown>
  const parts: string[] = []
  if (obj['overallScore']) parts.push(`总评分: ${obj['overallScore']}/10`)
  if (obj['summary']) parts.push(`摘要: ${String(obj['summary']).slice(0, 200)}`)
  if (Array.isArray(obj['bugs'])) parts.push(`Bug数量: ${(obj['bugs'] as unknown[]).length}`)
  if (Array.isArray(obj['issues'])) parts.push(`问题数量: ${(obj['issues'] as unknown[]).length}`)
  if (Array.isArray(obj['tests'])) parts.push(`生成测试: ${(obj['tests'] as unknown[]).length} 个`)
  if (obj['testCode']) parts.push(`测试代码: ${String(obj['testCode']).slice(0, 100)}...`)
  return parts.length ? parts.join('\n  ') : JSON.stringify(result, null, 2).slice(0, 400)
}

// ─── 主程序 ───────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env['ANTHROPIC_API_KEY']
  if (!apiKey) {
    console.error('❌ 请设置环境变量: export ANTHROPIC_API_KEY=sk-ant-...')
    process.exit(1)
  }

  console.log('═'.repeat(60))
  console.log('🚀 Aurora QA — Philiapedia 测试')
  console.log(`📁 项目路径: ${PHILIAPEDIA_PATH}`)
  console.log(`🎯 测试模式: ${MODE}`)
  console.log(`⏰ 开始: ${new Date().toLocaleTimeString('zh-CN')}`)
  console.log('═'.repeat(60))

  if (!existsSync(PHILIAPEDIA_PATH)) {
    console.error(`\n❌ 找不到项目: ${PHILIAPEDIA_PATH}`)
    console.error('   请设置 PHILIAPEDIA_PATH 指向 Philiapedia 根目录')
    process.exit(1)
  }

  const config = loadConfig({ anthropicApiKey: apiKey })
  const orchestrator = new Orchestrator({ config })
  const startTime = Date.now()
  const report: Record<string, unknown> = {
    target: PHILIAPEDIA_PATH,
    mode: MODE,
    startedAt: new Date().toISOString(),
    results: {}
  }

  const authCode = readSafe(FILES.authController)
  const sanitizerCode = readSafe(FILES.inputSanitizer)

  // ─── 1. 安全扫描 ────────────────────────────────────────────────────────
  if (['security', 'full'].includes(MODE) && authCode) {
    section('🔒', '安全扫描（authController.ts）')

    try {
      const result = await orchestrator.analyzeBugs({
        code: authCode,
        filePath: FILES.authController,
        language: 'typescript',
        context: `
Philiapedia 教育平台认证控制器。
安全审计重点：
1. JWT 漏洞（弱密钥、算法混淆）
2. 输入验证绕过
3. 错误信息泄露内部实现
4. 账号枚举攻击
5. 暴力破解防护有效性
6. 密码哈希强度（bcrypt cost factor）
        `.trim()
      })

      console.log('\n  结果摘要:')
      console.log('  ' + summarize(result).split('\n').join('\n  '))
      ;(report.results as Record<string, unknown>)['security'] = result
    } catch (e) {
      console.error('  ❌ 失败:', (e as Error).message)
    }
  }

  // ─── 2. 代码审查 ────────────────────────────────────────────────────────
  if (['review', 'full'].includes(MODE) && authCode) {
    section('👁', '代码审查（authController.ts）')

    try {
      const result = await orchestrator.reviewCode({
        code: authCode,
        filePath: FILES.authController,
        language: 'typescript',
        strictness: 'standard',
        focusAreas: ['maintainability', 'error-handling', 'security', 'performance'],
        context: `
Philiapedia 是教育平台，服务学生/教师/管理员三种角色。
这是核心认证模块，对安全性要求极高。
请给出：1）总体评分（1-10）2）最重要的3个改进点 3）代码亮点
        `.trim()
      })

      console.log('\n  审查结果:')
      console.log('  ' + summarize(result).split('\n').join('\n  '))
      ;(report.results as Record<string, unknown>)['review'] = result
    } catch (e) {
      console.error('  ❌ 失败:', (e as Error).message)
    }
  }

  // ─── 3. 输入清理器审查 ──────────────────────────────────────────────────
  if (['security', 'full'].includes(MODE) && sanitizerCode) {
    section('🛡', '输入清理器严格审查（inputSanitizer.ts）')

    try {
      const result = await orchestrator.reviewCode({
        code: sanitizerCode,
        filePath: FILES.inputSanitizer,
        language: 'typescript',
        strictness: 'strict',
        focusAreas: ['security', 'edge-cases', 'correctness'],
        context: '输入清理工具类，负责验证邮箱、手机号、用户名等。这是安全的第一道防线。'
      })

      console.log('\n  审查结果:')
      console.log('  ' + summarize(result).split('\n').join('\n  '))
      ;(report.results as Record<string, unknown>)['sanitizerReview'] = result
    } catch (e) {
      console.error('  ❌ 失败:', (e as Error).message)
    }
  }

  // ─── 4. 测试生成 ────────────────────────────────────────────────────────
  if (['test-gen', 'full'].includes(MODE) && sanitizerCode) {
    section('🧪', '自动测试生成（inputSanitizer.ts）')

    try {
      const result = await orchestrator.generateTests({
        sourceCode: sanitizerCode,
        filePath: FILES.inputSanitizer,
        framework: 'vitest',
        maxTests: 15,
        focusAreas: ['edge-cases', 'invalid-inputs', 'boundary-values', 'security-payloads'],
        context: `
测试重点：
1. XSS payload 应被拦截（<script>alert(1)</script>）
2. SQL注入字符串（'; DROP TABLE users; --）
3. 超长输入（10000字符）
4. 空字符串和 null
5. 中国手机号格式（13x/14x/15x/16x/17x/18x/19x）
6. 国际邮箱格式
7. Unicode 和 emoji 字符
        `.trim()
      })

      console.log('\n  生成结果:')
      console.log('  ' + summarize(result).split('\n').join('\n  '))
      ;(report.results as Record<string, unknown>)['generatedTests'] = result

      // 保存测试文件
      const testObj = result as Record<string, unknown>
      if (testObj['testCode']) {
        const testPath = join(PHILIAPEDIA_PATH, 'server/src/utils/__tests__/inputSanitizer.aurora.test.ts')
        try {
          writeFileSync(testPath, testObj['testCode'] as string)
          console.log(`\n  ✅ 测试文件已保存: ${testPath}`)
        } catch {
          console.log(`\n  ⚠ 保存测试文件失败（目录可能不存在）`)
        }
      }
    } catch (e) {
      console.error('  ❌ 失败:', (e as Error).message)
    }
  }

  // ─── 完成 ──────────────────────────────────────────────────────────────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  report.completedAt = new Date().toISOString()
  report.durationSeconds = parseFloat(duration)

  const reportPath = resolve(import.meta.dirname, 'aurora-qa-report.json')
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`✅ 完成！总耗时: ${duration}s`)
  console.log(`📊 完整报告: ${reportPath}`)
  console.log('═'.repeat(60))

  await orchestrator.shutdown()
}

main().catch(err => {
  console.error('\n❌ 执行出错:', err.message)
  if (process.env['DEBUG']) console.error(err.stack)
  process.exit(1)
})
