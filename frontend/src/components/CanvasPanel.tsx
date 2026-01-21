import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CanvasPanelProps {
  caseId: string;
  realismScore: number;
  hasSketch: boolean;
  eyeImage?: string | null; // <--- NEW PROP for the generated eye layer
}

export const CanvasPanel = ({ caseId, realismScore, hasSketch, eyeImage }: CanvasPanelProps) => {
  const [zoom, setZoom] = useState(100);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleReset = () => setZoom(100);

  return (
    <div className="panel p-6 flex flex-col gap-4 h-full">
      {/* Header Section */}
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

      {/* Main Canvas Area */}
      <div className="flex-1 bg-canvas rounded-lg border-2 border-border flex items-center justify-center relative overflow-hidden">
        {(hasSketch || eyeImage) ? (
          <div 
            className="transition-transform duration-300"
            style={{ transform: `scale(${zoom / 100})` }}
          >
            {/* The Drawing Board */}
            <div className="w-[400px] h-[500px] bg-white rounded-lg border border-border relative shadow-sm overflow-hidden">
              
              {/* 1. Base Face Template (Optional Placeholder) */}
              {/* You can place a 'face_outline.png' in your public folder to see the head shape */}
              <img 
                src="/placeholder_face_outline.png" 
                alt="Face Outline" 
                className="absolute top-0 left-0 w-full h-full object-contain opacity-20 pointer-events-none"
                onError={(e) => (e.currentTarget.style.display = 'none')} 
              />

              {/* 2. Generated Eye Layer */}
              {eyeImage ? (
                <img 
                  src={eyeImage} 
                  alt="Generated Eyes" 
                  className="absolute z-10 mix-blend-multiply"
                  // These values position the eyes on the standard face template. 
                  // Adjust top/left/width if your specific template differs.
                  style={{ 
                    top: '35%', 
                    left: '25%', 
                    width: '50%', 
                    height: 'auto' 
                  }} 
                />
              ) : (
                 // Fallback text if hasSketch is true but no image data yet
                 <div className="w-full h-full flex items-center justify-center">
                    <p className="text-muted-foreground text-center px-4">
                      Awaiting feature generation...
                    </p>
                 </div>
              )}
            </div>
          </div>
        ) : (
          // Empty State
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

      {/* Footer Controls */}
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