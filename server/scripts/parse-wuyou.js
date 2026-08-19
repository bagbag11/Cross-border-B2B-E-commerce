const XLSX = require('xlsx');
const path = require('path');
const http = require('http');

const DIR = './attachments';
const FILE = 'example-freight-quote.xlsx';

const API_BASE = '/app/app_xxxxxxxxxxxx/api';
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'x-larkgw-suda-webuser': '%7B%22user_id%22%3A%220000000000000000%22%2C%22tenant_id%22%3A00000000%2C%22app_id%22%3A%22app_xxxxxxxxxxxx%22%7D',
  'x-suda-csrf-token': 'test',
  'cookie': 'suda-csrf-token=test',
};

function apiCall(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1', port: 8001,
      path: API_BASE + urlPath,
      method,
      headers: { ...HEADERS },
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const req = http.request(options, (res) => {
      let b = ''; res.on('data', (c) => b += c); res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Country code to Chinese name mapping (common ones from logistics)
const COUNTRY_CODE_MAP = {
  'RU': '俄罗斯', 'US': '美国', 'GB': '英国', 'DE': '德国', 'FR': '法国',
  'AU': '澳大利亚', 'CA': '加拿大', 'BR': '巴西', 'ES': '西班牙', 'IT': '意大利',
  'NL': '荷兰', 'SE': '瑞典', 'NO': '挪威', 'DK': '丹麦', 'FI': '芬兰',
  'PL': '波兰', 'CZ': '捷克', 'HU': '匈牙利', 'RO': '罗马尼亚', 'BG': '保加利亚',
  'HR': '克罗地亚', 'SK': '斯洛伐克', 'SI': '斯洛文尼亚', 'EE': '爱沙尼亚',
  'LV': '拉脱维亚', 'LT': '立陶宛', 'LU': '卢森堡', 'MT': '马耳他', 'CY': '塞浦路斯',
  'GR': '希腊', 'PT': '葡萄牙', 'IE': '爱尔兰', 'AT': '奥地利', 'BE': '比利时',
  'CH': '瑞士', 'IL': '以色列', 'SA': '沙特阿拉伯', 'AE': '阿拉伯联合酋长国',
  'KW': '科威特', 'QA': '卡塔尔', 'BH': '巴林', 'OM': '阿曼',
  'UA': '乌克兰', 'BY': '白俄罗斯', 'KZ': '哈萨克斯坦', 'KG': '吉尔吉斯斯坦',
  'UZ': '乌兹别克斯坦', 'GE': '格鲁吉亚', 'AM': '亚美尼亚', 'AZ': '阿塞拜疆',
  'TR': '土耳其', 'JP': '日本', 'KR': '韩国', 'SG': '新加坡', 'MY': '马来西亚',
  'TH': '泰国', 'ID': '印度尼西亚', 'PH': '菲律宾', 'VN': '越南',
  'IN': '印度', 'PK': '巴基斯坦', 'BD': '孟加拉国', 'LK': '斯里兰卡',
  'NZ': '新西兰', 'MX': '墨西哥', 'CL': '智利', 'CO': '哥伦比亚',
  'PE': '秘鲁', 'AR': '阿根廷', 'ZA': '南非', 'NG': '尼日利亚',
  'KE': '肯尼亚', 'EG': '埃及', 'MA': '摩洛哥', 'DZ': '阿尔及利亚',
  'TN': '突尼斯', 'NG': '尼日利亚',
};

// Route metadata from the directory sheet
const ROUTE_META = {
  '超级经济Global': { level: '经济类', supports: '普货,带电', currency: 'RMB' },
  '特货经济': { level: '经济类', supports: '普货,带电,特货', currency: 'RMB' },
  '超级经济': { level: '经济类', supports: '普货,带电', currency: 'USD' },
  '威海优选仓-韩国经济专线': { level: '经济类', supports: '普货', currency: 'RMB' },
  '超级经济-顺友': { level: '经济类', supports: '普货', currency: 'RMB' },
  '超级经济-燕文': { level: '经济类', supports: '普货', currency: 'RMB' },
  '无忧物流-特惠': { level: '简易类', supports: '普货,带电', currency: 'USD' },
  '特货专线－简易': { level: '简易类', supports: '普货,带电,特货', currency: 'RMB' },
  '无忧物流-标准': { level: '标准类', supports: '普货,带电', currency: 'RMB' },
  '无忧物流-标准-三方清关': { level: '标准类', supports: '普货', currency: 'RMB' },
  '无忧物流-陆运大件专线': { level: '标准类', supports: '普货,带电', currency: 'RMB' },
  '无忧物流-特货标准': { level: '标准类', supports: '普货,带电,特货', currency: 'RMB' },
  '无忧物流-海运大件专线': { level: '标准类', supports: '普货,带电,特货', currency: 'RMB' },
  '燕文航空挂号小包': { level: '标准类', supports: '普货', currency: 'RMB' },
  '4PX新邮挂号小包': { level: '标准类', supports: '普货', currency: 'RMB' },
  '中邮e邮宝': { level: '标准类', supports: '普货', currency: 'RMB' },
  '无忧物流-标准-威海优选仓': { level: '标准类', supports: '普货,带电', currency: 'RMB' },
  '无忧物流-超大件专线-优选仓': { level: '标准类', supports: '普货,带电', currency: 'RMB' },
  '无忧物流-优先': { level: '优先类', supports: '普货,带电', currency: 'RMB' },
  '无忧物流-特货标快': { level: '优先类', supports: '普货,带电,特货', currency: 'RMB' },
};

// Convert USD to RMB (approximate rate)
const USD_TO_RMB = 7.2;

function parseNum(v) {
  if (v === null || v === undefined || v === '' || v === '-') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// Parse simple pricing sheets (single tier: per-kg + per-parcel)
function parseSimpleSheet(sheetData, currency) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);

    // Different sheets have different column layouts
    // Pattern 1: [country, english, code, unitPrice, regFee] (e.g., 超级经济Global, 特货经济)
    // Pattern 2: [country, english, code, unitPrice, regFee] (e.g., 燕文航空挂号小包)
    let unitPrice = parseNum(row[3]);
    let regFee = parseNum(row[4]);

    if (unitPrice !== null) {
      // Convert USD to RMB if needed
      if (currency === 'USD') {
        unitPrice = Math.round(unitPrice * USD_TO_RMB * 100) / 100;
        if (regFee) regFee = Math.round(regFee * USD_TO_RMB * 100) / 100;
      }
      rules.push({
        country: countryName,
        countryCode: code,
        unitPrice,
        regFee: regFee || 0,
      });
    }
  }
  return rules;
}

// Parse 超级经济-顺友 (two weight tiers: 1-50g and 51-2000g)
function parseSunYou(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);
    // Columns: [country, english, code, price1, fee1, price2, fee2]
    const price1 = parseNum(row[3]);
    const fee1 = parseNum(row[4]);
    const price2 = parseNum(row[5]);
    const fee2 = parseNum(row[6]);
    if (price1 !== null) {
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '0.05', unitPrice: price1, regFee: fee1 || 0, remark: '重量1-50g' });
    }
    if (price2 !== null) {
      rules.push({ country: countryName, countryCode: code, unitPrice: price2, regFee: fee2 || 0, minWeight: '0.05', maxWeight: '2', remark: '重量51-2000g' });
    }
  }
  return rules;
}

