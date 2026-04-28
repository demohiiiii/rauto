# Inventory、历史与运维能力

除了执行命令和事务，`rauto` 还提供一套围绕资产组织、审计和运维治理的能力。

## Inventory

Inventory 主要解决两个问题：

- 如何把保存连接组织成更高层的逻辑分组
- 如何把一组默认变量、默认连接信息复用到编排和执行中

### Inventory Group

CLI 侧目前主要管理的是分组：

```bash
rauto inventory group list
rauto inventory group show core
rauto inventory group upsert core --file ./core-group.json
rauto inventory group delete core
```

### 变量预解析

```bash
rauto inventory resolve-vars \
  --host core-01 \
  --group core \
  --vars-json '{"tenant":"campus"}' \
  --json
```

### Web UI 中的标签

Web UI 中还支持标签管理，适合更轻量的设备组织与筛选。

## 历史与录制

### 查看历史

```bash
rauto history list lab1 --limit 20
rauto history show lab1 <history-id>
rauto history delete lab1 <history-id>
```

### 回放录制

```bash
rauto replay ./session.jsonl --list
rauto replay ./session.jsonl --command "show version"
```

## 黑名单

```bash
rauto blacklist list
rauto blacklist add "write erase"
rauto blacklist add "reload*"
rauto blacklist check "reload in 5"
rauto blacklist delete "reload*"
```

## 备份与恢复

```bash
rauto backup create
rauto backup create --output ./rauto-backup.tar.gz
rauto backup list
rauto backup restore ./rauto-backup.tar.gz
rauto backup restore ./rauto-backup.tar.gz --replace
```

## 推荐落地方式

1. 先沉淀保存连接
2. 再引入 Inventory 分组
3. 为关键命令配置黑名单
4. 对生产执行统一开启录制
5. 定期备份 `~/.rauto` 数据

## 总结

当你把这些能力一起使用时，`rauto` 就不仅是一个“执行命令的工具”，而是一套：

- 有连接资产
- 有执行模板
- 有事务模型
- 有平台接入能力
- 有审计与恢复能力

的网络自动化工作台。
