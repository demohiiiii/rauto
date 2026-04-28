# 命令流与文件上传

当一个操作不是“发一条命令、等一份输出”这么简单时，`rauto flow` 就会很有价值。

## 什么是命令流

命令流适合处理这类交互式过程：

- 设备上的 `copy scp:` / `copy tftp:`
- 安装向导
- 确认式提示
- 多轮提示符问答
- 需要根据输出跳转分支的流程

简单理解：

- `exec` 是执行单条命令
- `template` 是生成多条命令
- `flow` 是驱动“对话式 CLI 过程”

## 执行命令流

执行保存好的命令流模板：

```bash
rauto flow \
  --template cisco_like_copy \
  --vars-json '{"command":"copy scp: flash:/new.bin","server_addr":"192.168.1.50","remote_path":"/images/new.bin","transfer_username":"backup","transfer_password":"secret"}' \
  --connection core-01
```

也可以使用文件形式的变量。

## 管理命令流模板

```bash
rauto flow-template list
rauto flow-template show cisco_like_copy
rauto flow-template create cisco_like_copy --file ./templates/examples/cisco-like-command-flow.toml
rauto flow-template update cisco_like_copy --file ./my-flow-template.toml
rauto flow-template delete cisco_like_copy
```

## 命令流的价值

相比把交互硬编码在脚本里，命令流模板的优势在于：

- 可以复用
- 可以在 CLI 和 Web 共用
- 可以做变量校验
- 可以作为 `tx` 的正向流或回滚流的一部分

## 文件上传

`rauto upload` 和 `rauto flow` 都能处理“文件相关操作”，但职责不同。

### `rauto upload`

适合目标 SSH 服务本身暴露了 `sftp` 子系统的情况：

```bash
rauto upload \
  --local-path ./configs/daemon.conf \
  --remote-path /tmp/daemon.conf \
  --host 192.168.1.20 \
  --username admin \
  --password secret
```

常用附加参数：

- `--timeout-secs`
- `--buffer-size`
- `--show-progress`
- `--record-level`
- `--record-file`

### `rauto flow`

适合设备侧文件传输命令，例如：

- `copy scp:`
- `copy ftp:`
- `copy tftp:`

这类流程往往需要设备连续询问：

- 服务器地址
- 用户名
- 密码
- 源路径
- 目标路径
- 是否确认覆盖

因此更适合放进命令流模板。

## 如何选择

- 如果是“本地机器直接通过 SFTP 上传到远端主机” -> 用 `upload`
- 如果是“登录到设备后，由设备自己发起 copy/transfer 交互” -> 用 `flow`

## 建议实践

- 把常见交互流程保存成命令流模板
- 将敏感参数通过变量注入，不要硬编码到模板正文
- 对关键传输流程开启录制，便于回放排障

## 下一步

继续阅读：

- [事务、工作流与编排](./transactions-and-orchestration.md)
