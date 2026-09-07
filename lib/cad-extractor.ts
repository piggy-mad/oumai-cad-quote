export type ExtractedPart = {
  row: number;
  sourceName: string;
  name: string;
  specification: string;
  material: string;
  quantity: number;
  confidence: number;
};

export type ExtractionResult = {
  projectCode: string;
  drawingName: string;
  drawingVersion: string;
  tableName: string;
  parts: ExtractedPart[];
  warnings: string[];
  entityCounts: Record<string, number>;
  aiNormalized: boolean;
};

type Point = { x: number; y: number; z?: number };
type TextNode = {
  text: string;
  x: number;
  y: number;
  height: number;
  layer: string;
  type: string;
};

type CadEntity = Record<string, unknown> & {
  type?: string;
  text?: unknown;
  startPoint?: Point;
  insertionPoint?: Point;
  textHeight?: number;
  layer?: string;
  attribs?: CadEntity[];
};

function textRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

export function cleanCadText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\\P/g, ' ')
    .replace(/\\~/g, ' ')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .replace(/%%178/gi, '²')
    .replace(/%%248/gi, '°')
    .replace(/%%[cC]/g, 'Ø')
    .replace(/\s+/g, ' ')
    .trim();
}

function textPoint(entity: CadEntity): Point | undefined {
  return entity.startPoint ?? entity.insertionPoint ?? textRecord(entity.text)?.startPoint as Point | undefined;
}

