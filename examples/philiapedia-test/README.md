# Philiapedia 测试示例

用 Aurora QA 对 Philiapedia 教育平台进行全方位质量检测。

## 测试内容

| 测试类型 | 目标 | 说明 |
|---------|------|------|
| 安全扫描 | `authController.ts` | SQL注入、JWT弱点、输入验证缺陷 |
| Bug分析 | `authController.ts` | 逻辑错误、边界条件、空指针 |
| 代码审查 | `authController.ts` | 代码质量、最佳实践、可维护性 |
| 测试生成 | `inputSanitizer.ts` | 自动生成单元测试套件 |
| 性能分析 | `authController.ts` | 复杂度估算、潜在性能瓶颈 |

## 运行方式

```bash
# 进入 aurora-qa 根目录
cd ~/aurora-qa

# 安装依赖（首次）
pnpm install

# 设置 API Key
export ANTHROPIC_API_KEY=sk-ant-your-key

# 运行 Philiapedia 测试
npx tsx examples/philiapedia-test/index.ts

# 只跑安全扫描
npx tsx examples/philiapedia-test/index.ts --mode security

# 只跑代码审查
npx tsx examples/philiapedia-test/index.ts --mode review

# 完整全量扫描（最慢，最全面）
npx tsx examples/philiapedia-test/index.ts --mode full
```

## 预期输出

```
🚀 Aurora QA — Philiapedia 测试
📁 目标项目: /path/to/philiapedia

[1/5] 🔒 安全扫描...
  ⚠ MEDIUM: 潜在的错误信息泄露（第 47 行）
  ✓ JWT 密钥验证正常
  ✓ 输入清理逻辑存在

[2/5] 🐛 Bug 分析...
  ⚠ 未处理的 Promise rejection（第 203 行）
  ✓ 注册流程逻辑正确

[3/5] 👁 代码审查...
  整体评分: 7.8/10
  建议: 添加速率限制、统一错误处理

[4/5] 🧪 测试生成...
  生成 12 个测试用例
  覆盖: 注册、登录、JWT验证、边界条件

[5/5] ⚡ 性能分析...
  authController: O(n) — 正常
  ⚠ 数据库查询可能缺少索引

✅ 完成！耗时: 45.2s
📊 报告保存至: ./aurora-qa-report.json
```
