import { useState } from "react";
import { Mic, MicOff, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type InputMode = "text" | "voice";

export const InputPanel = ({ 
  onGenerate, 
  initialValue = '' 
}: { 
  onGenerate: (description: string) => void;
  initialValue?: string;
}) => {
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [description, setDescription] = useState(initialValue);
  const [isRecording, setIsRecording] = useState(false);

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      toast.info("Voice recording started");
      // Mock recording simulation
      setTimeout(() => {
        setIsRecording(false);
        setDescription("A man in his late 20s, with a long face and tired-looking eyes...");
        toast.success("Recording complete");
      }, 2000);
    } else {
      toast.info("Recording stopped");
    }
  };

  const handleGenerate = () => {
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }
    onGenerate(description);
  };

  return (
    <div className="panel p-6 flex flex-col gap-6 h-full">
      <div>
        <h2 className="text-xl font-semibold mb-4">Suspect Description</h2>
        
        <div className="flex gap-2 mb-4">
          <Button
            variant={inputMode === "text" ? "default" : "secondary"}
            onClick={() => setInputMode("text")}
            className="flex-1"
          >
            <Type className="mr-2 h-4 w-4" />
            Text Input
          </Button>
          <Button
            variant={inputMode === "voice" ? "default" : "secondary"}
            onClick={() => setInputMode("voice")}
            className="flex-1"
          >
            <Mic className="mr-2 h-4 w-4" />
            Voice Input
          </Button>
        </div>
      </div>

      <div className="flex-1">
        {inputMode === "text" ? (
          <Textarea
            placeholder="Enter a detailed description. e.g., 'A man in his late 20s, with a long face and tired-looking eyes...'"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-full min-h-[200px] resize-none bg-muted/30"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full min-h-[200px] bg-muted/30 rounded-lg border-2 border-dashed border-border">
            <button
              onClick={handleVoiceToggle}
              className="p-8 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
            >
              {isRecording ? (
                <MicOff className="h-16 w-16 text-destructive animate-pulse" />
              ) : (
                <Mic className="h-16 w-16 text-primary" />
              )}
            </button>
            <p className="mt-4 text-sm text-muted-foreground">
              {isRecording ? "Recording... Click to stop" : "Click the microphone to start recording"}
            </p>
          </div>
        )}
      </div>

      <Button onClick={handleGenerate} size="lg" className="w-full">
        Generate Initial Sketch
      </Button>
    </div>
  );
};
