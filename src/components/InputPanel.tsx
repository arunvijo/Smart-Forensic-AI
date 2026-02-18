import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square, Trash2, Pencil } from "lucide-react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "react-router-dom";

// External webhook for Audio processing (Optional/Legacy)
const N8N_WEBHOOK_URL = "https://smart-forensic-ai.onrender.com/mistral-chat";

interface Message {
  sender: "user" | "bot";
  text: string;
}

interface InputPanelProps {
  onGenerate: (description: string) => Promise<void>;
  initialValue: string; // Used as placeholder/initial state
}

export const InputPanel = ({ onGenerate, initialValue }: InputPanelProps) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const CHAT_HISTORY_KEY = sessionId ? `forensic-chat-history-${sessionId}` : "";

  const STARTER_BOT: Message = {
    sender: "bot",
    text: "Hi! Describe the face attributes (age, gender, hair style/color, eye shape, accessories). You can also use the mic.",
  };

  // --- STATE ---
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined" || !sessionId) return [STARTER_BOT];
    try {
      const saved = window.localStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [STARTER_BOT];
    } catch (e) {
      console.error("Failed to parse chat history:", e);
      return [STARTER_BOT];
    }
  });

  const [inputValue, setInputValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // --- HANDLERS ---

  const editMessageAt = (index: number) => {
    const msg = messages[index];
    if (!msg || msg.sender !== "user") return;
    // Trim conversation to BEFORE this user message so a resend replaces it
    setMessages((prev) => prev.slice(0, index));
    setInputValue(msg.text);
  };

  const deleteMessageAt = (index: number) => {
    if (index === 0) return; // Keep greeting
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearChat = () => {
    setMessages([STARTER_BOT]);
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.removeItem(CHAT_HISTORY_KEY);
    }
    toast.success("Chat cleared.");
  };

  // --- AUDIO LOGIC ---
  const handleSendAudio = async (blobUrl: string) => {
    if (!sessionId) {
      toast.error("Session ID missing.");
      return;
    }
    setIsLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: "🎤 Sending audio..." }]);
    
    try {
      const audioBlob = await fetch(blobUrl).then((res) => res.blob());
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("sessionId", sessionId);

      // Note: This relies on the external N8N service. 
      // If offline, this will fail, but text chat will still work via Local Backend.
      const response = await fetch(N8N_WEBHOOK_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Audio processing failed");
      
      const botResponse: Message = await response.json();

      // Trigger the local generation flow with the transcribed text
      if (botResponse.text) {
        await onGenerate(botResponse.text);
      }

      setMessages((prev) => [
        ...prev.slice(0, -1), // remove "🎤 Sending audio..."
        { sender: "user", text: `(Audio): ${botResponse.text}` },
        botResponse,
      ]);
    } catch (error) {
      console.error("Audio Error:", error);
      toast.error("Audio service unavailable. Please type your description.");
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { sender: "bot", text: "I couldn't process the audio. Please use text input." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const { status, startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop: handleSendAudio,
  });

  // --- TEXT LOGIC ---
  const handleSendMessage = async () => {
    if (!sessionId || !inputValue.trim() || isLoading || status === "recording") return;

    const trimmed = inputValue.trim();

    // 1. Update UI immediately
    const userMessage: Message = { sender: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      // 2. TRIGGER GENERATION (Calls Index.tsx -> Python Backend)
      await onGenerate(trimmed);

      // 3. Add standard bot confirmation to chat
      // (The actual visual changes happen on the Canvas)
      const botResponse: Message = { 
        sender: "bot", 
        text: "I've processed that. The sketch has been updated." 
      };
      setMessages((prev) => [...prev, botResponse]);

    } catch (error) {
      console.error("Generation Error:", error);
      toast.error("Connection failed.");
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "System error: Could not update the sketch." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- EFFECTS ---
  
  // Persist chat history
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages, CHAT_HISTORY_KEY, sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      'div[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | undefined;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  if (!sessionId) {
    return (
      <div className="panel p-6 flex flex-col h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Initializing...</p>
      </div>
    );
  }

  return (
    <div className="panel p-6 flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        Forensic Assistant
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={clearChat}
          title="Clear chat"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </h2>

      <ScrollArea
        className="flex-1 mb-4 border rounded-lg bg-muted/30 p-4 h-[calc(100vh-250px)]"
        ref={scrollAreaRef}
      >
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={index}
                className={`group flex items-center gap-1 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`flex items-center ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  } gap-1`}
                >
                  <div
                    className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                      isUser
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <p className="text-sm" style={{ whiteSpace: "pre-wrap" }}>
                      {msg.text}
                    </p>
                  </div>

                  {isUser && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => editMessageAt(index)}
                        title="Edit"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2 bg-secondary">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-75" />
                  <span className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="flex gap-2">
        <Input
          placeholder={initialValue || "Describe facial features..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" && !isLoading && status !== "recording" && handleSendMessage()
          }
          disabled={isLoading || status === "recording"}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || status === "recording"}
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button
          onClick={status === "recording" ? stopRecording : startRecording}
          disabled={isLoading}
          variant={status === "recording" ? "destructive" : "outline"}
        >
          {status === "recording" ? (
            <Square className="h-4 w-4 animate-pulse" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};