// Parse 超级经济-燕文 (two weight tiers: 1-100g and 101-2000g)
function parseYanwen(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);
    const price1 = parseNum(row[3]);
    const fee1 = parseNum(row[4]);
    const price2 = parseNum(row[5]);
    const fee2 = parseNum(row[6]);
    if (price1 !== null) {
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '0.1', unitPrice: price1, regFee: fee1 || 0, remark: '重量1-100g' });
    }
    if (price2 !== null) {
      rules.push({ country: countryName, countryCode: code, unitPrice: price2, regFee: fee2 || 0, minWeight: '0.1', maxWeight: '2', remark: '重量101-2000g' });
    }
  }
  return rules;
}

// Parse 无忧物流-特惠 (two category tiers: 普货 and 非普货)
function parseHuihui(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);
    // [country, english, code, normalUnit, normalFee, specialUnit, specialFee]
    const normalUnit = parseNum(row[3]);
    const normalFee = parseNum(row[4]);
    const specialUnit = parseNum(row[5]);
    const specialFee = parseNum(row[6]);
    if (normalUnit !== null) {
      const price = Math.round(normalUnit * USD_TO_RMB * 100) / 100;
      const fee = normalFee ? Math.round(normalFee * USD_TO_RMB * 100) / 100 : 0;
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '2', unitPrice: price, regFee: fee, ruleType: 'standard', remark: '普货' });
    }
    if (specialUnit !== null) {
      const price = Math.round(specialUnit * USD_TO_RMB * 100) / 100;
      const fee = specialFee ? Math.round(specialFee * USD_TO_RMB * 100) / 100 : 0;
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '2', unitPrice: price, regFee: fee, ruleType: 'standard', remark: '非普货(含电池/化妆品)' });
    }
  }
  return rules;
}

