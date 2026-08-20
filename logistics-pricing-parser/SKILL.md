---
name: logistics-pricing-parser
description: 从跨境物流货代Excel报价表中解析路线信息和计费规则，写入飞书多维表格作为询价数据库；当用户需要批量导入物流报价、建立运价查询系统或解析货代价格表时使用
dependency:
  python:
    - openpyxl==3.1.5
    - xlrd==2.0.1
    - coze_workload_identity
---

# 跨境物流报价解析与飞书多维表格写入

## 任务目标
- 从货代提供的Excel报价表中自动识别格式、提取全部路线和报价规则
- 输出结构化JSON并写入飞书多维表格的两张核心表
- 支持20种货代格式（满天星综合/主营、惠运捷、元昊、中国邮政、蓝牛国际、亿俐缇、福鑫国际、韩润物流、祥源国际、畅骏国际、启丰物流、海源日本、卉马国际、昌海运通、翔平、艾姆勒、惠运捷邮政大包）

## 数据目标

### 路线表 (app_token: ${COZE_FEISHU_APP_TOKEN}, table_id: ${COZE_FEISHU_ROUTE_TABLE_ID})

| 飞书字段名 | 解析来源 |
|-----------|---------|
| 货代名称 | 自动检测（从文件名识别20种货代） |
| 路线名称 | 产品名-国家（主键） |
| 覆盖国家或地区 | sheet名+行首提取 |
| 覆盖城市 | 行首zone列 |
| 支持邮编范围 | 备注中提取 |
| 支持物品类型（逗号分隔） | 普货/带电/特货（备注中检测） |
| 最小物流时效（天数） | "X-Y天"模式提取 |
| 最大物流时效（天数） | "X-Y天"模式提取 |
| 是否启用 | 默认是 |
| 能接受的包装类型（逗号分隔） | 纸箱/木箱/托盘（备注检测，无备注默认纸箱） |
| 渠道类型（air/sea/land） | 自动推断（空派→air，海派→sea等） |
| 运输类型 | 自动推断（干线+尾程双清派送/仅海外尾程派送等） |
| 是否尾程派送到门 | 备注中检测（到门→是，自提→否） |
| 体积限制（cm） | 备注中提取，没有限制则填入无 |
| 最长边限制（cm） | 备注中提取，没有限制则填入无 |
| 清关模式 | DDP/DDU/PVA/CIF（备注检测） |
| 报价币种 | 默认CNY |

### 计费规则表 (table_id: ${COZE_FEISHU_PRICING_TABLE_ID})

| 飞书字段名 | 解析来源 |
|-----------|---------|
| 路线名称 | 外键关联路线名称 |
| 适用国家 | 目的地国家 |
| 适用地区 | zone信息，如无指定范围，默认全境，写入全境 |
| 适用邮编范围 | zone邮编信息，无指定范围，默认全境，写入全境 |
| 最小重量限制 | 重量段下限 |
| 最大重量限制 | 重量段上限 |
| 最大长度限制 | 备注提取 |
| 最小长度限制 | 备注提取 |
| 单价 | 价格列 |
| 单价计费单位 | KG/500g/50g等（从表头或备注检测） |
| 首重价格 | 首重/首件价格 |
| 首重单位 | KG/500g/50g等（从表中检测） |
| 续重价格 | 续重单价 |
| 续重单位 | KG/500g/50g等 |
| 最低收费 | 最低消费 |
| 包装单位 | 箱/托盘/件 |
| 木箱包装单价 | 仓库增值服务提取 |
| 木架包装单价 | 仓库增值服务提取 |
| 超长附加费 | 备注提取 |
| 超重附加费 | 备注提取 |
| 超围长附加费 | 备注提取 |
| 税费 | 包税/自税/自税递延 |
| 挂号费 | 内容提取 |
| 燃油附加费 | 备注提取 |
| 报关费 | 备注提取 |
| 偏远地区附加费 | 备注提取 |
| 签收证明费 | 备注提取 |
| 报价备注 | 汇总所有特殊条款 |

## 操作步骤

### 第一步：解析Excel报价表

```bash
python scripts/parse_pricing.py --input "assets/货代表.xlsx"
```

输出JSON到stdout，包含`routes`和`pricing`数组。也可指定输出文件：

```bash
python scripts/parse_pricing.py --input "assets/货代表.xlsx" --output result.json
```

### 第二步：写入飞书多维表格

```bash
python scripts/write_to_feishu.py --input result.json --clear
```

`--clear`参数会先清空表格再写入，首次导入必须使用。

写入脚本自动完成：
1. 获取飞书表格字段ID映射
2. 按飞书字段名精确匹配数据
3. 分批写入（每批450条，避免超500上限）
4. 单条重试容错

## 使用示例

### 示例1：导入满天星综合报价

场景：用户提供`VIP&【满天星】综合产品销售价格表2026.7.6.xlsx`

步骤：
1. 将Excel文件放入assets/目录
2. 执行`python scripts/parse_pricing.py --input "assets/满天星综合报价.xlsx"`
3. 确认输出JSON中routes和pricing数量正确
4. 执行`python scripts/write_to_feishu.py --input result.json --clear`

预期产出：路线表约171条 + 报价规则表约278条

### 示例2：导入中国邮政报价含挂号费

场景：用户提供`副本中国邮政跨境物流产品报价20250317.xlsx`

关键要点：
- 国际小包sheet自动分离平常/挂号两套路线
- 挂号费差价自动计算并存入registration_fees
- 平常资费路线名如`国际小包-平常-美国`
- 挂号资费路线名如`国际小包-挂号-美国`

预期产出：路线表约1468条（含平常+挂号双份）

### 示例3：增量更新单条路线

场景：仅修改某个货代的部分价格

1. 先执行`python scripts/parse_pricing.py --input "assets/更新价格.xlsx"`
2. 执行写入时不加`--clear`，直接追加新记录
3. 手动在飞书中删除旧版本路线记录

## 资源索引

- 脚本：[scripts/parse_pricing.py](scripts/parse_pricing.py) — 解析Excel输出结构化JSON，支持20种货代格式自动检测
- 脚本：[scripts/write_to_feishu.py](scripts/write_to_feishu.py) — 读取JSON写入飞书多维表格，支持批量清空+写入
- 参考：[references/data_model.md](references/data_model.md) — 两张表的完整字段定义、数据类型、验证规则和示例

## 注意事项
- 解析器依赖openpyxl读取Excel，确保`data_only=True`避免公式错误
- 写入脚本必须在Coze智能体环境中运行，飞书OAuth凭证自动注入
- 多维表格的app_token、table_id及访问凭证均通过环境变量注入（`COZE_FEISHU_APP_TOKEN`、`COZE_FEISHU_ROUTE_TABLE_ID`、`COZE_FEISHU_PRICING_TABLE_ID`、`COZE_FEISHU_BITABLE_TOKEN`），部署时需在扣子中配置
- 首次导入必须使用`--clear`清空旧数据
- 路线名称是主键，修改后会导致报价规则关联断裂
- 惠运捷解析时stderr会输出进度信息，JSON结果在stdout
