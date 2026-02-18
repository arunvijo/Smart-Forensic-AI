import { useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Undo, Redo } from "lucide-react";
import { Button } from "@/components/ui/button";

// --- Types (Can be moved to a shared types file later) ---
export type ComponentLayer = "face" | "eyes" | "nose" | "mouth" | "hair";

export interface RefinementState {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

interface CanvasPanelProps {
  caseId: string;
  realismScore: number;
  hasSketch: boolean;
  faceShape?: string;
  eyeImage: string | null;   // Layer 1: Eyes
  noseImage: string | null;  // Layer 2: Nose
  mouthImage: string | null; // Layer 3: Mouth
  hairImage: string | null;  // Layer 4: Hair (NEW)
  // Dictionary of refinements for each layer
  allRefinements: Record<ComponentLayer, RefinementState>;
}

export const CanvasPanel = ({ 
  caseId, 
  realismScore, 
  hasSketch, 
  faceShape = "oval", 
  eyeImage, 
  noseImage,
  mouthImage,
  hairImage,
  allRefinements
}: CanvasPanelProps) => {
  const [zoom, setZoom] = useState(100);
  const [imgError, setImgError] = useState(false);

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 50));
  const handleReset = () => setZoom(100);

  // Helper to generate CSS transform for a specific layer
  const getLayerStyle = (layer: ComponentLayer) => {
    // Fallback to default if data is missing
    const r = allRefinements[layer] || { x: 0, y: 0, scale: 1, rotate: 0 };
    
    return {
      transform: `translate(${r.x}px, ${r.y}px) scale(${r.scale}) rotate(${r.rotate}deg)`,
      // Z-Index Stack: Face(10) -> Hair(15) -> Eyes(20) -> Nose(25) -> Mouth(30)
      zIndex: layer === 'face' ? 10 :
              layer === 'hair' ? 15 :
              layer === 'eyes' ? 20 : 
              layer === 'nose' ? 25 : 30
    };
  };

  const getBaseFaceSrc = (shape: string) => {
    switch (shape?.toLowerCase()) {
      case 'round': return '/faces/round_face.png';
      case 'square': return '/faces/square_face.png';
      case 'long': return '/faces/long_face.png';
      default: return '/faces/oval_face.png';
    }
  };

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
        <div 
          className="transition-transform duration-300 relative"
          style={{ transform: `scale(${zoom / 100})` }}
        >
          {/* The Drawing Board (Fixed Size 512x512) */}
          <div className="w-[512px] h-[512px] bg-white rounded-lg border border-border relative shadow-2xl overflow-hidden">
            
            {/* Layer 0: Base Face Template */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={getLayerStyle('face')}>
                {!imgError ? (
                  <img 
                    src={getBaseFaceSrc(faceShape)} 
                    alt={`${faceShape} face outline`}
                    className="w-full h-full object-contain opacity-40 transition-transform duration-200"
                    // Apply 'face' layer refinements (mostly for scale if needed)
                    onError={() => setImgError(true)}
                  />
                ) : (
                  // CSS Fallback
                  <div 
                    className="border-4 border-gray-300 opacity-40"
                    style={{
                      width: faceShape === 'round' ? '350px' : faceShape === 'square' ? '320px' : '300px',
                      height: faceShape === 'round' ? '350px' : faceShape === 'square' ? '380px' : '420px',
                      borderRadius: faceShape === 'square' ? '60px' : '50%'
                    }}
                  />
                )}
            </div>

            {/* Layer 1: Hair (Z-Index 15) */}
            {hairImage && (
              <img 
                src={hairImage} 
                alt="Generated Hair" 
                className="absolute top-0 left-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-200"
                style={getLayerStyle('hair')}
              />
            )}

            {/* Layer 2: Generated Eyes (Z-Index 20) */}
            {eyeImage && (
              <img 
                src={eyeImage} 
                alt="Generated Eyes" 
                className="absolute top-0 left-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-200"
                style={getLayerStyle('eyes')}
              />
            )}

            {/* Layer 3: Generated Nose (Z-Index 25) */}
            {noseImage && (
              <img 
                src={noseImage} 
                alt="Generated Nose" 
                className="absolute top-0 left-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-200"
                style={getLayerStyle('nose')}
              />
            )}

            {/* Layer 4: Generated Mouth (Z-Index 30) */}
            {mouthImage && (
              <img 
                src={mouthImage} 
                alt="Generated Mouth" 
                className="absolute top-0 left-0 w-full h-full object-cover mix-blend-multiply transition-transform duration-200"
                style={getLayerStyle('mouth')}
              />
            )}

            {/* Fallback Message */}
            {(!eyeImage && !mouthImage && !noseImage && !hairImage && !hasSketch) && (
                <div className="absolute inset-0 flex items-center justify-center z-0">
                  <p className="text-muted-foreground text-sm">Waiting for feature generation...</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="secondary" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
          <ZoomIn className="h-4 w-4" />
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