// Parse 无忧物流-标准 (complex: 小包普货 3 tiers + 小包非普货 + 大包)
function parseBiaozhun(sheetData) {
  const rules = [];
  // Row layout: [country, english, code, p1, f1, p2, f2, p3, f3, np1, nf1, bigFirst, bigCont]
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);

    // 小包普货: 3 weight tiers (0-150g, 150-300g, 300-2000g)
    const p1 = parseNum(row[3]);
    const f1 = parseNum(row[4]);
    const p2 = parseNum(row[5]);
    const f2 = parseNum(row[6]);
    const p3 = parseNum(row[7]);
    const f3 = parseNum(row[8]);

    if (p1 !== null) {
      // Tier 1: 0-150g
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '0.15', unitPrice: p1, regFee: f1 || 0, ruleType: 'standard', remark: '小包普货 0-150g' });
    }
    if (p2 !== null && p2 !== 0) {
      // Tier 2: 150-300g
      rules.push({ country: countryName, countryCode: code, minWeight: '0.15', maxWeight: '0.3', unitPrice: p2, regFee: f2 || 0, ruleType: 'standard', remark: '小包普货 150-300g' });
    }
    if (p3 !== null && p3 !== 0) {
      // Tier 3: 300-2000g
      rules.push({ country: countryName, countryCode: code, minWeight: '0.3', maxWeight: '2', unitPrice: p3, regFee: f3 || 0, ruleType: 'standard', remark: '小包普货 300-2000g' });
    }

    // 小包非普货: 0-2000g
    const np1 = parseNum(row[9]);
    const nf1 = parseNum(row[10]);
    if (np1 !== null) {
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '2', unitPrice: np1, regFee: nf1 || 0, ruleType: 'standard', remark: '小包非普货 0-2000g' });
    }

    // 大包: first weight + continued weight
    const bigFirst = parseNum(row[11]);
    const bigCont = parseNum(row[12]);
    if (bigFirst !== null) {
      rules.push({
        country: countryName, countryCode: code,
        minWeight: '2', maxWeight: '30',
        firstWeightPrice: bigFirst,
        continuedWeightPrice: bigCont || 0,
        ruleType: 'standard',
        remark: '大包 2-30kg, 首重0.5kg + 续重0.5kg',
      });
    }
  }
  return rules;
}

// Parse 无忧物流-特货标准 (4 weight tiers for special goods)
function parseTehuoBiaozhun(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);

    // [country, english, code, p1, f1, p2, f2, p3, f3, p4, f4]
    // 0-150g, 150-300g, 300-500g, 500-3000g
    const tiers = [
      { min: '0', max: '0.15', pIdx: 3, fIdx: 4, label: '0-150g' },
      { min: '0.15', max: '0.3', pIdx: 5, fIdx: 6, label: '150-300g' },
      { min: '0.3', max: '0.5', pIdx: 7, fIdx: 8, label: '300-500g' },
      { min: '0.5', max: '3', pIdx: 9, fIdx: 10, label: '500-3000g' },
    ];
    for (const tier of tiers) {
      const price = parseNum(row[tier.pIdx]);
      const fee = parseNum(row[tier.fIdx]);
      if (price !== null) {
        rules.push({ country: countryName, countryCode: code, minWeight: tier.min, maxWeight: tier.max, unitPrice: price, regFee: fee || 0, ruleType: 'standard', remark: tier.label });
      }
    }
  }
  return rules;
}

