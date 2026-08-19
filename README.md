# 跨境电商物流询价系统

> 内部 B2B 跨境电商物流询价工作台，帮助电商运营小组快速比对最优物流路线并精准管理多源异构的货代报价规则。

---

## 项目简介

示例电商团队经营多品类跨境业务，日常需要处理来自多家货代的异构报价 Excel，面对以下痛点：

- 报价表字段格式不统一（首重/续重、单价/kg、体积计费、处理费+重量费等多种模式混合）
- 同一国家有多条可选线路，人工对比时效、价格、账期效率低
- 历史报价散落在不同文件，难以追溯与更新

本系统将货代报价集中沉淀到 PostgreSQL，并提供一键询价工作台，输入「国家/重量/尺寸/物品类别」即可秒级返回**按价格 x 时效 x 合作次数 x 账期**四维度打分的候选线路，同时支持**干线+尾程组合线路**推荐。

---

## 核心功能

### 1. 物流询价工作台（首页 `/`）
- 支持**自由文本粘贴识别**（从客户邮件/聊天记录中一键提取国家、重量、尺寸、邮编等）
- 智能匹配规则：
  - 国家别名 + 前缀匹配（15 个国家别名，如 UAE、UK）
  - 邮编首数字匹配
  - 尺寸/重量区间过滤
  - 物品类别（普货/带电/纯电/危险品）专线匹配
  - 包装限制兼容中英文逗号分隔
- 6 种计费模式自动识别：
  - 首重 50g + 续重/50g
  - 首重 500g + 续重/500g
  - 首重 1kg + 续重/kg
  - 单价/kg
  - 处理费 + 重量费
  - 体积计费（CBM）
- 计费重量：统一 `MAX(实重, 体积重)`（体积重除数硬编码 6000）；`billing_mode = 'volume'` 的路线跳过体积重换算，直接按 `unitPrice x CBM`
- 综合打分排名：`价格x45% + 时效x30% + 合作次数x15% + 账期x10%`
- 标签：**综合推荐** / **时效最优** / **性价比首选** / **组合推荐**

### 2. 线路分类与派送到门
- 运输类型三类分类：
  - `干线+尾程派送`（trunk_lastmile）— 完整跨境线路
  - `仅国际干线`（international_trunk_only）— 需组合使用
  - `仅海外尾程派送`（overseas_lastmile_only）— 需组合使用
- 组合线路：同货代的「仅国际干线」+「仅海外尾程派送」自动配对，前缀区分「国际干线」与「海外尾程」
- 派送到门标签：`last_mile_door = true` 显示绿色「派送到门」徽章，`false/null` 显示琥珀色「需向货代确认最终派送地点」

### 3. 服务类型归一化
- 数据库存储 20+ 种中文业务值，后端 `normalizeServiceType()` 统一归一化为英文枚举 + 中文标签
- 包税类：双清包税到门 / 双清包税 / DDP / 包逆算
- 自税类：DDU / DAP / 自税递延 / PVA / ACP逆算
- 其他：单票单清 / 客户自行提货 / 平台送仓 / 标准服务
- 前端按包税（蓝）/ 自税（橙）/ 未知（灰）分色显示徽章

### 4. 统一附加费计算
- 匹配到计费规则后，所有非空附加费字段自动纳入计算输出
- 11 个附加费字段：超长 / 超重 / 超周长 / 偏远地区 / 燃油 / 挂号费 / 清关费 / POD签收费 / 税费 / 木箱包装费 / 木架包装费
- 统一收集为 `surchargeItems[]` 数组（含 label + amount + description）
- 总价 = 重量计费 + 所有附加费之和
- 前端动态渲染，无需硬编码每个字段

### 5. 线路管理后台（`/logistics-routes`）
- 启用/禁用线路（`'启用'`/`'禁用'`）
- CRUD 线路主信息 + 嵌套的报价规则（抽屉式 Tab）
- 报价规则重量段重叠校验
- 批量从多维表格/JSON 导入线路与规则（`batchUpsertFromJson`，事务保护）
- 一键同步启用线路到飞书多维表格（`syncToBitable`）
- 批量重算运输类型

### 6. 用户输入历史（`/user-input-history`）
- 按批次时间分组记录用户每次询价的输入
- 支持按字段名模糊搜索历史值（自动补全）
- 按用户隔离

---

## 技术栈

