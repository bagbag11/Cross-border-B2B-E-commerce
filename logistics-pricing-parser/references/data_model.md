# 飞书多维表格数据模型

## 目录
1. 路线表字段定义
2. 计费规则表字段定义
3. 4种计费规则类型
4. 解析器输出JSON结构
5. 验证规则

---

## 1. 路线表字段定义

app_token: `${COZE_FEISHU_APP_TOKEN}`
table_id: `${COZE_FEISHU_ROUTE_TABLE_ID}`

| 飞书字段名 | 数据类型 | 必填 | 说明 |
|-----------|---------|------|------|
| 货代名称 | 文本 | 是 | 满天星/惠运捷/元昊/中国邮政 |
| 路线名称 | 文本 | 是 | 主键，格式"产品名-国家"，如"空派-美国" |
| 覆盖国家或地区 | 文本 | 是 | 目的地国家 |
| 覆盖城市 | 文本 | 否 | 派送城市或口岸，全境填"全境" |
| 支持邮编范围 | 文本 | 否 | 如"8,9开头"，仅限特定邮编时填写 |
| 支持物品类型（逗号分隔） | 文本 | 否 | 普货,带电,纯电,特货,液粉膏状 |
| 最小物流时效（天数） | 数字 | 否 | 物流时长左区间 |
| 最大物流时效（天数） | 数字 | 否 | 物流时长右区间 |
| 是否启用 | 复选框 | 是 | 默认勾选 |
| 能接受的包装类型（逗号分隔） | 文本 | 否 | 纸箱,木箱,托盘,软包装 |
| 渠道类型（air/sea/land） | 单选 | 是 | air/sea/rail/truck/express/postal |
| 运输类型 | 单选 | 是 | 干线+尾程双清派送/仅国际干线/仅海外尾程派送 |
| 是否尾程派送到门 | 复选框 | 否 | 默认勾选 |
| 体积限制（cm） | 数字 | 否 | 三边和或体积上限 |
| 最长边限制（cm） | 数字 | 否 | 单件最长边物理上限 |
| 清关模式 | 单选 | 否 | DDP/DDU-DAP/PVA/双清到仓自提/CIF-CFR |
| 报价币种 | 单选 | 是 | CNY/USD |

## 2. 计费规则表字段定义

table_id: `${COZE_FEISHU_PRICING_TABLE_ID}`

| 飞书字段名 | 数据类型 | 必填 | 说明 |
|-----------|---------|------|------|
| 线路名称 | 文本 | 是 | 外键，与路线表"路线名称"一字不差 |
| 适用国家 | 文本 | 否 | 同一渠道下不同目的地的阶梯价格 |
| 适用地区 | 文本 | 否 | 如"美西"、"美东" |
| 适用邮编范围 | 文本 | 否 | 如"8-9开头" |
| 最小重量限制 | 数字 | 是 | 该档位起始重量(kg) |
| 最大重量限制 | 数字 | 否 | 该档位结束重量(kg) |
| 最大长度限制 | 数字 | 否 | 最长边限制(cm) |
| 最小长度限制 | 数字 | 否 | 最小长度限制(cm) |
| 单价 | 数字 | 否 | 每单位价格 |
| 单价计费单位 | 文本 | 否 | KG/500g/50g/件/托盘 |
| 首重价格 | 数字 | 否 | 首重/首件起步价 |
| 首重单位 | 文本 | 否 | KG/500g/50g/件 |
| 续重价格 | 数字 | 否 | 续重/续件单价 |
| 续重单位 | 文本 | 否 | KG/500g/50g/件 |
| 最低收费 | 数字 | 否 | 最低消费额 |
| 包装单位 | 文本 | 否 | 箱/托盘/件 |
| 木箱包装单价 | 数字 | 否 | 货代代打木箱费用 |
| 木架包装单价 | 数字 | 否 | 货代代打木架费用 |
| 超长附加费 | 数字 | 否 | 超长单件罚金(元/件) |
| 超重附加费 | 数字 | 否 | 超重单件罚金(元/件) |
| 超围长附加费 | 数字 | 否 | 超围长罚金(元/件) |
| 税费 | 文本 | 否 | 包税/自税/自税递延 |
| 挂号费 | 数字 | 否 | 小包挂号处理费 |
| 燃油附加费 | 文本/数字 | 否 | 快递类燃油附加费比例 |
| 报关费 | 数字 | 否 | 专线报关费(元/票) |
| 偏远地区附加费 | 数字 | 否 | 偏远邮编附加费 |
| 签收证明费 | 数字 | 否 | POD签收证明费 |
| 报价备注 | 文本 | 否 | 特殊条款 |

