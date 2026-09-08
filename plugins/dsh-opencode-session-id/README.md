# dsh-opencode-session-id

给 DSH 的出站推理 HTTP 请求注入每会话会话标识头（默认 `x-opencode-session`），目标为 opencode.ai 网关（pi-ai provider `opencode` / `opencode-go`）。opencode Go 网关自 2026-09-05 起强制该头，缺失时返回 HTTP 400 `MissingSessionID`（deepseek-harness discussion #5495），导致所有 Go 套餐模型不可用。本插件在 wire 层复刻 opencode 客户端自己的行为，恢复可用性。

遵循 [PLUGIN-STANDARD.md](../PLUGIN-STANDARD.md) 行为准则开发。

## 工作方式

1. 注册 `llm/stream` waterfall 监听器：捕获每次模型请求的 `options.sessionId`（agent-loop 保证携带，格式 `session-<uuid>`），并在下游流运行的整个期间保持该令牌在作用域内——pi-ai 适配器在迭代期间发起 fetch，因此作用域覆盖该会话的全部请求（含重试）。
2. 包装全局 `fetch`：当请求 URL 命中配置的 host 后缀 / baseURL 前缀且当前有会话令牌时，把令牌写入请求头（只克隆并追加头，body/URL/method 原样；不覆盖调用方已设置的头）。非 opencode 端点完全不受影响。
3. 令牌默认原样发送会话 ID（已实测网关接受）；`hashSessionId: true` 时改为把 uuid 部分 SHA-256 后取纯字母数字令牌（网关不可反推原始 ID）。

实测（2026-09-07，deepseek-v4-flash）：无头 → 400 MissingSessionID；`x-opencode-session: session-<uuid>` → 200；`x-opencode-session: <nanoid8>` → 200。

## 配置字段表

所有字段可选，默认值即开即用（零配置安装）：

| Key | 默认 | 说明 |
|---|---|---|
| `providers` | `['opencode', 'opencode-go']` | 参与会话标记的 pi-ai 路由名；空数组 = 全部 |
| `hosts` | `['opencode.ai']` | URL host 后缀（含子域名）命中即注入 |
| `baseURLs` | `[]` | 额外的精确 URL 前缀匹配（自定义网关） |
| `headers` | `['x-opencode-session']` | 注入的请求头名列表 |
| `extraHeaders` | `{}` | 静态附加头（如 `x-opencode-client`） |
| `userAgent` | 空 | 覆盖 User-Agent（默认不动） |
| `hashSessionId` | `false` | true = SHA-256 哈希 uuid 为纯字母数字令牌 |
| `hashLength` | `8` | 哈希令牌长度（4–32） |
| `sessionIdEnv` | 空 | 会话 ID 的环境变量名兜底（默认回退 `DSH_SESSION_ID`） |
| `verbose` | `false` | 每次注入打印日志（含原始会话 → 令牌映射） |

部署 profile（`~/.dsh/profiles/web/cordis.patch.yml`）示例：

```yaml
- id: opencode-session-id
  name: 'dsh-opencode-session-id'
  config:
    verbose: true
```

## 安装（三步）

1. profile `package.json` 的 `dependencies` 加：
   `"dsh-opencode-session-id": "link:E:/DSH/DSH-ops/plugins/dsh-opencode-session-id"`
2. `dsh.profile.bundles` 数组追加 `"dsh-opencode-session-id"`
3. profile 目录执行 `pnpm install`，然后重启服务（预检闸门自动运行）

## 验证

- `node E:\DSH\DSH-ops\validate-plugins.mjs` 出现 `PASS dsh-opencode-session-id`
- `node E:\DSH\Deepseek_DSH/apps/cli/lib/bin.js --profile web --dump-config` 出现 `id: opencode-session-id` 行
- 新会话调用 opencode-go 模型不再报 `MissingSessionID`（400）
- 开 `verbose: true` 时服务日志出现 `opencode-session-id: injecting session token ...`

## 已知边界

- 只覆盖走 `fetch` 的协议（openai-completions / openai-responses / anthropic-messages）；`transport: websocket` 不用 fetch，不在范围内。
- 作用域令牌是进程级单槽：同一进程内并发流式会话理论上有交叉可能（DSH 循环本身单会话流式，实际不交叉）。
- 只追加头，不解析、不校验网关响应。
- 卸载/禁用插件时恢复原始 fetch（若期间被其他代码替换则不动）。