// Parse 无忧物流-特货标快 (single tier, 0-3000g)
function parseTehuoBiaokuai(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);
    const price = parseNum(row[3]);
    const fee = parseNum(row[4]);
    if (price !== null) {
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '3', unitPrice: price, regFee: fee || 0, ruleType: 'standard' });
    }
  }
  return rules;
}

// Parse 无忧物流-陆运大件专线 (single tier, per 100g)
function parseLuyun(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);
    const price = parseNum(row[3]);
    const fee = parseNum(row[4]);
    if (price !== null) {
      rules.push({ country: countryName, countryCode: code, minWeight: '0', maxWeight: '31', unitPrice: price, regFee: fee || 0, ruleType: 'standard' });
    }
  }
  return rules;
}

// Parse 无忧物流-优先 (complex: country-specific pricing with multiple subsections)
function parseYouxian(sheetData) {
  const rules = [];
  // This sheet has multiple pricing sections per country group
  // Pattern: header rows describe pricing rules, then data rows follow
  // We need to track which section we're in

  let currentSection = null;

  for (let i = 0; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (!row) continue;

    const first = row[0] ? String(row[0]).trim() : '';

    // Detect section headers
    if (first.includes('美国') && first.includes('1g起重')) {
      currentSection = 'US_standard';
      continue;
    }
    if (first.includes('俄罗斯') && first.includes('100克')) {
      currentSection = 'RU_100g';
      continue;
    }
    if (first.includes('以色列') || first.includes('Israel')) {
      currentSection = 'IL_standard';
      continue;
    }

    // Check for country code data rows
    if (row[2] && typeof row[2] === 'string' && /^[A-Z]{2,3}$/.test(row[2].trim())) {
      const code = row[2].trim();
      const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);

      if (currentSection === 'US_standard') {
        // US: 5 weight tiers (1-200g, 201-400g, 401-700g, 701-2000g, 2-30kg)
        const tiers = [
          { min: '0', max: '0.2', pIdx: 3, fIdx: 4 },
          { min: '0.2', max: '0.4', pIdx: 5, fIdx: 6 },
          { min: '0.4', max: '0.7', pIdx: 7, fIdx: 8 },
          { min: '0.7', max: '2', pIdx: 9, fIdx: 10 },
          { min: '2', max: '30', pIdx: 11, fIdx: 12 },
        ];
        for (const tier of tiers) {
          const price = parseNum(row[tier.pIdx]);
          const fee = parseNum(row[tier.fIdx]);
          if (price !== null) {
            rules.push({ country: countryName, countryCode: code, minWeight: tier.min, maxWeight: tier.max, unitPrice: price, regFee: fee || 0, ruleType: 'standard' });
          }
        }
      } else if (currentSection === 'RU_100g') {
        // Russia: per 100g pricing
        const price = parseNum(row[3]);
        const fee = parseNum(row[4]);
        if (price !== null) {
          rules.push({ country: countryName, countryCode: code, unitPrice: price, regFee: fee || 0, ruleType: 'standard' });
        }
      } else {
        // Default: assume standard format (per kg + per parcel)
        const price = parseNum(row[3]);
        const fee = parseNum(row[4]);
        if (price !== null) {
          rules.push({ country: countryName, countryCode: code, unitPrice: price, regFee: fee || 0, ruleType: 'standard' });
        }
      }
    }

    // Detect section transitions
    if (first && (first.includes('俄罗斯：') || first.includes('以色列') || first.includes('其他国家'))) {
      if (first.includes('俄罗斯')) currentSection = 'RU_100g';
      else if (first.includes('以色列')) currentSection = 'IL_standard';
      else currentSection = 'default';
    }
  }
  return rules;
}

