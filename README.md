# 欧迈 CAD 自动报价 MVP

将机械设备 DWG 图纸中的配置明细表自动解析为零件清单，匹配价格库并生成客户报价 PDF。

## 已实现

- 浏览器内解析 DWG，无需人工逐行录入
- 提取零件名称、规格、材质和数量
- 自动匹配示例价格并计算含税报价
- 保存报价草稿
- 一键导出客户版 PDF
- 可选的 AI 名称与规格归一化接口

## 本地运行

需要 Node.js 22.13 或更高版本。

```bash
pnpm install
pnpm dev
```

`pnpm install` 和 `pnpm build` 会从依赖包中自动准备 LibreDWG WebAssembly 运行文件。

## 安全说明

- 不要提交数据库密码、API Key 或 `.env` 文件。
- `dbConn.xml` 不属于本仓库。
- 当前价格均为 MVP 示例数据，正式报价前需要人工维护并审核价格库。

## 第三方许可

DWG 解析使用 `@mlightcad/libredwg-web`。发布或商业分发前请阅读 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) 并完成许可证合规评估。
