import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Save, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

// Shared Types
export interface RefinementState {
  x: number;
  y: number;
  scale: number;
  rotate: number;
}

// Updated type to include hair
export type ComponentLayer = "face" | "eyes" | "nose" | "mouth" | "hair";

interface RefinementPanelProps {
  selectedLayer: ComponentLayer;
  onLayerChange: (layer: ComponentLayer) => void;
  refinement: RefinementState;
  onRefinementChange: (state: RefinementState) => void;
}

const components: { value: ComponentLayer; label: string }[] = [
  { value: "face", label: "Face Shape" },
  { value: "hair", label: "Hair" }, // Added Hair to toolkit
  { value: "eyes", label: "Eyes" },
  { value: "nose", label: "Nose" },
  { value: "mouth", label: "Mouth" },
];

type Log = {
  id: string;
  description: string;
  timestamp: string;
};

export const RefinementPanel = ({ 
  selectedLayer, 
  onLayerChange,
  refinement, 
  onRefinementChange 
}: RefinementPanelProps) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [refinementText, setRefinementText] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (sessionId) fetchLogs();
  }, [sessionId]);

  const fetchLogs = async () => {
    if (!sessionId) return;
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (!error && data) setLogs(data);
  };

  // --- HANDLERS ---
  const handleChange = (key: keyof RefinementState, val: number) => {
    onRefinementChange({ ...refinement, [key]: val });
  };

  const handleReset = () => {
    // Reset current layer to default neutral state
    onRefinementChange({ x: 0, y: 0, scale: 1, rotate: 0 });
    toast.info(`${selectedLayer} position reset`);
  };

  const handleApplyTextRefinement = async () => {
    if (!refinementText.trim() || !sessionId) return;
    
    await supabase.from('logs').insert([{
      session_id: sessionId,
      action_type: 'text_refine',
      description: `[${selectedLayer}] User: "${refinementText}"`
    }]);

    toast.success("Instruction sent to AI");
    setRefinementText("");
    fetchLogs();
  };

  const handleSave = async () => {
    if (!sessionId) return;
    await supabase
      .from('sessions')
      .update({ status: 'Completed' })
      .eq('id', sessionId);
    
    toast.success("Session saved successfully");
  };

  return (
    <div className="flex flex-col gap-4 h-full bg-card/30 p-6 border-l border-border">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Refinement Toolkit</h2>
        <Button variant="ghost" size="icon" onClick={handleReset} title={`Reset ${selectedLayer}`}>
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <Tabs defaultValue="toolkit" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="toolkit">Toolkit</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="toolkit" className="flex-1 flex flex-col gap-6 overflow-y-auto mt-4 pr-2">
          
          {/* LAYER SELECTOR */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Selected Layer
            </label>
            <Select 
              value={selectedLayer} 
              onValueChange={(v) => onLayerChange(v as ComponentLayer)}
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {components.map((comp) => (
                  <SelectItem key={comp.value} value={comp.value}>
                    {comp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* SLIDERS */}
          <div className="space-y-6">
            {/* Vertical (Y) */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Vertical (Y)</label>
                <span className="text-xs font-mono">{refinement.y}px</span>
              </div>
              <Slider
                value={[refinement.y]}
                onValueChange={(v) => handleChange('y', v[0])}
                min={-150} max={150} step={1}
              />
            </div>

            {/* Horizontal (X) */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Horizontal (X)</label>
                <span className="text-xs font-mono">{refinement.x}px</span>
              </div>
              <Slider
                value={[refinement.x]}
                onValueChange={(v) => handleChange('x', v[0])}
                min={-100} max={100} step={1}
              />
            </div>

            {/* Scale */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Scale</label>
                <span className="text-xs font-mono">{Math.round(refinement.scale * 100)}%</span>
              </div>
              <Slider
                value={[refinement.scale * 100]}
                onValueChange={(v) => handleChange('scale', v[0] / 100)}
                min={50} max={200} step={1}
              />
            </div>

            {/* Rotation */}
            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-xs text-muted-foreground">Rotation</label>
                <span className="text-xs font-mono">{refinement.rotate}°</span>
              </div>
              <Slider
                value={[refinement.rotate]}
                onValueChange={(v) => handleChange('rotate', v[0])}
                min={-45} max={45} step={1}
              />
            </div>
          </div>

          {/* Smart Refine Input */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Smart Refine</label>
            <div className="flex gap-2">
              <Input
                placeholder={`e.g., 'Make ${selectedLayer} wider'`}
                value={refinementText}
                onChange={(e) => setRefinementText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyTextRefinement()}
                className="bg-background/50"
              />
              <Button onClick={handleApplyTextRefinement} size="sm">
                Apply
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto pt-4 space-y-2">
            <Button variant="secondary" onClick={handleSave} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Session
            </Button>
            <Button variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export Image
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto mt-4 pr-2">
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No changes recorded.</p>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-3 rounded-lg bg-muted/40 border border-white/5">
                  <p className="text-sm font-medium">{log.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </p>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};