function collectTextNodes(entities: CadEntity[]): TextNode[] {
  const nodes: TextNode[] = [];
  for (const entity of entities) {
    const point = textPoint(entity);
    if ((entity.type === 'TEXT' || entity.type === 'MTEXT') && point) {
      const text = cleanCadText(entity.text);
      if (text) {
        nodes.push({
          text,
          x: point.x,
          y: point.y,
          height: Number(entity.textHeight || 1),
          layer: entity.layer || '',
          type: entity.type,
        });
      }
    }
    if (entity.type === 'ATTRIB' && point) {
      const entityText = textRecord(entity.text);
      const text = cleanCadText(entityText?.text);
      if (text) {
        nodes.push({
          text,
          x: point.x,
          y: point.y,
          height: Number(entityText?.textHeight || 1),
          layer: entity.layer || '',
          type: entity.type,
        });
      }
    }
    if (entity.type === 'INSERT') {
      for (const attribute of entity.attribs ?? []) {
        const attributePoint = textPoint(attribute) ?? point;
        const attributeText = textRecord(attribute.text);
        const text = cleanCadText(attributeText?.text);
        if (text && attributePoint) {
          nodes.push({
            text,
            x: attributePoint.x,
            y: attributePoint.y,
            height: Number(attributeText?.textHeight || 1),
            layer: attribute.layer || entity.layer || '',
            type: 'ATTRIB',
          });
        }
      }
    }
  }
  return nodes;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function findNearestHeader(
  nodes: TextNode[],
  anchor: TextNode,
  name: string,
): TextNode | undefined {
  return nodes
    .filter((node) => node.text.replace(/\s/g, '').includes(name))
    .map((node) => ({
      node,
      distance: Math.abs(node.y - anchor.y) * 8 + Math.abs(node.x - anchor.x),
    }))
    .filter(({ node }) => Math.abs(node.y - anchor.y) < Math.max(40, anchor.height * 5))
    .sort((a, b) => a.distance - b.distance)[0]?.node;
}

function splitNameAndSpecification(value: string): {
  name: string;
  specification: string;
} {
  const knownNames = [
    '机械密封',
    '安装底盖',
    '凸缘法兰',
    '传动轴',
    '搅拌轴',
    '搅拌器',
    '减速机',
    '电减支架',
    '联轴器',
    '机架',
    '电机',
  ];
  const compact = value.replace(/\s+/g, ' ').trim();
  const known = knownNames.find((name) => compact.includes(name));
  if (!known) return { name: compact, specification: '' };
  const specification = compact.replace(known, '').trim();
  return { name: known, specification };
}

function extractTableFromHeader(nodes: TextNode[], nameHeader: TextNode) {
  const serialHeader = findNearestHeader(nodes, nameHeader, '序号');
  const materialHeader = findNearestHeader(nodes, nameHeader, '材料');
  const quantityHeader = findNearestHeader(nodes, nameHeader, '数量');
  if (!serialHeader || !materialHeader || !quantityHeader) return undefined;

  const columns = [serialHeader.x, nameHeader.x, materialHeader.x, quantityHeader.x];
  if (!(columns[0] < columns[1] && columns[1] < columns[2] && columns[2] < columns[3])) {
    return undefined;
  }

  const tableWidth = columns[3] - columns[0];
  const serialCandidates = nodes
    .filter(
      (node) =>
        /^\d{1,3}$/.test(node.text) &&
        node.y < nameHeader.y - Math.max(nameHeader.height, 1) &&
        node.x >= columns[0] - tableWidth * 0.04 &&
        node.x < (columns[0] + columns[1]) / 2,
    )
    .sort((a, b) => b.y - a.y);

  const serialRows: TextNode[] = [];
  let expected = 1;
  for (const node of serialCandidates) {
    const value = Number(node.text);
    if (value === expected) {
      serialRows.push(node);
      expected += 1;
    } else if (serialRows.length && value === Number(serialRows.at(-1)?.text)) {
      continue;
    } else if (serialRows.length && value > expected) {
      break;
    }
  }
  if (!serialRows.length) return undefined;

  const rowGaps = serialRows.slice(1).map((row, index) => serialRows[index].y - row.y);
  const rowHeight = median(rowGaps.filter((gap) => gap > 0)) || tableWidth * 0.08;
  const xMin = columns[0] - tableWidth * 0.04;
  const xMax = columns[3] + tableWidth * 0.04;
  // Header captions are commonly centered while body text is left-aligned.
  // Keep the serial boundary close to the serial column so names are not lost.
  const nameStart = columns[0] + (columns[1] - columns[0]) * 0.12;
  const materialStart = (columns[1] + columns[2]) / 2;
  const quantityStart = (columns[2] + columns[3]) / 2;

  const parts = serialRows.map((serial, index) => {
    const upper =
      index === 0 ? nameHeader.y - nameHeader.height * 0.5 : (serialRows[index - 1].y + serial.y) / 2;
    const lower =
      index === serialRows.length - 1
        ? serial.y - rowHeight * 0.55
        : (serial.y + serialRows[index + 1].y) / 2;
    const cells = nodes.filter(
      (node) =>
        node !== serial &&
        node.y <= upper &&
        node.y > lower &&
        node.x >= xMin &&
        node.x <= xMax,
    );
    const joined = (start: number, end: number) =>
      cells
        .filter((node) => node.x >= start && node.x < end)
        .sort((a, b) => a.x - b.x)
        .map((node) => node.text)
        .join(' ')
        .trim();

    const sourceName = joined(nameStart, materialStart);
    const { name, specification } = splitNameAndSpecification(sourceName);
    const material = joined(materialStart, quantityStart);
    const quantityText = joined(quantityStart, xMax);
    const parsedQuantity = Number(quantityText.replace(/[^\d.]/g, ''));
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;

    return {
      row: Number(serial.text),
      sourceName,
      name,
      specification,
      material,
      quantity,
      confidence: sourceName && material && quantityText ? 0.98 : sourceName ? 0.82 : 0.55,
    } satisfies ExtractedPart;
  });

  const tableTitle = nodes
    .filter(
      (node) =>
        node.text.includes('配置明细表') &&
        Math.abs(node.x - nameHeader.x) < tableWidth &&
        node.y > nameHeader.y,
    )
    .sort((a, b) => a.y - b.y)[0]?.text;

  return { parts, tableName: tableTitle || '配置明细表' };
}

function extractBom(nodes: TextNode[]) {
  const nameHeaders = nodes.filter((node) =>
    node.text.replace(/\s/g, '').includes('名称及规格'),
  );
  const tables = nameHeaders
    .map((header) => extractTableFromHeader(nodes, header))
    .filter((table): table is NonNullable<typeof table> => Boolean(table));
  return tables.sort((a, b) => b.parts.length - a.parts.length)[0];
}

export async function extractDwg(
  file: File,
  wasmBaseUrl = '/libredwg',
): Promise<ExtractionResult> {
  const { Dwg_File_Type, LibreDwg } = await import('@mlightcad/libredwg-web');
  const parser = await LibreDwg.create(wasmBaseUrl);
  const raw = parser.dwg_read_data(await file.arrayBuffer(), Dwg_File_Type.DWG);
  if (raw === undefined) throw new Error('DWG 文件读取失败');
  try {
    const database = parser.convert(raw) as unknown as {
      entities?: CadEntity[];
    };
    const entities = database.entities ?? [];
    const entityCounts: Record<string, number> = {};
    for (const entity of entities) {
      const entityType = entity.type || 'UNKNOWN';
      entityCounts[entityType] = (entityCounts[entityType] ?? 0) + 1;
    }
    const nodes = collectTextNodes(entities);
    const table = extractBom(nodes);
    if (!table?.parts.length) {
      throw new Error('未找到包含“序号、名称及规格、材料、数量”的配置明细表');
    }
    const projectCode = file.name.match(/XM[-_ ]?\d+/i)?.[0]?.replace('_', '-') ?? '待识别';
    const warnings = table.parts
      .filter((part) => part.confidence < 0.8)
      .map((part) => `第 ${part.row} 行存在缺失字段`);
    return {
      projectCode,
      drawingName: file.name,
      drawingVersion: 'DWG',
      tableName: table.tableName,
      parts: table.parts,
      warnings,
      entityCounts,
      aiNormalized: false,
    };
  } finally {
    parser.dwg_free(raw);
  }
}
