#!/usr/bin/env python3
"""
飞书多维表格写入脚本 v3
写入指定的路由表和报价规则表
"""

import argparse, json, os, sys, time

try:
    from coze_workload_identity import requests
except ImportError:
    print(json.dumps({"error":"coze_workload_identity不可用，需在Coze智能体中运行"},ensure_ascii=False))
    sys.exit(1)

# ============================================================
# 配置（通过环境变量注入，仓库内不包含真实资源标识）
# ============================================================
APP_TOKEN = os.environ.get("COZE_FEISHU_APP_TOKEN", "").strip()
ROUTE_TABLE_ID = os.environ.get("COZE_FEISHU_ROUTE_TABLE_ID", "").strip()
PRICING_TABLE_ID = os.environ.get("COZE_FEISHU_PRICING_TABLE_ID", "").strip()

FEISHU_BASE = "https://open.feishu.cn/open-apis/bitable/v1"

# ============================================================
# 路线表字段映射 - 与飞书多维表字段名精确匹配
# ============================================================

ROUTE_FIELD_MAP = {
    "货代名称": "provider_name",
    "路线名称": "name",
    "覆盖国家或地区": "cover_countries",
    "覆盖城市": "cover_cities",
    "支持邮编范围": "postal_code_range",
    "支持物品类型（逗号分隔）": "supported_categories",
    "最小物流时效（天数）": "min_delivery_days",
    "最大物流时效（天数）": "max_delivery_days",
    "是否启用": "is_active",
    "能接受的包装类型（逗号分隔）": "packaging_restriction",
    "渠道类型（air/sea/land）": "channel_type",
    "运输类型（干线+尾程双清派送/仅国际干线/仅海外尾程派送）": "transport_type",
    "是否尾程派送到门": "door_delivery",
    "体积限制（cm）": "sum_dimension_limit",
    "最长边限制（cm）": "longest_side_limit",
    "清关模式": "customs_mode",
    "报价币种": "currency",
}

PRICING_FIELD_MAP = {
    "线路名称": "route_name",
    "适用国家": "countries",
    "适用地区": "applicable_region",
    "适用邮编范围": "applicable_postal_range",
    "最小重量限制": "min_weight",
    "最大重量限制": "max_weight",
    "最大长度限制": "max_length",
    "最小长度限制": "min_length",
    "单价": "unit_price",
    "单价计费单位": "unit_price_unit",
    "首重价格": "first_weight_price",
    "首重单位": "first_weight_unit",
    "续重价格": "continued_weight_price",
    "续重单位": "continued_weight_unit",
    "最低收费": "min_charge",
    "包装单位": "packaging_billing_unit",
    "木箱包装单价": "packaging_fee_wooden_crate",
    "木架包装单价": "packaging_fee_wooden_frame",
    "超长附加费（最长边超出长度限制）": "overlength_surcharge",
    "超重附加费（实重超出重量限制）": "overweight_surcharge",
    "超围长附加费(围长：长+2x（宽+高）)": "overgirth_surcharge",
    "税费": "tax_mode",
    "挂号费": "registration_fee",
    "燃油附加费": "fuel_surcharge_rate",
    "报关费": "customs_declaration_fee",
    "偏远地区附加费": "remote_area_surcharge",
    "签收证明费": "pod_fee",
    "报价备注": "remark",
}

BATCH_SIZE = 450  # 留余量，避免超500上限


def get_headers():
    token = os.environ.get("COZE_FEISHU_BITABLE_TOKEN", "").strip()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json; charset=utf-8",
    }


def get_table_fields(table_id):
    """获取飞书表格的字段列表，返回 {字段名: field_id}"""
    url = f"{FEISHU_BASE}/apps/{APP_TOKEN}/tables/{table_id}/fields"
    resp = requests.get(url, headers=get_headers())
    if resp.status_code != 200:
        raise Exception(f"获取字段列表失败: {resp.status_code} {resp.text}")
    data = resp.json()
    if data.get("code",-1) != 0:
        raise Exception(f"获取字段列表失败: {data}")
    fields = {}
    for item in data.get("data",{}).get("items",[]):
        fields[item["field_name"]] = item["field_id"]
    return fields


def format_value(field_name, value, field_type=None):
    """根据字段名推断格式化值"""
    if value is None: return None
    if isinstance(value, bool):
        return value
    if isinstance(value, (int,float)):
        if field_name and ("时效" in field_name or "天数" in field_name):
            return int(value)
        if field_name and ("限制" in field_name or "长度" in field_name):
            return int(value) if value>0 else None
        return value
    if isinstance(value, str):
        return value[:2000] if len(value)>2000 else value
    return str(value)


def build_record(data, field_map, fields_info):
    """构建飞书记录：{field_id: value}"""
    record = {}
    for feishu_name, data_key in field_map.items():
        if feishu_name not in fields_info:
            continue
        fid = fields_info[feishu_name]
        val = data.get(data_key)
        formatted = format_value(feishu_name, val)
        if formatted is not None:
            record[fid] = formatted
    return record


