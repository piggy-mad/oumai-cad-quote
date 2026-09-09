'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Save,
  ScanLine,
  Settings2,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CadPreview } from '@/components/cad-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { extractDwg, type ExtractionResult } from '@/lib/cad-extractor';
import { quoteParts } from '@/lib/pricing';

const DEMO_RESULT: ExtractionResult = {
  projectCode: 'XM-261566',
  drawingName: 'XM-261566-客户版-8.31.dwg',
  drawingVersion: 'AC1018',
  tableName: '搅拌配置明细表',
  aiNormalized: false,
  warnings: [],
  entityCounts: { TEXT: 705, MTEXT: 216, INSERT: 61, DIMENSION: 52 },
  parts: [
    { row: 1, sourceName: '电机 YVP-7.5kW-4P-IP55-F-W-V1', name: '电机', specification: 'YVP-7.5kW-4P-IP55-F-W-V1', material: '组合件', quantity: 1, confidence: 0.98 },
    { row: 2, sourceName: '减速机', name: '减速机', specification: '', material: '组合件', quantity: 1, confidence: 0.98 },
    { row: 3, sourceName: '机械密封', name: '机械密封', specification: '', material: '组合件', quantity: 2, confidence: 0.98 },
    { row: 4, sourceName: '凸缘法兰', name: '凸缘法兰', specification: '', material: '304', quantity: 1, confidence: 0.98 },
    { row: 5, sourceName: '传动轴', name: '传动轴', specification: '', material: '304', quantity: 2, confidence: 0.98 },
    { row: 6, sourceName: '搅拌轴', name: '搅拌轴', specification: '', material: '304', quantity: 1, confidence: 0.98 },
    { row: 7, sourceName: '搅拌器 SLD1740', name: '搅拌器', specification: 'SLD1740', material: '304', quantity: 1, confidence: 0.98 },
    { row: 8, sourceName: '凸缘法兰', name: '凸缘法兰', specification: '', material: 'CS/304', quantity: 1, confidence: 0.98 },
    { row: 9, sourceName: '安装底盖', name: '安装底盖', specification: '', material: 'CS/304', quantity: 1, confidence: 0.98 },
    { row: 10, sourceName: '机架', name: '机架', specification: '', material: '组合件', quantity: 1, confidence: 0.98 },
    { row: 11, sourceName: '电减支架', name: '电减支架', specification: '', material: 'CS', quantity: 1, confidence: 0.98 },
  ],
};

type WorkStatus = 'ready' | 'reading' | 'normalizing' | 'done' | 'error';
type NormalizedPart = Partial<ExtractionResult['parts'][number]> & { row: number };
type NormalizeResponse = { enabled?: boolean; parts?: NormalizedPart[] };

const money = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2,
});