## 3. 4种计费规则类型

### standard（标准重量段）
最常用。按重量区间阶梯定价。
```
最小重量限制=21, 最大重量限制=50, 单价=28.5, 单价计费单位=KG
最小重量限制=51, 最大重量限制=100, 单价=25.0, 单价计费单位=KG
```

### first_continue（首重+续重）
用于邮政/快递类。首重起步价+续重单价。
```
首重价格=70, 首重单位=500g, 续重价格=10, 续重单位=500g
```

### per_item_plus_kg（每件+每公斤）
E邮宝/E特快类。挂号费按件+按重量。
```
挂号费=15, 续重价格=80, 续重单位=KG
```

### pallet（按托盘/按次）
尾程卡车/FBA卡派。按托盘计费。
```
最低收费=150, 包装单位=托盘
```

## 4. 解析器输出JSON结构

```json
{
  "supplier_name": "满天星",
  "file_name": "报价表.xlsx",
  "parse_time": "2026-07-27T...",
  "stats": {"routes": 171, "pricing": 278, "packaging_fees": 5},
  "routes": [
    {
      "id": "MTX-空派-美国",
      "provider_name": "满天星",
      "name": "空派-美国",
      "cover_countries": "美国",
      "cover_cities": "",
      "postal_code_range": "",
      "supported_categories": "普货",
      "min_delivery_days": 7,
      "max_delivery_days": 10,
      "is_active": true,
      "packaging_restriction": "纸箱",
      "channel_type": "air",
      "transport_type": "干线+尾程双清派送",
      "door_delivery": true,
      "sum_dimension_limit": null,
      "longest_side_limit": 120,
      "customs_mode": "DDP",
      "currency": "CNY",
      "remark": "计泡6000 报关费350元/票"
    }
  ],
  "pricing": [
    {
      "route_name": "空派-美国",
      "countries": "美国",
      "applicable_region": "",
      "applicable_postal_range": "",
      "min_weight": 21,
      "max_weight": 50,
      "max_length": null,
      "min_length": null,
      "unit_price": 28.5,
      "unit_price_unit": "KG",
      "first_weight_price": null,
      "first_weight_unit": "KG",
      "continued_weight_price": null,
      "continued_weight_unit": "KG",
      "min_charge": null,
      "packaging_billing_unit": "",
      "packaging_fee_wooden_crate": null,
      "packaging_fee_wooden_frame": null,
      "overlength_surcharge": null,
      "overweight_surcharge": null,
      "overgirth_surcharge": null,
      "tax_mode": "包税",
      "registration_fee": null,
      "fuel_surcharge_rate": null,
      "customs_declaration_fee": 350,
      "remote_area_surcharge": null,
      "pod_fee": null,
      "remark": "计泡6000"
    }
  ]
}
```

## 5. 验证规则

### 路线表
1. 路线名称必须唯一，同一货代同一产品+国家不能重复
2. channel_type必须是以下之一：air/sea/rail/truck/express/postal
3. 最小物流时效 ≤ 最大物流时效
4. 报价币种必须是CNY或USD

### 计费规则表
1. 线路名称必须与路线表中某条路线的名称完全一致
2. 最小重量限制 ≤ 最大重量限制
3. 单价、首重价格、续重价格至少填一个
4. 单价计费单位如果填写了单价就必须填写

### 关联一致性
- pricing[].route_name 必须存在于 routes[].name 中
- 删除路线时必须同时删除关联的报价规则