def batch_create(table_id, records, headers):
    """批量创建记录，自动分批"""
    total = len(records)
    created = 0
    for i in range(0, total, BATCH_SIZE):
        batch = records[i:i+BATCH_SIZE]
        url = f"{FEISHU_BASE}/apps/{APP_TOKEN}/tables/{table_id}/records/batch_create"
        body = {"records": [{"fields": r} for r in batch]}
        resp = requests.post(url, headers=headers, json=body)
        if resp.status_code != 200:
            print(f"[WARN] 批次{i//BATCH_SIZE+1}失败: {resp.status_code} {resp.text[:200]}",
                  file=sys.stderr)
            # 尝试单条写入
            for j, rec in enumerate(batch):
                single_url = f"{FEISHU_BASE}/apps/{APP_TOKEN}/tables/{table_id}/records"
                sresp = requests.post(single_url, headers=headers,
                                     json={"fields": rec})
                if sresp.status_code == 200:
                    created += 1
                else:
                    print(f"[WARN] 记录{i+j}失败: {sresp.status_code} {sresp.text[:200]}",
                          file=sys.stderr)
            time.sleep(0.5)
        else:
            rdata = resp.json()
            if rdata.get("code",-1) == 0:
                cnt = len(rdata.get("data",{}).get("records",[]))
                created += cnt
                print(f"[OK] 批次{i//BATCH_SIZE+1}: {cnt}条", file=sys.stderr)
            else:
                print(f"[WARN] 批次{i//BATCH_SIZE+1}错误: {rdata}", file=sys.stderr)
            time.sleep(0.5)
    return created


def clear_table(table_id):
    """清空表格现有数据"""
    headers = get_headers()
    all_ids = []
    page_token = None
    while True:
        url = f"{FEISHU_BASE}/apps/{APP_TOKEN}/tables/{table_id}/records"
        params = {"page_size": 500}
        if page_token: params["page_token"] = page_token
        resp = requests.get(url, headers=headers, params=params)
        if resp.status_code != 200: break
        data = resp.json()
        if data.get("code",-1) != 0: break
        items = data.get("data",{}).get("items",[])
        for item in items:
            all_ids.append(item.get("record_id",""))
        if not data.get("data",{}).get("has_more"): break
        page_token = data.get("data",{}).get("page_token","")
        time.sleep(0.1)

    # 分批删除
    deleted = 0
    for i in range(0, len(all_ids), 500):
        batch = all_ids[i:i+500]
        url = f"{FEISHU_BASE}/apps/{APP_TOKEN}/tables/{table_id}/records/batch_delete"
        body = {"records": batch}
        resp = requests.post(url, headers=headers, json=body)
        if resp.status_code == 200:
            deleted += len(batch)
        time.sleep(0.3)
    return deleted


def main():
    p = argparse.ArgumentParser(description="飞书多维表格写入脚本 v3")
    p.add_argument("--input", required=True, help="解析器输出的JSON文件")
    p.add_argument("--clear", action="store_true", help="写入前清空表格")
    args = p.parse_args()

    missing = [name for name, value in {
        "COZE_FEISHU_APP_TOKEN": APP_TOKEN,
        "COZE_FEISHU_ROUTE_TABLE_ID": ROUTE_TABLE_ID,
        "COZE_FEISHU_PRICING_TABLE_ID": PRICING_TABLE_ID,
        "COZE_FEISHU_BITABLE_TOKEN": os.environ.get("COZE_FEISHU_BITABLE_TOKEN", "").strip(),
    }.items() if not value]
    if missing:
        print(json.dumps({"error": f"缺少环境变量: {', '.join(missing)}"}, ensure_ascii=False))
        sys.exit(1)

    if not os.path.exists(args.input):
        print(json.dumps({"error":f"文件不存在: {args.input}"},ensure_ascii=False)); sys.exit(1)

    with open(args.input,'r',encoding='utf-8') as f:
        data = json.load(f)

    routes = data.get("routes",[])
    pricing = data.get("pricing",[])

    if not routes and not pricing:
        print(json.dumps({"error":"无数据可写入"},ensure_ascii=False)); sys.exit(1)

    headers = get_headers()
    if not headers["Authorization"]:
        print(json.dumps({"error":"飞书凭证未配置"},ensure_ascii=False)); sys.exit(1)

    # 获取字段信息
    print("[INFO] 获取路由表字段...", file=sys.stderr)
    route_fields = get_table_fields(ROUTE_TABLE_ID)
    print(f"[INFO] 路由表字段: {list(route_fields.keys())}", file=sys.stderr)

    print("[INFO] 获取报价规则表字段...", file=sys.stderr)
    pricing_fields = get_table_fields(PRICING_TABLE_ID)
    print(f"[INFO] 报价规则表字段: {list(pricing_fields.keys())}", file=sys.stderr)

    # 清空
    if args.clear:
        print(f"[INFO] 清空路由表...", file=sys.stderr)
        d1 = clear_table(ROUTE_TABLE_ID)
        print(f"[OK] 路由表已清空 {d1} 条", file=sys.stderr)
        print(f"[INFO] 清空报价规则表...", file=sys.stderr)
        d2 = clear_table(PRICING_TABLE_ID)
        print(f"[OK] 报价规则表已清空 {d2} 条", file=sys.stderr)

    # 构建记录
    route_records = []
    for r in routes:
        rec = build_record(r, ROUTE_FIELD_MAP, route_fields)
        if rec: route_records.append(rec)

    pricing_records = []
    for p in pricing:
        rec = build_record(p, PRICING_FIELD_MAP, pricing_fields)
        if rec: pricing_records.append(rec)

    # 写入
    print(f"[INFO] 写入路由表 {len(route_records)} 条...", file=sys.stderr)
    rc = batch_create(ROUTE_TABLE_ID, route_records, headers)
    print(f"[INFO] 写入报价规则表 {len(pricing_records)} 条...", file=sys.stderr)
    pc = batch_create(PRICING_TABLE_ID, pricing_records, headers)

    result = {
        "status": "success",
        "routes_written": rc,
        "pricing_written": pc,
        "routes_total": len(routes),
        "pricing_total": len(pricing),
        "app_token": APP_TOKEN,
        "route_table_id": ROUTE_TABLE_ID,
        "pricing_table_id": PRICING_TABLE_ID,
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