// Parse 无忧物流-海运大件专线 (detailed pricing with weight ranges)
function parseHaiyun(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row || !row[2]) continue;
    const code = String(row[2]).trim();
    if (!/^[A-Z]{2,3}$/.test(code)) continue;
    const countryName = row[0] ? String(row[0]).trim() : (COUNTRY_CODE_MAP[code] || code);

    // [country, english, code, 大小包, 计泡, 计泡系数, 货品属性, 计费模式, 始发区域, 币种, priceStart(g), priceEnd(g), 进位制(g), unitPrice, regFee]
    const priceStart = parseNum(row[10]);
    const priceEnd = parseNum(row[11]);
    const priceStep = parseNum(row[12]);
    const unitPrice = parseNum(row[13]);
    const regFee = parseNum(row[14]);
    const divisor = parseNum(row[5]);

    if (unitPrice !== null) {
      const minW = priceStart ? (priceStart / 1000).toString() : '0';
      const maxW = priceEnd ? (priceEnd / 1000).toString() : '30';
      rules.push({
        country: countryName, countryCode: code,
        minWeight: minW, maxWeight: maxW,
        unitPrice, regFee: regFee || 0,
        ruleType: 'standard',
        volumeWeightDivisor: divisor ? Math.round(divisor) : undefined,
        remark: priceEnd ? `${priceStart}g-${priceEnd}g` : `≥${priceStart}g`,
      });
    }
  }
  return rules;
}

// Parse 无忧物流-超大件专线-优选仓
function parseChaodajian(sheetData) {
  const rules = [];
  for (const row of sheetData) {
    if (!row) continue;
    // [null, 起始省, 起始市, 序号, 目的国, 重量段, 计费阶梯, 币种, unitPrice, regFee]
    const weightRange = row[5] ? String(row[5]).trim() : '';
    if (!weightRange || weightRange === '计费克重段（单位：kg）') continue;
    const unitPrice = parseNum(row[8]);
    const regFee = parseNum(row[9]);
    const country = row[4] ? String(row[4]).trim() : '';

    if (unitPrice !== null && country) {
      const parts = weightRange.split('-');
      const minW = parts[0] || '0';
      const maxW = parts[1] || '200';
      rules.push({
        country, countryCode: 'KR',
        minWeight: minW, maxWeight: maxW,
        unitPrice, regFee: regFee || 0,
        ruleType: 'standard',
        remark: `重量${weightRange}kg`,
      });
    }
  }
  return rules;
}

