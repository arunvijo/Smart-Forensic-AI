import { useState, useEffect } from "react";
import { Save, Download } from "lucide-react";
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

type Component = "face" | "eyes" | "nose" | "mouth" | "hair" | "accessories";

const components: { value: Component; label: string }[] = [
  { value: "face", label: "Face Shape" },
  { value: "eyes", label: "Eyes" },
  { value: "nose", label: "Nose" },
  { value: "mouth", label: "Mouth" },
  { value: "hair", label: "Hair" },
  { value: "accessories", label: "Accessories" },
];

type Log = {
  id: string;
  description: string;
  timestamp: string;
};

export const RefinementPanel = ({ sessionId }: { sessionId: string }) => {
  const [selectedComponent, setSelectedComponent] = useState<Component>("face");
  const [verticalPos, setVerticalPos] = useState([50]);
  const [horizontalPos, setHorizontalPos] = useState([50]);
  const [scale, setScale] = useState([100]);
  const [rotation, setRotation] = useState([0]);
  const [refinementText, setRefinementText] = useState("");
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    if (sessionId) {
      fetchLogs();
    }
  }, [sessionId]);

  const fetchLogs = async () => {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
  };

  const handleApplyChange = async () => {
    if (!refinementText.trim()) {
      toast.error("Please describe a change");
      return;
    }
    
    // Create log entry
    await supabase
      .from('logs')
      .insert([{
        session_id: sessionId,
        action_type: 'transform',
        description: refinementText
      }]);

    toast.success("Applying refinement...");
    setRefinementText("");
    fetchLogs();
  };

  const handleSave = async () => {
    await supabase
      .from('sessions')
      .update({ status: 'Completed' })
      .eq('id', sessionId);
    
    toast.success("Session saved successfully");
  };

  const handleExport = async () => {
    await supabase
      .from('logs')
      .insert([{
        session_id: sessionId,
        action_type: 'update',
        description: 'Final sketch exported'
      }]);
    
    toast.success("Exporting final sketch...");
  };

  return (
    <div className="panel p-6 flex flex-col gap-4 h-full overflow-hidden">
      <h2 className="text-xl font-semibold">Refinement Toolkit</h2>

      <Tabs defaultValue="toolkit" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="toolkit">Toolkit</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="toolkit" className="flex-1 flex flex-col gap-4 overflow-auto mt-4">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">Select Component</label>
              <Select value={selectedComponent} onValueChange={(v) => setSelectedComponent(v as Component)}>
                <SelectTrigger>
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

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Move Vertical</label>
                <Slider
                  value={verticalPos}
                  onValueChange={setVerticalPos}
                  min={0}
                  max={100}
                  step={1}
                  className="mb-2"
                />
                <span className="text-xs text-muted-foreground">{verticalPos[0]}%</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Move Horizontal</label>
                <Slider
                  value={horizontalPos}
                  onValueChange={setHorizontalPos}
                  min={0}
                  max={100}
                  step={1}
                  className="mb-2"
                />
                <span className="text-xs text-muted-foreground">{horizontalPos[0]}%</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Scale</label>
                <Slider
                  value={scale}
                  onValueChange={setScale}
                  min={80}
                  max={120}
                  step={1}
                  className="mb-2"
                />
                <span className="text-xs text-muted-foreground">{scale[0]}%</span>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Rotate</label>
                <Slider
                  value={rotation}
                  onValueChange={setRotation}
                  min={-15}
                  max={15}
                  step={1}
                  className="mb-2"
                />
                <span className="text-xs text-muted-foreground">{rotation[0]}°</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <label className="text-xs text-muted-foreground mb-2 block">Natural Language Refinement</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 'make the nose smaller'"
                value={refinementText}
                onChange={(e) => setRefinementText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApplyChange()}
              />
              <Button onClick={handleApplyChange} size="sm">
                Apply
              </Button>
            </div>
          </div>

          <div className="mt-auto pt-4 border-t border-border space-y-2">
            <Button variant="secondary" onClick={handleSave} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              Save Session
            </Button>
            <Button onClick={handleExport} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Export Final Sketch
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-auto mt-4">
          <div className="space-y-3">
            {logs.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No refinement history yet</p>
              </div>
            ) : (
              logs.map((log) => (
                <div 
                  key={log.id} 
                  className="p-3 rounded-lg bg-muted/30 border border-border"
                >
                  <p className="text-sm mb-1">{log.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(log.timestamp), 'MMM d, yyyy HH:mm')}
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
