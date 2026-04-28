# 连接与设备画像

这一章解释 `rauto` 如何定位目标设备，以及为什么设备画像是执行可靠性的基础。

## 两种连接方式

`rauto` 支持两类目标连接来源：

- 临时连接：直接在命令行上传 `--host`、`--username`、`--password`
- 保存连接：先保存为名字，后续通过 `--connection <name>` 复用

### 临时连接示例

```bash
rauto exec "show ip int br" \
  --host 192.168.1.1 \
  --username admin \
  --password secret \
  --device-profile cisco
```

### 保存连接示例

```bash
rauto connection add lab1 \
  --host 192.168.1.1 \
  --username admin \
  --password secret \
  --device-profile cisco \
  --ssh-security balanced
```

之后就可以复用：

```bash
rauto exec "show version" --connection lab1
```

## 保存连接常用命令

```bash
rauto connection list
rauto connection show lab1
rauto connection delete lab1
```

批量导入也支持：

```bash
rauto connection import ./devices.csv
rauto connection import ./devices.xlsx
```

## 设备画像是什么

设备画像决定了：

- 如何识别提示符
- 如何在不同模式间切换
- 如何判断命令结束
- 某些设备特定交互如何处理

列出可用画像：

```bash
rauto device list
```

查看具体画像：

```bash
rauto device show cisco
rauto device show linux
```

## 使用自定义画像

```bash
rauto device copy-builtin cisco my_cisco
rauto device show my_cisco
rauto device delete-custom my_cisco
```

## SSH 安全参数

保存连接时还可以控制 SSH 兼容性：

- `secure`
- `balanced`
- `legacy-compatible`

## Linux shell flavor

对于 Linux 目标，还可以指定 shell 风格：

- `posix`
- `fish`

## 下一步

继续阅读：

- [模板与直接执行](./templates-and-exec.md)
- [Inventory、历史与运维能力](./inventory-and-operations.md)
