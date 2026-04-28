# rauto 教程

欢迎使用 `rauto` 教程。

这份文档以 **从零上手到实际落地** 为目标，适合以下读者：

- 想快速跑通一次设备命令执行的网络工程师
- 想把 SSH 自动化流程做成模板、事务和编排的开发者
- 想通过 Web 或 Agent 模式接入更大平台的使用者

## 你会学到什么

阅读完本教程后，你应该能完成以下事情：

- 安装 `rauto` 并启动本地 Web 控制台
- 用临时连接或保存连接执行命令
- 使用模板、变量和命令流复用执行逻辑
- 用 `tx` 和 `tx-workflow` 建立可回滚的变更流程
- 用 `orchestrate` 在多台设备上执行分阶段任务
- 理解 `web` 模式和 `agent` 模式的职责边界
- 使用 Inventory 的分组和标签组织目标设备

## 推荐阅读顺序

如果你第一次接触 `rauto`，建议按以下顺序阅读：

1. [快速开始](./quick-start.md)
2. [连接与设备画像](./connections-and-profiles.md)
3. [模板与直接执行](./templates-and-exec.md)
4. [命令流与文件上传](./flows-and-upload.md)
5. [事务、工作流与编排](./transactions-and-orchestration.md)
6. [Web 与 Agent 模式](./web-and-agent.md)
7. [Inventory、历史与运维能力](./inventory-and-operations.md)

## 本地生成文档

先安装 `mdbook`：

```bash
cargo install mdbook
```

在仓库根目录执行：

```bash
mdbook serve docs
```

然后打开浏览器访问终端输出的本地地址。

如果只想生成静态 HTML：

```bash
mdbook build docs
```

生成结果默认位于：

```text
docs/book/
```
