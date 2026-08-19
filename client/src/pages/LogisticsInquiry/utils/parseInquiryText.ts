import type { DimensionGroup } from '@shared/api.interface';

export interface ParsedInquiryFields {
  country?: string;
  city?: string;
  postalCode?: string;
  weight?: number;
  quantity?: number;
  packagesCount?: number;
  length?: number;
  width?: number;
  height?: number;
  packagingType?: string;
  category?: string;
  itemName?: string;
  declaredValue?: number;
  customsType?: string;
  dimensionGroups?: DimensionGroup[];
}

const COUNTRY_MAP: Record<string, string> = {
  '美国': '美国', 'USA': '美国', 'US': '美国', 'United States': '美国',
  '英国': '英国', 'UK': '英国', 'GB': '英国', 'United Kingdom': '英国',
  '德国': '德国', 'Germany': '德国', 'DE': '德国',
  '法国': '法国', 'France': '法国', 'FR': '法国',
  '日本': '日本', 'Japan': '日本', 'JP': '日本',
  '韩国': '韩国', 'Korea': '韩国', 'KR': '韩国',
  '加拿大': '加拿大', 'Canada': '加拿大', 'CA': '加拿大',
  '澳大利亚': '澳大利亚', '澳洲': '澳大利亚', 'Australia': '澳大利亚', 'AU': '澳大利亚',
  '新西兰': '新西兰', 'New Zealand': '新西兰', 'NZ': '新西兰',
  '新加坡': '新加坡', 'Singapore': '新加坡', 'SG': '新加坡',
  '马来西亚': '马来西亚', 'Malaysia': '马来西亚', 'MY': '马来西亚',
  '泰国': '泰国', 'Thailand': '泰国', 'TH': '泰国',
  '越南': '越南', 'Vietnam': '越南', 'VN': '越南',
  '菲律宾': '菲律宾', 'Philippines': '菲律宾', 'PH': '菲律宾',
  '印度尼西亚': '印度尼西亚', '印尼': '印度尼西亚', 'Indonesia': '印度尼西亚', 'ID': '印度尼西亚',
  '印度': '印度', 'India': '印度', 'IN': '印度',
  '西班牙': '西班牙', 'Spain': '西班牙', 'ES': '西班牙',
  '意大利': '意大利', 'Italy': '意大利', 'IT': '意大利',
  '荷兰': '荷兰', 'Netherlands': '荷兰', 'NL': '荷兰',
  '比利时': '比利时', 'Belgium': '比利时', 'BE': '比利时',
  '波兰': '波兰', 'Poland': '波兰', 'PL': '波兰',
  '捷克': '捷克', 'Czech': '捷克', 'CZ': '捷克',
  '瑞典': '瑞典', 'Sweden': '瑞典', 'SE': '瑞典',
  '丹麦': '丹麦', 'Denmark': '丹麦', 'DK': '丹麦',
  '挪威': '挪威', 'Norway': '挪威', 'NO': '挪威',
  '芬兰': '芬兰', 'Finland': '芬兰', 'FI': '芬兰',
  '奥地利': '奥地利', 'Austria': '奥地利', 'AT': '奥地利',
  '瑞士': '瑞士', 'Switzerland': '瑞士', 'CH': '瑞士',
  '爱尔兰': '爱尔兰', 'Ireland': '爱尔兰', 'IE': '爱尔兰',
  '葡萄牙': '葡萄牙', 'Portugal': '葡萄牙', 'PT': '葡萄牙',
  '希腊': '希腊', 'Greece': '希腊', 'GR': '希腊',
  '罗马尼亚': '罗马尼亚', 'Romania': '罗马尼亚', 'RO': '罗马尼亚',
  '匈牙利': '匈牙利', 'Hungary': '匈牙利', 'HU': '匈牙利',
  '保加利亚': '保加利亚', 'Bulgaria': '保加利亚', 'BG': '保加利亚',
  '克罗地亚': '克罗地亚', 'Croatia': '克罗地亚', 'HR': '克罗地亚',
  '墨西哥': '墨西哥', 'Mexico': '墨西哥', 'MX': '墨西哥',
  '巴西': '巴西', 'Brazil': '巴西', 'BR': '巴西',
  '智利': '智利', 'Chile': '智利', 'CL': '智利',
  '哥伦比亚': '哥伦比亚', 'Colombia': '哥伦比亚', 'CO': '哥伦比亚',
  '阿根廷': '阿根廷', 'Argentina': '阿根廷', 'AR': '阿根廷',
  '秘鲁': '秘鲁', 'Peru': '秘鲁', 'PE': '秘鲁',
  '阿联酋': '阿联酋', 'UAE': '阿联酋', 'Dubai': '阿联酋', '迪拜': '阿联酋',
  '沙特': '沙特', 'Saudi': '沙特', 'SA': '沙特',
  '以色列': '以色列', 'Israel': '以色列', 'IL': '以色列',
  '土耳其': '土耳其', 'Turkey': '土耳其', 'TR': '土耳其',
  '俄罗斯': '俄罗斯', 'Russia': '俄罗斯', 'RU': '俄罗斯',
  '南非': '南非', 'South Africa': '南非', 'ZA': '南非',
  '尼日利亚': '尼日利亚', 'Nigeria': '尼日利亚', 'NG': '尼日利亚',
  '肯尼亚': '肯尼亚', 'Kenya': '肯尼亚', 'KE': '肯尼亚',
  '埃及': '埃及', 'Egypt': '埃及', 'EG': '埃及',
  '摩洛哥': '摩洛哥', 'Morocco': '摩洛哥', 'MA': '摩洛哥',
  '台湾': '台湾', 'Taiwan': '台湾', 'TW': '台湾',
  '香港': '香港', 'Hong Kong': '香港', 'HK': '香港',
};

