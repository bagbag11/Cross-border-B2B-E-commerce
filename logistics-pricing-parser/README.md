# 跨境物流报价解析 Skill

从跨境物流货代 Excel 报价表中自动解析路线信息与计费规则，结构化后写入飞书多维表格，作为询价数据库使用。支持 20 种常见货代报价格式（满天星、惠运捷、元昊、中国邮政、蓝牛国际、亿俐缇、福鑫国际、韩润物流等）。

## 目录结构

```text
.
├── SKILL.md                  # 技能说明（含使用流程与示例）
├── scripts/
│   ├── parse_pricing.py      # 解析 Excel 报价表，输出结构化 JSON
│   └── write_to_feishu.py    # 将 JSON 批量写入飞书多维表格
├── references/
│   └── data_model.md         # 两张表的完整字段定义与验证规则
└── assets/
    └── image.png             # 技能图标
```

## 安装到扣子（Coze）

1. 下载本仓库 ZIP 并解压，或直接 `git clone`。
2. 将文件夹压缩为 `.zip`（确保 `SKILL.md` 位于压缩包根目录）。
3. 在扣子编程首页选择「技能」页签，点击「上传技能包」，上传该 zip。
4. 等待扣子解析、安全检测与重新打包后即可部署使用。

## 使用方法

解析报价表：

```bash
python scripts/parse_pricing.py --input "货代表.xlsx"
```

指定输出文件：

```bash
python scripts/parse_pricing.py --input "货代表.xlsx" --output result.json
```

写入飞书多维表格（首次导入必须加 `--clear`）：

```bash
python scripts/write_to_feishu.py --input result.json --clear
```

## 依赖

- Python 3.8+
- openpyxl==3.1.5
- xlrd==2.0.1
- coze_workload_identity（写入脚本必须在扣子智能体环境中运行，飞书 OAuth 凭证自动注入）

## 环境变量

仓库已做脱敏处理，多维表格资源标识不包含真实值，运行时通过以下环境变量注入：

| 环境变量 | 说明 |
|---------|------|
| `COZE_FEISHU_APP_TOKEN` | 飞书多维表格 app_token |
| `COZE_FEISHU_ROUTE_TABLE_ID` | 路线表 table_id |
| `COZE_FEISHU_PRICING_TABLE_ID` | 计费规则表 table_id |
| `COZE_FEISHU_BITABLE_TOKEN` | 飞书 Bitable 访问凭证（Bearer Token） |

在扣子部署技能时，将这些变量配置为开发者变量即可。

## 注意事项

- 解析器使用 `data_only=True` 读取 Excel，避免公式错误。
- `--clear` 会先清空表格再写入，仅首次导入时使用。
- 路线名称是主键，修改后会导致报价规则关联断裂。
