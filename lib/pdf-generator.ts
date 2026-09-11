import type { QuotedPart } from './pricing';

type QuotePdfInput = {
  projectCode: string;
  drawingName: string;
  parts: QuotedPart[];
  pretaxTotal: number;
  taxAmount: number;
  grandTotal: number;
};

const PAGE_WIDTH = 1240;
const PAGE_HEIGHT = 1754;
const MARGIN = 70;
const ROWS_PER_PAGE = 13;
const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';

const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

function canvasPage(): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_WIDTH;
  canvas.height = PAGE_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器无法创建 PDF 画布');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  context.textBaseline = 'middle';
  return { canvas, context };
}

function fitText(context: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  if (context.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && context.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

function drawText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  align: CanvasTextAlign = 'left',
) {
  context.textAlign = align;
  const targetX = align === 'right' ? x + maxWidth : align === 'center' ? x + maxWidth / 2 : x;
  context.fillText(fitText(context, value, maxWidth), targetX, y);
}

function drawPageHeader(
  context: CanvasRenderingContext2D,
  input: QuotePdfInput,
  pageNumber: number,
  pageCount: number,
): number {
  context.fillStyle = '#0f172a';
  context.font = `700 38px ${FONT_FAMILY}`;
  context.textAlign = 'center';
  context.fillText('设备报价单', PAGE_WIDTH / 2, 92);
  context.font = `400 20px ${FONT_FAMILY}`;
  context.fillStyle = '#475569';
  context.fillText('山东欧迈机械股份有限公司', PAGE_WIDTH / 2, 137);

  context.strokeStyle = '#0f172a';
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(MARGIN, 172);
  context.lineTo(PAGE_WIDTH - MARGIN, 172);
  context.stroke();

  context.textAlign = 'left';
  context.font = `400 19px ${FONT_FAMILY}`;
  context.fillStyle = '#334155';
  context.fillText(`项目编号：${input.projectCode}`, MARGIN, 214);
  context.textAlign = 'right';
  context.fillText(`报价日期：${new Date().toLocaleDateString('zh-CN')}`, PAGE_WIDTH - MARGIN, 214);
  context.textAlign = 'left';
  drawText(context, `图纸文件：${input.drawingName}`, MARGIN, 252, PAGE_WIDTH - MARGIN * 2);

  context.font = `400 16px ${FONT_FAMILY}`;
  context.fillStyle = '#64748b';
  context.textAlign = 'right';
  context.fillText(`第 ${pageNumber} / ${pageCount} 页`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 38);
  return 286;
}

function drawQuoteTable(
  context: CanvasRenderingContext2D,
  parts: QuotedPart[],
  startY: number,
): number {
  const widths = [70, 350, 135, 85, 80, 190, 190];
  const labels = ['序号', '名称及规格', '材料', '数量', '单位', '未税单价', '未税金额'];
  const headerHeight = 54;
  const rowHeight = 70;
  const contentWidth = widths.reduce((sum, width) => sum + width, 0);

  context.fillStyle = '#e2e8f0';
  context.fillRect(MARGIN, startY, contentWidth, headerHeight);
  context.strokeStyle = '#64748b';
  context.lineWidth = 1.5;
  context.font = `600 18px ${FONT_FAMILY}`;
  context.fillStyle = '#0f172a';

  let x = MARGIN;
  labels.forEach((label, index) => {
    context.strokeRect(x, startY, widths[index], headerHeight);
    drawText(context, label, x + 8, startY + headerHeight / 2, widths[index] - 16, index >= 3 ? 'center' : 'left');
    x += widths[index];
  });

  parts.forEach((part, rowIndex) => {
    const y = startY + headerHeight + rowIndex * rowHeight;
    if (rowIndex % 2 === 1) {
      context.fillStyle = '#f8fafc';
      context.fillRect(MARGIN, y, contentWidth, rowHeight);
    }
    const values = [
      String(part.row),
      `${part.name}${part.specification ? ` ${part.specification}` : ''}`,
      part.material || '—',
      String(part.quantity),
      part.unit,
      money.format(part.quoteUnitPrice),
      money.format(part.quoteAmount),
    ];
    x = MARGIN;
    context.font = `400 17px ${FONT_FAMILY}`;
    values.forEach((value, index) => {
      context.strokeStyle = '#94a3b8';
      context.lineWidth = 1;
      context.strokeRect(x, y, widths[index], rowHeight);
      context.fillStyle = index === 6 ? '#0f172a' : '#334155';
      if (index === 6) context.font = `600 17px ${FONT_FAMILY}`;
      const align: CanvasTextAlign = index === 0 || (index >= 3 && index <= 4) ? 'center' : index >= 5 ? 'right' : 'left';
      drawText(context, value, x + 9, y + rowHeight / 2, widths[index] - 18, align);
      context.font = `400 17px ${FONT_FAMILY}`;
      x += widths[index];
    });
  });
  return startY + headerHeight + parts.length * rowHeight;
}

function drawTotals(context: CanvasRenderingContext2D, input: QuotePdfInput, startY: number) {
  const boxWidth = 430;
  const boxX = PAGE_WIDTH - MARGIN - boxWidth;
  const rows = [
    ['未税合计', money.format(input.pretaxTotal)],
    ['税额（13%）', money.format(input.taxAmount)],
    ['含税总价', money.format(input.grandTotal)],
  ];
  rows.forEach(([label, value], index) => {
    const y = startY + 28 + index * 48;
    if (index === 2) {
      context.strokeStyle = '#0f172a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(boxX, y - 25);
      context.lineTo(PAGE_WIDTH - MARGIN, y - 25);
      context.stroke();
    }
    context.font = `${index === 2 ? '700 23px' : '400 19px'} ${FONT_FAMILY}`;
    context.fillStyle = '#0f172a';
    context.textAlign = 'left';
    context.fillText(label, boxX, y);
    context.textAlign = 'right';
    context.fillText(value, PAGE_WIDTH - MARGIN, y);
  });

  context.font = `400 15px ${FONT_FAMILY}`;
  context.fillStyle = '#64748b';
  context.textAlign = 'left';
  context.fillText(
    '本报价由 CAD 配置明细自动生成，正式使用前请确认价格库数据。',
    MARGIN,
    Math.min(PAGE_HEIGHT - 82, startY + 190),
  );
}

export async function generateQuotePdf(input: QuotePdfInput): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const pageCount = Math.max(1, Math.ceil(input.parts.length / ROWS_PER_PAGE));
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    if (pageIndex > 0) pdf.addPage();
    const { canvas, context } = canvasPage();
    const tableY = drawPageHeader(context, input, pageIndex + 1, pageCount);
    const pageParts = input.parts.slice(pageIndex * ROWS_PER_PAGE, (pageIndex + 1) * ROWS_PER_PAGE);
    const tableBottom = drawQuoteTable(context, pageParts, tableY);
    if (pageIndex === pageCount - 1) drawTotals(context, input, tableBottom);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  return pdf.output('blob');
}