const CITY_MAP: Record<string, string[]> = {
  '英国': ['伦敦', '伯明翰', '曼彻斯特', '利物浦', '布里斯托', '利兹', '谢菲尔德', '爱丁堡', '格拉斯哥', '剑桥', '牛津'],
  '美国': ['纽约', '洛杉矶', '芝加哥', '休斯顿', '旧金山', '西雅图', '波士顿', '费城', '华盛顿', '迈阿密', '达拉斯', '亚特兰大', '底特律', '凤凰城', '圣迭戈', '圣何塞', '奥斯汀', '丹佛', '波特兰', '夏洛特'],
  '德国': ['柏林', '慕尼黑', '汉堡', '法兰克福', '科隆', '杜塞尔多夫', '斯图加特', '莱比锡', '多特蒙德', '汉诺威'],
  '法国': ['巴黎', '里昂', '马赛', '图卢兹', '尼斯', '波尔多', '里尔', '斯特拉斯堡', '蒙彼利埃'],
  '日本': ['东京', '大阪', '横滨', '名古屋', '京都', '神户', '福冈', '札幌', '仙台', '广岛'],
  '韩国': ['首尔', '釜山', '仁川', '大邱', '光州', '大田', '蔚山'],
  '加拿大': ['多伦多', '温哥华', '蒙特利尔', '卡尔加里', '埃德蒙顿', '渥太华', '温尼伯', '哈利法克斯'],
  '澳大利亚': ['悉尼', '墨尔本', '布里斯班', '珀斯', '阿德莱德', '黄金海岸', '堪培拉', '纽卡斯尔'],
  '新加坡': ['新加坡'],
  '马来西亚': ['吉隆坡', '槟城', '新山', '怡保', '古晋', '亚庇'],
  '泰国': ['曼谷', '清迈', '普吉', '芭提雅', '清莱', '合艾'],
  '越南': ['胡志明', '河内', '岘港', '海防', '芹苴'],
  '菲律宾': ['马尼拉', '宿务', '达沃', '奎松'],
  '印度': ['孟买', '新德里', '德里', '班加罗尔', '加尔各答', '钦奈', '海得拉巴', '浦那'],
  '印度尼西亚': ['雅加达', '泗水', '万隆', '棉兰', '巴厘岛'],
  '意大利': ['罗马', '米兰', '那不勒斯', '都灵', '佛罗伦萨', '威尼斯', '博洛尼亚', '热那亚'],
  '西班牙': ['马德里', '巴塞罗那', '瓦伦西亚', '塞维利亚', '马拉加', '毕尔巴鄂'],
  '荷兰': ['阿姆斯特丹', '鹿特丹', '海牙', '乌得勒支', '埃因霍温'],
  '比利时': ['布鲁塞尔', '安特卫普', '根特', '列日', '布鲁日'],
  '波兰': ['华沙', '克拉科夫', '弗罗茨瓦夫', '波兹南', '格但斯克'],
  '瑞典': ['斯德哥尔摩', '哥德堡', '马尔默', '乌普萨拉'],
  '丹麦': ['哥本哈根', '奥胡斯', '欧登塞', '奥尔堡'],
  '挪威': ['奥斯陆', '卑尔根', '特隆赫姆', '斯塔万格'],
  '芬兰': ['赫尔辛基', '埃斯波', '坦佩雷', '图尔库'],
  '奥地利': ['维也纳', '格拉茨', '林茨', '萨尔茨堡', '因斯布鲁克'],
  '瑞士': ['苏黎世', '日内瓦', '巴塞尔', '伯尔尼', '洛桑'],
  '爱尔兰': ['都柏林', '科克', '戈尔韦', '利默里克'],
  '葡萄牙': ['里斯本', '波尔图', '科英布拉', '法鲁'],
  '希腊': ['雅典', '塞萨洛尼基', '帕特雷', '伊拉克利翁'],
  '阿联酋': ['迪拜', '阿布扎比', '沙迦', '阿治曼'],
  '沙特': ['利雅得', '吉达', '达曼', '麦加', '麦地那'],
  '土耳其': ['伊斯坦布尔', '安卡拉', '伊兹密尔', '布尔萨', '安塔利亚'],
  '俄罗斯': ['莫斯科', '圣彼得堡', '新西伯利亚', '叶卡捷琳堡', '喀山'],
  '墨西哥': ['墨西哥城', '瓜达拉哈拉', '蒙特雷', '坎昆', '蒂华纳'],
  '巴西': ['圣保罗', '里约热内卢', '萨尔瓦多', '巴西利亚', '福塔莱萨'],
  '智利': ['圣地亚哥', '瓦尔帕莱索', '康塞普西翁', '拉塞雷纳'],
  '哥伦比亚': ['波哥大', '麦德林', '卡利', '巴兰基亚', '卡塔赫纳'],
  '阿根廷': ['布宜诺斯艾利斯', '科尔多瓦', '罗萨里奥', '门多萨'],
  '秘鲁': ['利马', '阿雷基帕', '特鲁希略', '库斯科'],
  '南非': ['约翰内斯堡', '开普敦', '德班', '比勒陀利亚', '伊丽莎白港'],
  '埃及': ['开罗', '亚历山大', '吉萨', '沙姆沙伊赫'],
  '以色列': ['特拉维夫', '耶路撒冷', '海法', '贝尔谢巴'],
  '香港': ['香港'],
  '台湾': ['台北', '高雄', '台中', '台南', '桃园', '新竹'],
};

