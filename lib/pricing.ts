import type { ExtractedPart } from './cad-extractor';

export type PriceItem = {
  code: string;
  category: string;
  name: string;
  specification: string;
  material: string;
  unit: string;
  unitPrice: number;
  status: '示例未审核' | '已审核';
};

export type QuotedPart = ExtractedPart & {
  priceCode: string;
  unit: string;
  unitPrice: number;
  lineCost: number;
  quoteUnitPrice: number;
  quoteAmount: number;
  matched: boolean;
};

export const PRICE_BOOK: PriceItem[] = [
  { code: 'MOTOR-7.5KW', category: '外购件', name: '电机', specification: '7.5kW', material: '组合件', unit: '台', unitPrice: 3850, status: '示例未审核' },
  { code: 'REDUCER-RF', category: '外购件', name: '减速机', specification: 'RF', material: '组合件', unit: '台', unitPrice: 4200, status: '示例未审核' },
  { code: 'SEAL-MECH', category: '外购件', name: '机械密封', specification: '通用', material: '组合件', unit: '套', unitPrice: 2300, status: '示例未审核' },
  { code: 'FLANGE-304', category: '零件', name: '凸缘法兰', specification: '304', material: '304', unit: '件', unitPrice: 620, status: '示例未审核' },
  { code: 'FLANGE-CS304', category: '零件', name: '凸缘法兰', specification: 'CS/304', material: 'CS/304', unit: '件', unitPrice: 520, status: '示例未审核' },
  { code: 'SHAFT-DRIVE-304', category: '零件', name: '传动轴', specification: '304', material: '304', unit: '件', unitPrice: 3200, status: '示例未审核' },
  { code: 'SHAFT-MIX-304', category: '零件', name: '搅拌轴', specification: '304', material: '304', unit: '件', unitPrice: 3600, status: '示例未审核' },
  { code: 'AGITATOR-304', category: '零件', name: '搅拌器', specification: 'SLD1740', material: '304', unit: '件', unitPrice: 4600, status: '示例未审核' },
  { code: 'BOTTOM-COVER', category: '零件', name: '安装底盖', specification: 'CS/304', material: 'CS/304', unit: '件', unitPrice: 680, status: '示例未审核' },
  { code: 'FRAME', category: '零件', name: '机架', specification: '通用', material: '组合件', unit: '件', unitPrice: 850, status: '示例未审核' },
  { code: 'MOTOR-BRACKET', category: '零件', name: '电减支架', specification: 'CS', material: 'CS', unit: '件', unitPrice: 560, status: '示例未审核' },
];

function scorePrice(part: ExtractedPart, item: PriceItem): number {
  let score = 0;
  if (part.name === item.name) score += 10;
  else if (part.sourceName.includes(item.name) || item.name.includes(part.name)) score += 6;
  if (part.material && item.material && part.material.includes(item.material)) score += 3;
  if (part.specification && item.specification && part.specification.includes(item.specification)) score += 2;
  return score;
}

export function quoteParts(parts: ExtractedPart[]): QuotedPart[] {
  const marginMultiplier = 1.08 * 1.15;
  return parts.map((part) => {
    const ranked = PRICE_BOOK
      .map((item) => ({ item, score: scorePrice(part, item) }))
      .sort((a, b) => b.score - a.score);
    const match = ranked[0]?.score >= 6 ? ranked[0].item : undefined;
    const unitPrice = match?.unitPrice ?? 0;
    const lineCost = unitPrice * part.quantity;
    const quoteUnitPrice = Math.round(unitPrice * marginMultiplier * 100) / 100;
    return {
      ...part,
      priceCode: match?.code ?? '未匹配',
      unit: match?.unit ?? '件',
      unitPrice,
      lineCost,
      quoteUnitPrice,
      quoteAmount: quoteUnitPrice * part.quantity,
      matched: Boolean(match),
    };
  });
}
