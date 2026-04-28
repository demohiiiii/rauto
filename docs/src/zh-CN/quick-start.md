# 快速开始

本章目标是让你在最短时间内跑通一次 `rauto`。

## 安装

你可以直接从 crates.io 安装：

```bash
cargo install rauto
```

或者从源码构建：

```bash
git clone https://github.com/demohiiiii/rauto.git
cd rauto
cargo build --release
```

构建完成后，可执行文件位于：

```text
target/release/rauto
```

## 先执行一条命令

默认设备画像是 `linux`，因此你可以先对 Linux 主机做一次验证：

```bash
rauto exec "uname -a" \
  --host 192.168.1.10 \
  --username root \
  --password '******'
```

如果目标是网络设备，通常需要显式指定设备画像：

```bash
rauto exec "show version" \
  --host 192.168.1.1 \
  --username admin \
  --password '******' \
  --device-profile cisco
```

## 启动 Web 控制台

```bash
rauto web --bind 127.0.0.1 --port 3000
```

然后访问：

```text
http://127.0.0.1:3000
```

Web 模式适合本地自助使用：

- 管理连接、模板、命令流、Inventory
- 执行命令、事务和编排
- 查看录制与回放
- 管理黑名单、备份与恢复

## 什么时候用哪个命令

| 场景 | 推荐命令 | 说明 |
| --- | --- | --- |
| 先临时跑一条命令 | `rauto exec` | 最适合临时调试 |
| 命令正文来自模板 | `rauto template` | 适合参数化命令生成 |
| 交互式流程 | `rauto flow` | 适合带提示符问答的流程 |
| 可回滚单块变更 | `rauto tx` | 适合单目标事务 |
| 多块事务流程 | `rauto tx-workflow` | 适合复杂结构化变更 |
| 多设备发布 | `rauto orchestrate` | 适合跨设备、分阶段执行 |
| 浏览器管理界面 | `rauto web` | 本地控制台 |
| 接入 manager | `rauto agent` | 托管代理模式 |

## 下一步

建议继续阅读：

- [连接与设备画像](./connections-and-profiles.md)
- [模板与直接执行](./templates-and-exec.md)
