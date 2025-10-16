import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasPanelProps {
  caseId: string;
  realismScore: number;
  hasSketch: boolean;
}

export const CanvasPanel = ({ caseId, realismScore, hasSketch }: CanvasPanelProps) => {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleReset = () => setZoom(100);

  return (
    <div className="panel p-6 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <span className="text-xs text-muted-foreground">Case ID</span>
            <p className="text-sm font-mono font-medium">{caseId}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Realism Score</span>
            <p className="text-sm font-semibold text-accent">{realismScore}%</p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Zoom: {zoom}%
        </div>
      </div>

      <div className="flex-1 bg-canvas rounded-lg border-2 border-border flex items-center justify-center relative overflow-hidden">
        {hasSketch ? (
          <div 
            className="transition-transform duration-300"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            <div className="w-[400px] h-[500px] bg-muted/10 rounded-lg border border-border flex items-center justify-center">
              <p className="text-muted-foreground text-center px-4">
                Generated sketch will appear here
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center px-8">
            <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-muted/20 flex items-center justify-center">
              <svg className="w-12 h-12 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2">No Sketch Generated Yet</h3>
            <p className="text-sm text-muted-foreground">
              Enter a description and click "Generate Initial Sketch" to begin
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button variant="secondary" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button variant="secondary" size="icon" disabled>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" disabled>
          <Redo className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