const PACKAGING_KEYWORDS = ['纸箱', '编织袋', '已有木箱', '需打木箱', '已有木架', '需打木架', '木架', '木箱', '托盘'];
const CATEGORY_KEYWORDS = ['普货', '带电', '带磁', '纯电', '危险品', '液体', '粉末', '膏体', '食品', '易碎品'];

const FRAGILE_ITEMS = ['陶瓷', '玻璃', '杯子', '马克杯', '花瓶', '碗', '盘', '瓷器', '镜子', '相框', '灯泡', '灯管', '显示器', '屏幕', '显示屏'];
const ELECTRONIC_ITEMS = ['手机', '电脑', '笔记本', '平板', '耳机', '充电器', '数据线', '电池', '充电宝', '相机', '手表', '音箱', '鼠标', '键盘', '路由器', '无人机'];
const FOOD_ITEMS = ['零食', '茶叶', '咖啡', '饼干', '糖果', '巧克力', '坚果', '干货', '调料', '酱', '罐头', '方便面'];

function findFirst(patterns: RegExp[], text: string): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

function findCountry(text: string): string | undefined {
  const labelMatch = findFirst([
    /(?:国家|目的地|目的国|发往|到|送至|运往|ship\s*to|destination)[:：\s]*([^\s,，;；\n]+)/i,
  ], text);
  if (labelMatch) {
    const upper = labelMatch.toUpperCase();
    for (const [key, value] of Object.entries(COUNTRY_MAP)) {
      if (key.toUpperCase() === upper || labelMatch.includes(key) || key.includes(labelMatch)) {
        return value;
      }
    }
    return labelMatch;
  }
  const upper = text.toUpperCase();
  let bestMatch: { value: string; keyLen: number } | null = null;
  for (const [key, value] of Object.entries(COUNTRY_MAP)) {
    if (key.length >= 2 && upper.includes(key.toUpperCase())) {
      if (!bestMatch || key.length > bestMatch.keyLen) {
        bestMatch = { value, keyLen: key.length };
      }
    }
  }
  return bestMatch?.value;
}

