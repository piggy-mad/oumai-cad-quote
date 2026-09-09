'use client';

import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { Focus, Minus, Plus, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Viewport = { scale: number; x: number; y: number };

const INITIAL_VIEWPORT: Viewport = { scale: 1, x: 0, y: 0 };

function clampScale(value: number): number {
  return Math.min(8, Math.max(0.5, value));
}

function safeSvgBlobUrl(svg: string): string | undefined {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (document.querySelector('parsererror')) return undefined;

  document.querySelectorAll('script, style, foreignObject, image').forEach((node) => node.remove());
  document.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith('on') || (name === 'style' && /url\s*\(/i.test(value))) {
        element.removeAttribute(attribute.name);
      }
      if ((name === 'href' || name === 'xlink:href') && !value.startsWith('#')) {
        element.removeAttribute(attribute.name);
      }
    }
  });

  const root = document.documentElement;
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  root.querySelectorAll('[stroke="#000000"], [stroke="rgb(0,0,0)"]').forEach((element) => {
    element.setAttribute('stroke', '#cbd5e1');
  });

  const cleanSvg = new XMLSerializer().serializeToString(root);
  return URL.createObjectURL(new Blob([cleanSvg], { type: 'image/svg+xml' }));
}

export function CadPreview({ svg, drawingName }: { svg?: string; drawingName: string }) {
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [viewport, setViewport] = useState<Viewport>(INITIAL_VIEWPORT);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const nextUrl = svg ? safeSvgBlobUrl(svg) : undefined;
    queueMicrotask(() => {
      if (active) setPreviewUrl(nextUrl);
    });
    return () => {
      active = false;
      if (nextUrl) URL.revokeObjectURL(nextUrl);
    };
  }, [svg]);

  function zoom(factor: number) {
    setViewport((current) => ({ ...current, scale: clampScale(current.scale * factor) }));
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!previewUrl) return;
    event.preventDefault();
    zoom(event.deltaY < 0 ? 1.12 : 1 / 1.12);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!previewUrl || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      x: viewport.x,
      y: viewport.y,
    };
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: start.x + event.clientX - start.clientX,
      y: start.y + event.clientY - start.clientY,
    }));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    dragStart.current = undefined;
    setDragging(false);
  }

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <CardHeader className="flex-row items-center justify-between border-b border-slate-200 bg-white">
        <div className="min-w-0">
          <CardTitle className="text-base">CAD 图纸预览</CardTitle>
          <p className="mt-1 truncate text-sm text-slate-500">
            {svg ? drawingName : '上传 DWG 后自动生成矢量预览'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!previewUrl}
            aria-label="缩小图纸"
            title="缩小"
            onClick={() => zoom(1 / 1.2)}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!previewUrl}
            aria-label="放大图纸"
            title="放大"
            onClick={() => zoom(1.2)}
          >
            <Plus className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={!previewUrl}
            aria-label="使图纸适应窗口"
            title="适应窗口"
            onClick={() => setViewport(INITIAL_VIEWPORT)}
          >
            <Focus className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div
          className={`relative h-[420px] touch-none overflow-hidden bg-[#07111f] select-none ${
            previewUrl ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={() => setViewport(INITIAL_VIEWPORT)}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(rgba(34,211,238,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.09) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          {previewUrl ? (
            <>
              <div
                className="absolute inset-5 grid place-items-center will-change-transform"
                style={{
                  transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
                }}
              >
                {/* A generated local SVG blob must stay an ordinary image so it remains script-isolated. */}
                {/* oxlint-disable-next-line next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={`${drawingName} CAD 图纸预览`}
                  draggable={false}
                  className="pointer-events-none h-full w-full object-contain"
                />
              </div>
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-white/10 bg-slate-950/75 px-2.5 py-1.5 text-xs text-slate-300 backdrop-blur">
                滚轮缩放 · 拖动平移 · 双击复位
              </div>
              <div className="pointer-events-none absolute right-3 bottom-3 rounded-md border border-cyan-300/20 bg-slate-950/75 px-2.5 py-1.5 font-mono text-xs text-cyan-200 backdrop-blur">
                {Math.round(viewport.scale * 100)}%
              </div>
            </>
          ) : (
            <div className="relative grid h-full place-items-center px-6 text-center">
              <div>
                <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-cyan-300/15 bg-cyan-300/5">
                  <ScanLine className="size-7 text-cyan-400" />
                </div>
                <p className="mt-4 text-base font-medium text-slate-200">等待 CAD 图纸</p>
                <p className="mt-2 text-sm text-slate-400">上传 DWG 后可直接检查图形、文字和装配布局</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
