import { useState, useRef } from "react";
import { Mic, MicOff, Type, Send } from "lucide-react";
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Function to handle starting and stopping the recording
  const handleVoiceToggle = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      toast.info("Recording stopped. Processing audio...");
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
          await sendAudioToBackend(audioBlob);
          // Stop the microphone track
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
        toast.info("Voice recording started...");
      } catch (error) {
        console.error("Error accessing microphone:", error);
        toast.error("Could not access microphone. Please check permissions.");
      }
    }
  };

  // Function to send the recorded audio to the backend
  const sendAudioToBackend = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    try {
      toast.loading("Transcribing audio...");
      const response = await fetch("http://127.0.0.1:5000/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to transcribe audio");
      }

      const data = await response.json();
      if (data.status === 'success' && data.transcription) {
        setDescription(data.transcription);
        toast.success("Transcription complete!");
      } else {
        throw new Error(data.message || "Unknown error during transcription");
      }
    } catch (error) {
      console.error("Error sending audio to backend:", error);
      toast.error("Failed to process audio.");
    }
  };

  // Function to send the final description (from text or voice)
  const handleGenerate = async () => {
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
        <Send className="mr-2 h-4 w-4" />
        Generate Initial Sketch
      </Button>
    </div>
  );
};