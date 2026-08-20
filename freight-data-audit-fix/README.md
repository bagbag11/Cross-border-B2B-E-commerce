# 货代数据审查修复 Skill

对飞书多维表「物流询价数据库」中的货代路线信息与计费规则进行逐字段回源审查、按 P0→P3 优先级修复并回读验证的 Aily/飞书技能。

## 目录结构

```text
.
├── SKILL.md                    # 技能说明（触发条件/核心流程/修复规则）
└── references/
    ├── audit-rules.md          # 逐字段回源比对规则
    └── field-reference.md      # 多维表字段速查与 7 家货代说明
```

## 使用前提

- 目标多维表：飞书 Base「物流询价数据库」（路线信息表 + 计费规则表）
- 源文件：货代报价 Excel 或截图，由用户提供
- 运行环境需提供 `lark-cli base` 操作能力（`get_skills("larksuite-cli-guide")`）

## 核心流程

1. 拉取多维表全量数据并记录状态快照
2. 解析源文件（Excel/截图）
3. 逐字段回源比对，按 P0→P3 分类错误
4. 按优先级修复（不可逆操作先备份并确认）
5. 全量回读验证并输出修复报告

## 与 logistics-pricing-parser 的配合

- `logistics-pricing-parser`：将格式不一的货代表 Excel 解析写入飞书多维表格（入库）
- `freight-data-audit-fix`：对多维表格已有数据逐字段回源审查与修复（把关）

两者配合形成「导入 → 审查 → 修复 → 验证」的数据质量闭环。