function findCity(text: string, country?: string): string | undefined {
  const labelMatch = findFirst([
    /(?:城市|city|送到|发往|目的地城市)[:：\s]*([^\s,，;；\d]+)/i,
  ], text);
  if (labelMatch) return labelMatch;

  const candidates = country ? CITY_MAP[country] || [] : [];
  if (candidates.length > 0) {
    for (const city of candidates) {
      if (text.includes(city)) return city;
    }
  } else {
    for (const cities of Object.values(CITY_MAP)) {
      for (const city of cities) {
        if (text.includes(city)) return city;
      }
    }
  }
  return undefined;
}

function findWeight(text: string): number | undefined {
  const val = findFirst([
    /(?:实重|毛重|净重|重量|总重|GW|NW|weight)[:：\s]*(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克|KG)?/i,
    /(\d+(?:\.\d+)?)\s*(?:kg|公斤|千克)\b/i,
  ], text);
  if (val) {
    const n = parseFloat(val);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

function findPostalCode(text: string, country?: string): string | undefined {
  const labelMatch = findFirst([
    /(?:邮编|邮政编码|postal\s*code|zip(?:\s*code)?|postcode)[:：\s]*([A-Za-z0-9\s\-]+)/i,
  ], text);
  if (labelMatch) return labelMatch.replace(/\s+/g, '');

  if (country === '英国') {
    const ukMatch = text.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i);
    if (ukMatch) return ukMatch[1].toUpperCase().replace(/\s+/g, '');
  }

  const usZip = text.match(/\b(\d{5}(?:-\d{4})?)\b/);
  if (usZip) return usZip[1];

  if (!country || country === '加拿大') {
    const caMatch = text.match(/\b([A-Z]\d[A-Z]\s*\d[A-Z]\d)\b/i);
    if (caMatch) return caMatch[1].toUpperCase().replace(/\s+/g, '');
  }

  return undefined;
}

function findItemCount(text: string, dimNumbers: Set<number>): { quantity?: number; packagesCount?: number } {
  const result: { quantity?: number; packagesCount?: number } = {};

  const qtyLabel = findFirst([
    /(?:数量|件数|总件数|qty|quantity)[:：\s]*(\d+)/i,
  ], text);
  if (qtyLabel) {
    const n = parseInt(qtyLabel, 10);
    if (n > 0) result.quantity = n;
  }

  const pkgLabel = findFirst([
    /(?:包裹|箱数|票数|packages?|cartons?|箱)[:：\s]*(\d+)/i,
  ], text);
  if (pkgLabel) {
    const n = parseInt(pkgLabel, 10);
    if (n > 0) result.packagesCount = n;
  }

  if (!result.quantity || !result.packagesCount) {
    const unitPattern = /(\d+)\s*(箱|件|个|pcs|pieces?|票|包裹|cartons?|packages?)/gi;
    let m: RegExpExecArray | null;
    while ((m = unitPattern.exec(text)) !== null) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      if (n <= 0) continue;
      if (['箱', '包裹', 'carton', 'cartons', 'package', 'packages'].some((u) => unit.includes(u))) {
        if (!result.packagesCount) result.packagesCount = n;
      } else {
        if (!result.quantity) result.quantity = n;
      }
    }
  }

  if (!result.packagesCount && result.quantity) {
    result.packagesCount = result.quantity;
  }

  return result;
}

