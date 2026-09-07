import fs from 'node:fs/promises';
import path from 'node:path';
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';

const inputPath = process.argv[2];
if (!inputPath) {
  throw new Error('Usage: node scripts/inspect-dwg.mjs <drawing.dwg>');
}

const wasmPath = path.resolve('node_modules/@mlightcad/libredwg-web/wasm');
const parser = await LibreDwg.create(`${wasmPath}/`);
const bytes = await fs.readFile(inputPath);
const raw = parser.dwg_read_data(bytes, Dwg_File_Type.DWG);
const database = parser.convert(raw);

const counts = {};
const records = [];
const visit = (entity, owner = 'MODEL_SPACE') => {
  counts[entity.type] = (counts[entity.type] ?? 0) + 1;
  if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
    records.push({
      type: entity.type,
      owner,
      layer: entity.layer,
      text: entity.text,
      point: entity.startPoint ?? entity.insertionPoint,
    });
  }
  if (entity.type === 'ATTRIB') {
    records.push({
      type: entity.type,
      owner,
      layer: entity.layer,
      tag: entity.tag ?? entity.attrTag,
      text: entity.text?.text,
      point: entity.text?.startPoint,
    });
  }
  if (entity.type === 'INSERT') {
    records.push({
      type: entity.type,
      owner,
      layer: entity.layer,
      name: entity.name,
      attribs: (entity.attribs ?? []).map((item) => ({
        tag: item.tag ?? item.attrTag,
        text: item.text?.text,
      })),
      point: entity.insertionPoint,
    });
  }
  if (entity.type === 'ACAD_TABLE') {
    records.push({
      type: entity.type,
      owner,
      layer: entity.layer,
      name: entity.name,
      rowCount: entity.rowCount,
      columnCount: entity.columnCount,
      cells: entity.cells?.map((cell) => cell.text),
      point: entity.startPoint,
    });
  }
};

for (const entity of database.entities ?? []) visit(entity);
for (const block of database.tables?.BLOCK_RECORD?.entries ?? []) {
  for (const entity of block.entities ?? []) visit(entity, block.name);
}

console.log(JSON.stringify({ counts, records }, null, 2));
parser.dwg_free(raw);