async function main() {
  const wb = XLSX.readFile(path.join(DIR, FILE));
  // Allow filtering to specific sheets via env var
  const filterSheets = process.env.SHEETS ? process.env.SHEETS.split(',') : null;
  const sheetNames = wb.SheetNames
    .filter(n => n !== '目录')
    .filter(n => !filterSheets || filterSheets.includes(n));

  // Pre-fetch all existing routes and build lookup map
  console.log('Fetching existing routes...');
  const existingRes = await apiCall('GET', '/logistics-routes?pageSize=500');
  const routeMap = {};
  if (existingRes.items) {
    for (const r of existingRes.items) {
      routeMap[r.name] = { id: r.id, pricingRuleCount: r.pricingRuleCount || 0 };
    }
  }
  console.log('Found ' + Object.keys(routeMap).length + ' existing routes');

  let totalRoutes = 0;
  let totalRules = 0;

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const meta = ROUTE_META[sheetName] || { level: '其他', supports: '普货', currency: 'RMB' };

    // Route name with prefix
    const routeName = '示例平台-' + sheetName;

    // Determine cover countries from data
    const countries = [];
    for (const row of data) {
      if (row && row[0] && typeof row[0] === 'string' && row[0].trim() && !row[0].includes('目录') && !row[0].includes('介绍') && !row[0].includes('上门') && !row[0].includes('计费') && !row[0].includes('运达') && !row[0].includes('特别提醒') && !row[0].includes('无忧物流') && !row[0].includes('菜鸟') && !row[0].includes('特货') && !row[0].includes('超级') && !row[0].includes('燕文') && !row[0].includes('4PX') && !row[0].includes('e邮宝') && !row[0].includes('仓发') && !row[0].includes('山东') && !row[0].includes('该报价')) {
        const name = row[0].trim();
        if (name.length > 1 && name.length < 20 && !name.includes('配送') && !name.includes('元') && !name.includes('克') && !name.includes('重') && !name.includes('包裹') && !name.includes('收货') && !name.includes('正向') && !name.includes('大小')) {
          countries.push(name);
        }
      }
    }

    // Parse pricing rules based on sheet type
    let rules = [];
    try {
      if (sheetName === '超级经济Global') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '特货经济') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '超级经济') rules = parseSimpleSheet(data, 'USD');
      else if (sheetName === '威海优选仓-韩国经济专线') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '超级经济-顺友') rules = parseSunYou(data);
      else if (sheetName === '超级经济-燕文') rules = parseYanwen(data);
      else if (sheetName === '无忧物流-特惠') rules = parseHuihui(data);
      else if (sheetName === '特货专线－简易') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '无忧物流-标准') rules = parseBiaozhun(data);
      else if (sheetName === '无忧物流-标准-三方清关') rules = parseBiaozhun(data);
      else if (sheetName === '无忧物流-特货标准') rules = parseTehuoBiaozhun(data);
      else if (sheetName === '无忧物流-特货标快') rules = parseTehuoBiaokuai(data);
      else if (sheetName === '无忧物流-陆运大件专线') rules = parseLuyun(data);
      else if (sheetName === '燕文航空挂号小包') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '4PX新邮挂号小包') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '中邮e邮宝') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '无忧物流-标准-威海优选仓') rules = parseSimpleSheet(data, 'RMB');
      else if (sheetName === '无忧物流-超大件专线-优选仓') rules = parseChaodajian(data);
      else if (sheetName === '无忧物流-海运大件专线') rules = parseHaiyun(data);
      else if (sheetName === '无忧物流-优先') rules = parseYouxian(data);
    } catch (e) {
      console.error('Error parsing ' + sheetName + ': ' + e.message);
      continue;
    }

    if (rules.length === 0) {
      console.log('SKIP ' + sheetName + ': no rules parsed');
      continue;
    }

    // Get unique countries from rules
    const uniqueCountries = [...new Set(rules.map(r => r.country))];

    console.log('\n=== ' + sheetName + ' ===');
    console.log('  Countries: ' + uniqueCountries.length + ', Rules: ' + rules.length);
    console.log('  Sample rules:', JSON.stringify(rules.slice(0, 2)));

    // Create route
    const routeBody = {
      name: routeName,
      coverCountries: uniqueCountries.join(','),
      coverCities: '',
      postalCodeRange: '',
      supportedCategories: meta.supports,
      paymentDays: 0,
      remark: '示例平台线上发货 - ' + meta.level,
      channelType: 'air',
      transportType: 'cross_border',
      serviceType: 'customer_clearance',
    };

    let routeId;
    try {
      // Look up in pre-fetched map
      if (routeMap[routeName]) {
        routeId = routeMap[routeName].id;
        console.log('  Found existing route: ' + routeId + ' (rules: ' + routeMap[routeName].pricingRuleCount + ')');
        if (routeMap[routeName].pricingRuleCount > 0) {
          console.log('  Route already has pricing rules, skipping');
          continue;
        }
      } else {
        const createRes = await apiCall('POST', '/logistics-routes', routeBody);
        if (createRes.id) {
          routeId = createRes.id;
          totalRoutes++;
          routeMap[routeName] = { id: routeId, pricingRuleCount: 0 };
          console.log('  Route created: ' + routeId);
        } else {
          console.log('  Route create failed:', JSON.stringify(createRes).substring(0, 200));
          continue;
        }
      }
    } catch (e) {
      console.log('  Route error:', e.message);
      continue;
    }

    // Create pricing rules in batches
    const batchSize = 20;
    let created = 0;
    for (let i = 0; i < rules.length; i += batchSize) {
      const batch = rules.slice(i, i + batchSize);
      for (const rule of batch) {
        try {
          const ruleBody = {
            minWeight: parseFloat(rule.minWeight || '0'),
            maxWeight: parseFloat(rule.maxWeight || '2'),
            unitPrice: rule.unitPrice || undefined,
            firstWeightPrice: rule.firstWeightPrice || undefined,
            continuedWeightPrice: rule.continuedWeightPrice || undefined,
            minCharge: 0,
            countries: rule.country,
            remark: rule.remark || '',
            volumeWeightDivisor: rule.volumeWeightDivisor,
          };
          const res = await apiCall('POST', '/logistics-routes/' + routeId + '/pricing-rules', ruleBody);
          if (res.id) created++;
          await sleep(20); // Rate limiting
        } catch (e) {
          console.error('  Rule create error:', e.message);
        }
      }
    }

    totalRules += created;
    console.log('  Pricing rules created: ' + created + '/' + rules.length);
  }

  console.log('\n\n===== SUMMARY =====');
  console.log('Routes created: ' + totalRoutes);
  console.log('Pricing rules created: ' + totalRules);
}

main().catch(console.error);