export function QuoteWorkbench() {
  const [result, setResult] = useState<ExtractionResult>(DEMO_RESULT);
  const [status, setStatus] = useState<WorkStatus>('ready');
  const [message, setMessage] = useState('当前展示已从样例 DWG 自动提取的结果');
  const [saved, setSaved] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);

  const quotedParts = useMemo(() => quoteParts(result.parts), [result.parts]);
  const matchedCount = quotedParts.filter((part) => part.matched).length;
  const costTotal = quotedParts.reduce((sum, part) => sum + part.lineCost, 0);
  const pretaxTotal = quotedParts.reduce((sum, part) => sum + part.quoteAmount, 0);
  const taxAmount = pretaxTotal * 0.13;
  const grandTotal = pretaxTotal + taxAmount;
  const progress = status === 'reading' ? 38 : status === 'normalizing' ? 76 : status === 'done' ? 100 : 0;

  useEffect(() => {
    void fetch('/api/ai-settings', { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ configured?: boolean }>)
      .then((settings: { configured?: boolean }) => setAiConfigured(Boolean(settings.configured)))
      .catch(() => setAiConfigured(false));
  }, []);

  async function saveApiKey() {
    const nextKey = apiKeyDraft.trim();
    if (nextKey && !nextKey.startsWith('sk-')) {
      setMessage('OpenAI API Key 格式不正确，应以 sk- 开头');
      return;
    }
    if (!nextKey) return;
    setSavingApiKey(true);
    try {
      const response = await fetch('/api/ai-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: nextKey }),
      });
      if (!response.ok) {
        setMessage('OpenAI API Key 保存失败，请检查格式');
        return;
      }
      setAiConfigured(true);
      setApiKeyDraft('');
      setAiSettingsOpen(false);
      setShowApiKey(false);
      setMessage('AI 服务已配置，可上传 DWG 开始智能规范化');
    } finally {
      setSavingApiKey(false);
    }
  }

  async function clearApiKey() {
    const response = await fetch('/api/ai-settings', { method: 'DELETE' });
    const settings = (await response.json()) as { configured?: boolean };
    setAiConfigured(Boolean(settings.configured));
    setApiKeyDraft('');
    setShowApiKey(false);
    setMessage(settings.configured ? '已恢复使用服务器配置的 AI Key' : 'AI Key 已清除，将使用 CAD 结构规则提取');
  }

  async function normalizeWithAI(extracted: ExtractionResult) {
    try {
      const response = await fetch('/api/normalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectCode: extracted.projectCode,
          tableName: extracted.tableName,
          parts: extracted.parts.map(({ row, sourceName, name, specification, material, quantity }) => ({ row, sourceName, name, specification, material, quantity })),
        }),
      });
      if (!response.ok) return extracted;
      const normalized = (await response.json()) as NormalizeResponse;
      if (!normalized.enabled || !Array.isArray(normalized.parts) || !normalized.parts.length) return extracted;
      const byRow = new Map(normalized.parts.map((part) => [part.row, part]));
      return {
        ...extracted,
        aiNormalized: true,
        parts: extracted.parts.map((part) => ({ ...part, ...byRow.get(part.row) })),
      };
    } catch {
      return extracted;
    }
  }

  async function processFile(file?: File) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.dwg')) {
      setStatus('error');
      setMessage('请选择 DWG 格式的 CAD 文件');
      return;
    }
    setSaved(false);
    setStatus('reading');
    setMessage('正在读取 CAD 图元、块属性和文字坐标…');
    try {
      const extracted = await extractDwg(file);
      setStatus('normalizing');
      setMessage(`已找到 ${extracted.parts.length} 个零件，正在自动规范名称并匹配价格…`);
      const normalized = await normalizeWithAI(extracted);
      setResult(normalized);
      setStatus('done');
      setMessage(`自动提取完成：${normalized.parts.length} 行，价格匹配 ${quoteParts(normalized.parts).filter((part) => part.matched).length} 行`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'CAD 解析失败');
    }
  }

  async function saveQuote() {
    setSaved(false);
    try {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectCode: result.projectCode,
          drawingName: result.drawingName,
          partCount: quotedParts.length,
          matchedCount,
          pretaxTotal,
          taxAmount,
          grandTotal,
          status: matchedCount === quotedParts.length ? '草稿' : '存在未匹配价格',
          parts: quotedParts,
        }),
      });
      setSaved(response.ok);
      setMessage(response.ok ? '报价草稿已保存' : '当前预览环境未连接报价数据库');
    } catch {
      setMessage('当前预览环境未连接报价数据库');
    }
  }

  const downloadPdf = useCallback(async () => {
    if (!quoteRef.current) return;
    setMessage('正在生成客户版 PDF…');
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);
    const canvas = await html2canvas(quoteRef.current, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = 210;
    const pageHeight = 297;
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const image = canvas.toDataURL('image/jpeg', 0.94);
    let remaining = imageHeight;
    let offset = 0;
    pdf.addImage(image, 'JPEG', 0, offset, pageWidth, imageHeight);
    remaining -= pageHeight;
    while (remaining > 0) {
      offset = remaining - imageHeight;
      pdf.addPage();
      pdf.addImage(image, 'JPEG', 0, offset, pageWidth, imageHeight);
      remaining -= pageHeight;
    }
    pdf.save(`${result.projectCode}-客户报价.pdf`);
    setMessage('客户版 PDF 已生成');
  }, [result.projectCode]);

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (
          tool: {
            name: string;
            title: string;
            description: string;
            inputSchema: object;
            annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
            execute: () => Promise<object>;
          },
          options?: { signal?: AbortSignal },
        ) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'export_current_quote_pdf',
            title: '导出当前报价 PDF',
            description: '将页面中当前已自动识别和计价的报价内容导出为客户版 PDF。',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute: async () => {
              await downloadPdf();
              return {
                projectCode: result.projectCode,
                partCount: quotedParts.length,
                grandTotal,
                status: 'downloaded',
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      // WebMCP is optional in browsers that do not expose modelContext.
    }
    return () => lifecycle.abort();
  }, [downloadPdf, grandTotal, quotedParts.length, result.projectCode]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-[#071b33] text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-cyan-400 text-[#071b33]"><ScanLine className="size-6" /></div>
            <div><h1 className="text-lg font-semibold tracking-tight">欧迈自动报价</h1><p className="text-sm text-slate-300">CAD 零件识别与报价生成</p></div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
              onClick={() => {
                setApiKeyDraft('');
                setAiSettingsOpen(true);
              }}
            >
              <Settings2 className="size-4" />
              AI 设置
              <span className={`size-2 rounded-full ${aiConfigured ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </Button>
            <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-200">MVP 0.1</Badge>
          </div>
        </div>
      </header>

      <Dialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-cyan-600" />
              AI 识别设置
            </DialogTitle>
            <DialogDescription>
              用于规范零件名称、规格和材料。密钥保存在当前浏览器会话的安全 Cookie 中，关闭浏览器后自动清除。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="openai-api-key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKeyDraft}
                onChange={(event) => setApiKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveApiKey();
                }}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                className="h-10 pr-10 font-mono"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute right-1 top-1"
                aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                onClick={() => setShowApiKey((visible) => !visible)}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              保存后页面脚本无法从 Cookie 中读取密钥；它不会写入报价数据库或源代码。
            </p>
          </div>
          <DialogFooter>
            {aiConfigured && (
              <Button type="button" variant="outline" onClick={() => void clearApiKey()}>
                清除密钥
              </Button>
            )}
            <Button type="button" disabled={savingApiKey || !apiKeyDraft.trim()} className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => void saveApiKey()}>
              {savingApiKey ? '正在保存…' : '保存设置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-5 py-5 lg:grid-cols-[330px_minmax(0,1fr)] lg:px-8">
        <aside className="space-y-5">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base">上传 CAD 图纸</CardTitle></CardHeader>
            <CardContent>
              <button
                type="button"
                className="group flex min-h-52 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 text-center transition hover:border-cyan-500 hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                onClick={() => fileInput.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); void processFile(event.dataTransfer.files[0]); }}
              >
                <UploadCloud className="mb-4 size-9 text-cyan-600" />
                <span className="font-medium">选择或拖入 DWG</span>
                <span className="mt-2 text-sm leading-6 text-slate-500">系统自动解析，无需手工录入零件</span>
              </button>
              <input ref={fileInput} type="file" accept=".dwg" className="sr-only" onChange={(event) => void processFile(event.target.files?.[0])} />
              {(status === 'reading' || status === 'normalizing') && <Progress value={progress} className="mt-4" />}
              <div className={`mt-4 flex gap-2 rounded-lg px-3 py-3 text-sm ${status === 'error' ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                {status === 'error' ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : status === 'reading' || status === 'normalizing' ? <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />}
                <span>{message}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader><CardTitle className="text-base">识别摘要</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Summary label="项目编号" value={result.projectCode} />
              <Summary label="明细表" value={result.tableName} />
              <Summary label="零件行数" value={`${result.parts.length} 行`} />
              <Summary label="价格匹配" value={`${matchedCount}/${quotedParts.length}`} />
              <Summary label="AI 归一化" value={result.aiNormalized ? '已完成' : '规则引擎'} />
              <div className="border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">图元统计：TEXT {result.entityCounts.TEXT ?? 0} · MTEXT {result.entityCounts.MTEXT ?? 0} · INSERT {result.entityCounts.INSERT ?? 0}</div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="识别零件" value={`${quotedParts.length}`} detail="来自 CAD 配置明细表" />
            <Metric label="未税报价" value={money.format(pretaxTotal)} detail={`示例成本 ${money.format(costTotal)}`} />
            <Metric label="含税报价" value={money.format(grandTotal)} detail="增值税率 13%" accent />
          </div>

          <CadPreview key={result.drawingName} svg={result.previewSvg} drawingName={result.drawingName} />

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="flex-row items-center justify-between border-b border-slate-200 bg-white">
              <div><CardTitle className="text-base">自动提取结果</CardTitle><p className="mt-1 max-w-2xl truncate text-sm text-slate-500">{result.drawingName}</p></div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => void saveQuote()}><Save className="size-4" />{saved ? '已保存' : '保存草稿'}</Button>
                <Button className="bg-cyan-600 text-white hover:bg-cyan-700" onClick={() => void downloadPdf()}><Download className="size-4" />导出 PDF</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-slate-100/80"><TableHead className="w-14">序号</TableHead><TableHead>名称及规格</TableHead><TableHead>材料</TableHead><TableHead className="text-right">数量</TableHead><TableHead>价格编码</TableHead><TableHead className="text-right">示例单价</TableHead><TableHead className="text-right">报价金额</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {quotedParts.map((part) => (
                      <TableRow key={part.row}>
                        <TableCell className="font-mono text-slate-500">{part.row}</TableCell>
                        <TableCell><div className="font-medium">{part.name}</div>{part.specification && <div className="mt-1 text-xs text-slate-500">{part.specification}</div>}</TableCell>
                        <TableCell>{part.material || '—'}</TableCell>
                        <TableCell className="text-right">{part.quantity} {part.unit}</TableCell>
                        <TableCell>{part.matched ? <Badge variant="secondary" className="font-mono font-normal">{part.priceCode}</Badge> : <Badge variant="destructive">未匹配</Badge>}</TableCell>
                        <TableCell className="text-right tabular-nums">{money.format(part.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">{money.format(part.quoteAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div ref={quoteRef} className="quote-sheet bg-white p-10 text-slate-950">
            <div className="border-b-2 border-slate-900 pb-5 text-center"><h2 className="text-2xl font-bold tracking-[0.25em]">设备报价单</h2><p className="mt-2 text-sm text-slate-600">山东欧迈机械股份有限公司</p></div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 py-5 text-sm"><div>项目编号：{result.projectCode}</div><div>报价日期：{new Date().toLocaleDateString('zh-CN')}</div><div className="col-span-2">图纸文件：{result.drawingName}</div></div>
            <table className="w-full border-collapse text-sm"><thead><tr>{['序号','名称及规格','材料','数量','单位','未税单价','未税金额'].map((label) => <th key={label} className="border border-slate-400 bg-slate-100 px-2 py-2 text-left">{label}</th>)}</tr></thead><tbody>{quotedParts.map((part) => <tr key={part.row}><td className="border border-slate-300 px-2 py-2">{part.row}</td><td className="border border-slate-300 px-2 py-2">{part.name}{part.specification ? ` ${part.specification}` : ''}</td><td className="border border-slate-300 px-2 py-2">{part.material}</td><td className="border border-slate-300 px-2 py-2">{part.quantity}</td><td className="border border-slate-300 px-2 py-2">{part.unit}</td><td className="border border-slate-300 px-2 py-2 text-right">{money.format(part.quoteUnitPrice)}</td><td className="border border-slate-300 px-2 py-2 text-right">{money.format(part.quoteAmount)}</td></tr>)}</tbody></table>
            <div className="ml-auto mt-6 w-80 space-y-2 text-sm"><Summary label="未税合计" value={money.format(pretaxTotal)} /><Summary label="税额（13%）" value={money.format(taxAmount)} /><div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg font-bold"><span>含税总价</span><span>{money.format(grandTotal)}</span></div></div>
            <p className="mt-10 border-t border-slate-300 pt-4 text-xs leading-5 text-slate-500">本报价由 CAD 配置明细自动生成。当前价格为 MVP 示例数据，正式使用前须由价格管理员维护并审核。</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right font-medium">{value}</span></div>;
}

function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={`rounded-xl border p-4 shadow-sm ${accent ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'}`}><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}
