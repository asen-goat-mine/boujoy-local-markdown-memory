# Local Markdown Memory

一个面向 Codex 与 WorkBuddy 的本地优先 Markdown 知识库。它用轻量索引、价值筛选、去重规则和只读预览，让 AI 能够延续项目上下文，而不引入数据库或云端知识服务。

> 公开仓库只包含代码、规则、入门索引和 4 张可删除的合成示例卡，不包含作者的知识、项目、提示词、偏好、日志、素材或 Skill。

## 核心特点

- Markdown 是唯一数据源，文件可以由任何编辑器打开。
- Codex 与 WorkBuddy 读取同一个 Vault 和同一份 `AGENTS.md`。
- 启动只读取 Dashboard 和轻量索引，命中主题后再读取 1–3 个相关文件。
- 高价值内容先压缩、去重和安全检查，再进入项目、知识、内容或提示词目录。
- 只读 UI 支持搜索、筛选、Markdown 阅读、内部链接、本地素材、关系图、通用交付管线、健康中心和自动刷新。
- macOS 与 Windows 共用同一套网页 UI；完整模式只需要 Python 3.9+ 标准库，不需要 `pip`、npm、数据库或外部 API。
- 预览服务只绑定 `127.0.0.1`，没有遥测，不主动上传 Vault 内容。
- 不附带任何 Skill、插件、模型或运行时。

## 三分钟开始

1. Clone 本仓库，或下载并解压 ZIP。
2. 用 Codex 打开仓库根目录；在 WorkBuddy 中把仓库根目录设为工作目录。
3. macOS 双击 `open-preview.command`；Windows 双击 `open-preview.cmd`。
4. 把临时资料放进 `01-Inbox/_Capture.md`，或直接对 Agent 说：
   - “把这次决定压缩成项目卡。”
   - “检查是否已有相似知识，再保存这条方法。”
   - “基于知识库继续当前项目。”
   - “收尾并记录下次续接点。”
5. 示例卡只用于展示功能，可以随时删除或替换。

## 预览模式

完整模式需要 Python 3.9+，只使用标准库：

- macOS：`./open-preview.command`
- Windows：双击 `open-preview.cmd`

找不到 Python 时，启动器会进入浏览器兼容模式。兼容模式仍可选择 Vault 并浏览 Markdown，但自动刷新、本地媒体 Range 和“在文件夹中显示”等功能会降级。

macOS 还可以运行 `Knowledge-UI/install-macos-app.command`，在桌面生成一个本地 App 入口。仓库不提交预编译 `.app`。

## 目录

| 路径 | 用途 |
|---|---|
| `00-System` | 启动、检索、价值筛选、去重、安全和索引规则 |
| `01-Inbox` | 尚未整理的外部资料 |
| `02-Projects` | 项目、产品和系统方案 |
| `03-Knowledge` | 长期方法、技术知识和判断 |
| `04-Content` | 文章、脚本、选题和交付草稿 |
| `05-Prompts` | 可复用提示词 |
| `06-Business` | 商业、运营和客户判断 |
| `90-Archive` | 过期或废弃内容 |
| `Knowledge-UI` | 跨平台本地只读预览 |
| `tools` | 无依赖的只读检查与索引维护工具 |

## Codex 与 WorkBuddy

两者都以根目录 `AGENTS.md` 为主要规则入口。`.codebuddy/rules/local-markdown-memory.md` 提供同一套 WorkBuddy 项目规则，但不会创建第二份数据源。Agent 的自动记忆、聊天历史或插件缓存都不等于 Vault 事实，长期内容必须落到这里的 Markdown 文件中。

## 隐私边界

- “本地优先”描述的是本仓库的数据结构和预览服务，不代表 Codex、WorkBuddy 或 Git 托管平台离线运行。
- 如果把自己的工作 Vault 推送到 GitHub，被 Git 跟踪的 Markdown 可能进入远程仓库。私人知识应使用私有仓库，或把公开源码与个人工作 Vault 分开。
- 预览 UI 只读；Finder/Explorer 定位只接受同源本地请求，并限制在当前 Vault 内。

更多说明见 [PRIVACY.md](PRIVACY.md) 与 [SECURITY.md](SECURITY.md)。

## 非目标

本项目不是云同步服务、数据库、向量搜索引擎或 Markdown 编辑器，也不会自动安装 Skill 或插件。

## 开发与发布检查

```bash
python3 tools/vault_doctor.py
python3 tools/sync_index_status.py --check
python3 -m unittest discover -s tests
```

GitHub Actions 会在 macOS 与 Windows 上执行同一组静态和单元测试。

## License

[MIT](LICENSE)