| 层         | 选型                                                        |
| ---------- | ----------------------------------------------------------- |
| 后端框架   | NestJS 10 + TypeScript                                      |
| 前端框架   | React 19 + React Router v6 + TypeScript                     |
| 样式       | Tailwind CSS + shadcn/ui + 自定义色彩 token                 |
| 数据库     | PostgreSQL + Drizzle ORM                                    |
| 图标       | lucide-react                                                |
| 图表       | ReactECharts（按需）                                        |
| 平台       | 妙搭（Miaoda）全栈沙箱，Rspack 构建，单环境 DB               |
| 外部集成   | 飞书多维表格 Plugin（`capabilityService`）                   |

---

## 项目结构

```
├── client/                            # React 前端
│   ├── src/
│   │   ├── app.tsx                    # 路由定义
│   │   ├── api/index.ts               # 聚合后端 API 调用
│   │   ├── components/
│   │   │   ├── Layout.tsx             # 顶部导航布局
│   │   │   ├── ui/                    # shadcn/ui 组件库
│   │   │   └── business-ui/           # 用户/部门选择等业务组件
│   │   └── pages/
│   │       ├── LogisticsInquiry/      # 询价工作台（首页）
│   │       │   ├── LogisticsInquiryPage.tsx
│   │       │   ├── InquiryForm.tsx
│   │       │   ├── InquiryResults.tsx
│   │       │   ├── utils/parseInquiryText.ts   # 粘贴识别解析器
│   │       │   ├── hooks/useInputHistory.ts
│   │       │   └── components/HistoryInput.tsx
│   │       ├── LogisticsRoutes/       # 线路管理后台
│   │       │   ├── LogisticsRoutesPage.tsx
│   │       │   ├── RouteDetailSheet.tsx
│   │       │   ├── PricingRulesTab.tsx
│   │       │   ├── PricingRuleDialog.tsx
│   │       │   └── CreateRouteDialog.tsx
│   │       └── UserInputHistory/
├── server/                            # NestJS 后端
│   ├── app.module.ts                  # 根模块
│   ├── database/schema.ts             # Drizzle 自动生成（禁手改）
│   └── modules/
│       ├── view/                      # 模板渲染（平台禁改）
│       ├── logistics-routes/          # 线路 & 报价规则 CRUD
│       │   ├── logistics-routes.controller.ts
│       │   ├── logistics-routes.service.ts
│       │   └── logistics-routes.module.ts
│       └── logistics-inquiry/         # 询价计算核心
│           ├── logistics-inquiry.controller.ts
│           ├── logistics-inquiry.service.ts
│           └── logistics-inquiry.module.ts
└── shared/
    └── api.interface.ts               # 前后端共享类型（权威来源）
```

---

## 数据模型

### 主表

| 表名                           | 说明                                              | 关键字段                                                                                   |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `logistics_route`              | 物流线路（数千条，已按 `route_code` 去重）       | `name`, `provider_name`, `cover_countries`, `is_active`, `billing_mode`, `transport_type`, `service_type`, `last_mile_door`, `route_code` |
| `pricing_rule`                 | 报价规则（数万条，双关联 `route_id` + `route_code`，级联删除） | `route_id`, `route_code`, `min_weight`, `max_weight`, `unit_price`, `first_weight_price`, `continued_weight_price`, `countries`, 11 个附加费字段 |
| `freight_forwarder_coop_count` | 货代合作次数（多维表格同步）                       | `freight_forwarder_shortname`, `cooperation_times`                                         |
| `forwarder_supplier_payment`   | 货代账期与付款方式（多维表格同步）                 | `name`, `payment_term`, `payment_method`                                                   |
| `user_input_history`           | 用户询价输入历史                                  | `user_id`, `field_name`, `field_value`, `last_used_at`                                     |
| `agent_country_coop_count_stat`| 货代-国家合作统计（多维表格同步）                 | `country`, `cooperation_count` (jsonb)                                                     |

> 带 `Synced table` 注释的表为**多维表格自动同步**，禁止重命名或删除；其 `base_record_id` 为多维表格原始记录 ID。

### 数据治理现状

