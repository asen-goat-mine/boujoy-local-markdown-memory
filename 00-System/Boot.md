# Boot

这是一个本地 Markdown 知识库。

新窗口打开本文件夹时：

1. 读取 `AGENTS.md`
2. 读取 `DASHBOARD.md`
3. 读取本文件
4. 轻量读取 `Hot-Index.md`、`Memory-Index.md`、`Active-Context.md`

普通回答不需要每轮重复读取索引。只有命中相关主题、需要延续项目，或当前上下文缺少索引信息时，才补读最多 3 个相关内容文件。

默认启用 Quiet Mode。后台检索、价值评分、去重与保存过程不主动展示。