interface SingleDimension {
  length: number;
  width: number;
  height: number;
  quantity?: number;
}

function parseDimensions(text: string): { single?: SingleDimension; groups?: DimensionGroup[]; dimNumbers: Set<number> } {
  const dimensionGroups: DimensionGroup[] = [];
  const dimNumbers = new Set<number>();

  const groupPattern = /(?:(\d+)\s*(?:箱|件|个|pcs)?\s*[:：]?\s*)?(\d+(?:\.\d+)?)\s*[*x×Xｘ＊×]\s*(\d+(?:\.\d+)?)\s*[*x×Xｘ＊×]\s*(\d+(?:\.\d+)?)\s*(?:cm|CM|厘米)?/gi;
  let match: RegExpExecArray | null;
  while ((match = groupPattern.exec(text)) !== null) {
    const qty = match[1] ? parseInt(match[1], 10) : undefined;
    const l = parseFloat(match[2]);
    const w = parseFloat(match[3]);
    const h = parseFloat(match[4]);
    if (l > 0 && w > 0 && h > 0) {
      dimensionGroups.push({
        length: l,
        width: w,
        height: h,
        quantity: qty ?? 1,
      });
      dimNumbers.add(l);
      dimNumbers.add(w);
      dimNumbers.add(h);
      if (qty) dimNumbers.add(qty);
    }
  }

  if (dimensionGroups.length === 0) {
    const lwh = findFirst([
      /(?:长|length)[:：\s]*(\d+(?:\.\d+)?)/i,
    ], text);
    const wwh = findFirst([
      /(?:宽|width)[:：\s]*(\d+(?:\.\d+)?)/i,
    ], text);
    const hwh = findFirst([
      /(?:高|height)[:：\s]*(\d+(?:\.\d+)?)/i,
    ], text);
    if (lwh && wwh && hwh) {
      const l = parseFloat(lwh);
      const w = parseFloat(wwh);
      const h = parseFloat(hwh);
      dimNumbers.add(l);
      dimNumbers.add(w);
      dimNumbers.add(h);
      return {
        single: { length: l, width: w, height: h },
        dimNumbers,
      };
    }
    return { dimNumbers };
  }

  if (dimensionGroups.length === 1) {
    const g = dimensionGroups[0];
    return {
      single: { length: g.length, width: g.width, height: g.height },
      groups: [{ ...g }],
      dimNumbers,
    };
  }

  return { groups: dimensionGroups, dimNumbers };
}

function findPackagingType(text: string): string | undefined {
  for (const kw of PACKAGING_KEYWORDS) {
    if (text.includes(kw)) {
      if (kw === '木箱') {
        if (text.includes('需打木箱')) return '需打木箱';
        if (text.includes('已有木箱')) return '已有木箱';
        return '已有木箱';
      }
      if (kw === '木架') {
        if (text.includes('需打木架')) return '需打木架';
        if (text.includes('已有木架')) return '已有木架';
        return '已有木架';
      }
      return kw;
    }
  }
  return undefined;
}