- **`logistics_route` 去重**：已按 `route_code`（非 NULL 部分）保留 `_created_at` 最早记录，删除 145 条重复；`route_code` 建有部分唯一索引 `unq_logistics_route_route_code_notnull`（`WHERE route_code IS NOT NULL`），数据库级防止再次产生重复
- **货代分布**：Top 3 货代占线路总数近一半（示例数据）
- **`pricing_rule` 双关联**：`route_id`（UUID，FK `ON DELETE CASCADE`）+ `route_code`（varchar 100，主业务关联键）。多维表格导入时按 `route_code` 反查 `logistics_route.id` 自动回填 `route_id`；未匹配的孤儿规则 `route_id` 留空，待后续线路导入后由 `batchUpsertFromJson` 末尾的 UPDATE 自动回填
- **批量加载优化**：询价流程使用 `WHERE routeId IN (...)` 批量加载 `pricing_rule`，避免 N+1 查询

### 计费模式枚举（`logistics_route.billing_mode`）

| 值                  | 语义                                  |
| ------------------- | ------------------------------------- |
| `actual_weight`     | 仅按实重计费                          |
| `volumetric_weight` | 仅按体积重计费（除数默认 6000）        |
| `max_both`（默认）  | 取实重与体积重较大值                  |
| `volume`            | 按 CBM 体积计费（unit_price 作 CBM 单价）|

### 运输类型枚举（`logistics_route.transport_type`）

| DB 值                  | 代码枚举                   | 说明                               |
| ---------------------- | -------------------------- | ---------------------------------- |
| `干线+尾程派送`        | `trunk_lastmile`           | 完整跨境线路                       |
| `仅国际干线`           | `international_trunk_only` | 需与尾程组合                       |
| `仅海外尾程派送`       | `overseas_lastmile_only`   | 需与干线组合                       |
| （组合路线，代码生成）  | `combined`                 | 同货代干线+尾程自动配对            |

### 附加费字段一览（`pricing_rule`）

| 字段名                  | 类型          | 说明           |
| ----------------------- | ------------- | -------------- |
| `over_length_surcharge` | varchar(1000) | 超长附加费     |
| `over_weight_surcharge` | varchar(1000) | 超重附加费     |
| `over_perimeter_surcharge` | varchar(1000) | 超周长附加费 |
| `remote_area_surcharge` | varchar(1000) | 偏远地区附加费 |
| `fuel_surcharge`        | varchar(500)  | 燃油附加费     |
| `registration_fee`      | varchar(100)  | 挂号费         |
| `customs_clearance_fee` | varchar(100)  | 清关费         |
| `pod_fee`               | varchar(100)  | POD签收费      |
| `tax_fee`               | varchar(500)  | 税费           |
| `wooden_box_price`      | numeric       | 木箱包装费     |
| `wooden_frame_price`    | numeric       | 木架包装费     |

所有非空附加费在询价匹配时统一收集到 `surchargeItems[]` 数组并参与总价计算。

---

## 主要 API

### 询价
- `POST /api/logistics-inquiry` — 输入货物信息，返回打分排序后的候选线路列表

### 线路管理
- `GET    /api/logistics-routes`                     — 分页列表（支持国家/启用状态过滤）
- `GET    /api/logistics-routes/dimension-limits`     — 批量获取线路尺寸限制
- `POST   /api/logistics-routes`                     — 创建线路
- `GET    /api/logistics-routes/:id`                 — 线路详情 + 报价规则
- `PUT    /api/logistics-routes/:id`                 — 更新线路基本信息
- `PATCH  /api/logistics-routes/:id/toggle-status`   — 切换启用/禁用
- `DELETE /api/logistics-routes/:id`                 — 删除线路（级联删规则）

### 报价规则
- `POST   /api/logistics-routes/:id/pricing-rules`          — 新建规则
- `PUT    /api/logistics-routes/pricing-rules/:id`          — 更新规则
- `DELETE /api/logistics-routes/pricing-rules/:id`          — 删除规则

### 批量导入与同步
- `POST  /api/logistics-routes/batch-upsert`                — 从 JSON（含多维表格）批量 upsert
- `POST  /api/logistics-routes/sync-bitable`                — 启用线路同步到飞书多维表格
- `POST  /api/logistics-routes/recalculate-transport-types` — 批量重算运输类型

### 用户历史
- `GET    /api/logistics-inquiry/user-history`               — 字段级历史（自动补全）
- `POST   /api/logistics-inquiry/user-history`               — 保存本次输入
- `DELETE /api/logistics-inquiry/user-history`               — 清空历史
- `GET    /api/logistics-inquiry/user-history-list`          — 分页批次列表

---

## 核心计算逻辑速览

### 体积重（`calcVolumetricWeight`）

```
单件体积 = (长 + 木箱膨胀) x (宽 + 木箱膨胀) x (高 + 木箱膨胀)
总体积 cm3 = Sum(单件体积 x 数量)
体积重 kg = ceil(总体积 / 6000)
```

木箱/木架膨胀规则：长宽各 **+5cm**，高 **+15cm**。
邮政线（EMS/ems/e特快）三边均 <=40cm 的小包裹忽略不计。

### 运费公式

| 模式              | 公式                                                       |
| ----------------- | ---------------------------------------------------------- |
| `first_weight_50g`  | `首重费 + 续重费 x (ceil(weight x 1000/50) - 1)`             |
| `first_weight_500g` | `首重费 + 续重费 x (ceil(weight x 1000/500) - 1)`            |
| `first_weight_1kg`  | `首重费 + 续重费 x max(weight - 1, 0)`                       |
| `per_kg`            | `unit_price x weight`                                       |
| `per_item_per_kg`   | `min_charge + unit_price x weight`                          |
| `volume`（CBM）     | `unit_price x (cm3 / 1,000,000)`                            |

所有模式统一兜底：`max(计算结果, min_charge)`。`min_charge` 字段为 varchar(100)，`parseFloat` + `Number.isFinite` 兜底为 0。

### 附加费计算

匹配到计费规则后，11 个附加费字段中所有非空项统一收集到 `surchargeItems[]`：

```
总价 = 重量计费 + Sum(所有非空附加费)
```

- 燃油附加费：`base_freight x rate`（百分比计算）
- 超长/超重/偏远：函数尝试结构化解析，失败则 `parseSimpleFee` 从文本提取数值
- 其他费用（挂号/清关/POD/税费/包装费等）：`parseSimpleFee` 直接提取数值

### 综合打分

```
score = (minPrice/price) x 0.45 + (minDays/days) x 0.30 + (coop/maxCoop) x 0.15 + (payDays/maxPayDays) x 0.10
```

四维度数据源：
- `price` / `days`：当前线路计算值（时效取 `min_delivery_days` 或 `max_delivery_days`）
- `coop`：`freight_forwarder_coop_count.cooperation_times`（按货代简称反查，名称归一化走 `FORWARDER_NAME_MAP`）
- `payDays`：`forwarder_supplier_payment.payment_term`（清洗文本提取天数）

---

## 本地开发

> 本项目运行在妙搭沙箱环境中，依赖已预装，无需手动 `npm install`。

```bash
# 启动 devServer（前后端自动热重载）
npm run dev

# 重启 devServer（日志过期时）
pkill -f "npm run dev"
```

### 关键脚本
- `npm run dev` — 同时启动 client + server 开发服务
- `npm run build` — 生产构建（由妙搭平台自动执行）

### 日志查看
- 服务端：`read_logs logSource=server-devserver` / `server`
- 客户端：`read_logs logSource=client-devserver`

---

## 测试与验证

- **接口自测**：使用 `api_request` 工具调用 `/api/logistics-inquiry` 等
- **数据库查询**：`miaoda db sql "<SQL>"`
- **表结构查看**：`miaoda db schema get <table>`
- **E2E 验收**：通过妙搭 E2E subagent 进行浏览器验收测试

---

## 已知限制 / 待优化

1. **超长/超重/偏远附加费函数占位**：`calcOversizeSurcharge` / `calcOverweightSurcharge` / `calcRemoteAreaSurcharge` 三个函数当前返回 `null`，非空字段由 `parseSimpleFee` 兜底提取数值
2. **体积重除数硬编码 6000**：未支持按线路自定义（如 5000/8000）
3. **货代名称映射静态化**：`FORWARDER_NAME_MAP` 仅少量硬编码映射（示例货代A/B/C），扩展性不足
4. **14 个历史 Excel sheet 未解析**：日本渠道、墨西哥渠道、海外仓等结构特殊
5. **托盘费（pallet_fee）**：jsonb 分区结构，尚未接入询价计算

---

## 相关文档

- `AGENTS.md` — UI 设计规范与代码约定（权威来源）
- `shared/api.interface.ts` — 前后端共享类型定义
- `client/src/components/ui/README.md` — shadcn/ui 使用指南
- `client/src/components/business-ui/README.md` — 业务组件使用指南

---

## 团队信息

- **所属公司**：示例电商团队（已脱敏）
- **所属部门**：效率小组
- **主要用户**：跨境电商物流运营与专员
- **维护者**：示例维护者

---

*文档最后更新：2026-08-06*