function findCategory(text: string): string | undefined {
  for (const kw of CATEGORY_KEYWORDS) {
    if (text.includes(kw)) {
      if (kw === '液体' || kw === '粉末' || kw === '膏体') return '液体/粉末/膏体';
      return kw;
    }
  }
  for (const item of FRAGILE_ITEMS) {
    if (text.includes(item)) return '易碎品';
  }
  for (const item of ELECTRONIC_ITEMS) {
    if (text.includes(item)) return '带电';
  }
  for (const item of FOOD_ITEMS) {
    if (text.includes(item)) return '食品';
  }
  return undefined;
}

function findItemName(text: string): string | undefined {
  const labelMatch = findFirst([
    /(?:品名|物品名|物品名称|货物品名|商品名|品名描述|货物)[:：\s]*(.+?)(?=\n|$|[,，;；])/i,
  ], text);
  if (labelMatch) return labelMatch;

  const packagingIdx = Math.max(
    text.indexOf('纸箱'),
    text.indexOf('编织袋'),
    text.indexOf('木箱'),
    text.indexOf('木架'),
    text.indexOf('托盘'),
  );
  if (packagingIdx >= 0) {
    const after = text.slice(packagingIdx).replace(/^(纸箱|编织袋|已有木箱|需打木箱|已有木架|需打木架|木架|木箱|托盘)[\s,，、;；]+/, '');
    const next = after.split(/[\n,，;；]/)[0]?.trim();
    if (next && next.length > 0 && next.length < 30 && !/^\d/.test(next)) {
      const stopWords = ['包装', '类别', '物品', '品名', '申报', '价值', '尺寸', '重量', '件数', '数量', '国家', '城市', '邮编'];
      if (!stopWords.some((w) => next.startsWith(w))) {
        return next;
      }
    }
  }

  return undefined;
}

function findDeclaredValue(text: string): number | undefined {
  const val = findFirst([
    /(?:申报价值|货值|申报金额|declared\s*value)[:：\s]*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:USD|美元|欧元|EUR|GBP|英镑)/i,
  ], text);
  if (val) {
    const n = parseFloat(val);
    return n > 0 ? n : undefined;
  }
  return undefined;
}

function findCustomsType(text: string): string | undefined {
  if (/(?:需要|需|要)\s*(?:单独报关|自报|报关单|独立报关|分票报关|自报关)/.test(text)) {
    return '需要单独报关';
  }
  if (/(?:无需|不需要|不用|免)\s*(?:报关|清关)/.test(text)) {
    return '无需报关';
  }
  return undefined;
}

export function parseInquiryText(rawText: string): ParsedInquiryFields {
  const text = rawText.trim();
  if (!text) return {};

  const result: ParsedInquiryFields = {};

  result.country = findCountry(text);
  result.city = findCity(text, result.country);
  result.postalCode = findPostalCode(text, result.country);
  result.weight = findWeight(text);

  const dims = parseDimensions(text);

  const itemCounts = findItemCount(text, dims.dimNumbers);
  result.quantity = itemCounts.quantity;
  result.packagesCount = itemCounts.packagesCount;
  if (dims.groups && dims.groups.length > 1) {
    result.dimensionGroups = dims.groups;
    const totalQty = dims.groups.reduce((sum, g) => sum + g.quantity, 0);
    if (!result.quantity && totalQty > 0) result.quantity = totalQty;
    if (!result.packagesCount && totalQty > 0) result.packagesCount = totalQty;
  } else if (dims.single) {
    result.length = dims.single.length;
    result.width = dims.single.width;
    result.height = dims.single.height;
  }

  result.packagingType = findPackagingType(text);
  result.category = findCategory(text);
  result.itemName = findItemName(text);
  result.declaredValue = findDeclaredValue(text);
  result.customsType = findCustomsType(text);

  return result;
}
