import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square, Trash2, Pencil } from "lucide-react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "react-router-dom";

const N8N_WEBHOOK_URL = "https://smart-forensic-ai.app.n8n.cloud/webhook/mistral-chat";

interface Message {
  sender: "user" | "bot";
  text: string;
}

interface InputPanelProps {
  onGenerate: (description: string) => Promise<void>;
  initialValue: string; // used as placeholder only
}

export const InputPanel = ({ onGenerate, initialValue }: InputPanelProps) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const CHAT_HISTORY_KEY = sessionId ? `forensic-chat-history-${sessionId}` : "";

  const STARTER_BOT: Message = {
    sender: "bot",
    text:
      "Hi! First, describe the face attributes (age range, gender, skin tone, hair style/length/color, eye shape/color, facial hair, glasses, scars/marks, accessories). You can also use the mic.",
  };

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined" || !sessionId) return [STARTER_BOT];
    try {
      const saved = window.localStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [STARTER_BOT];
    } catch (e) {
      console.error("Failed to parse chat history for session:", sessionId, e);
      return [STARTER_BOT];
    }
  });

  // Do NOT prefill input with initialValue; use it as placeholder only.
  const [inputValue, setInputValue] = useState<string>("");

  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // -------- Handlers: edit/delete/clear at specific message indices --------
  const editMessageAt = (index: number) => {
    const msg = messages[index];
    if (!msg || msg.sender !== "user") return;
    // Trim conversation to BEFORE this user message so a resend replaces it
    setMessages((prev) => prev.slice(0, index));
    setInputValue(msg.text);
  };

  const deleteMessageAt = (index: number) => {
    // Keep the initial greeting always
    if (index === 0) return;
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  const clearChat = () => {
    setMessages([STARTER_BOT]);
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.removeItem(CHAT_HISTORY_KEY);
    }
    toast.success("Chat cleared.");
  };

  // -------- Audio flow (unchanged core logic) --------
  const handleSendAudio = async (blobUrl: string) => {
    if (!sessionId) {
      toast.error("Cannot send message: Session ID is missing.");
      return;
    }
    setIsLoading(true);
    setMessages((prev) => [...prev, { sender: "user", text: "🎤 Sending audio..." }]);
    try {
      const audioBlob = await fetch(blobUrl).then((res) => res.blob());
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("sessionId", sessionId);

      const response = await fetch(N8N_WEBHOOK_URL, { method: "POST", body: formData });
      if (!response.ok) throw new Error("Audio processing failed");
      const botResponse: Message = await response.json();

      // Trigger generation on the first user turn
      if (messages.length === 1) {
        await onGenerate(botResponse.text);
      }

      setMessages((prev) => [
        ...prev.slice(0, -1), // remove "🎤 Sending audio..."
        { sender: "user", text: botResponse.text },
        botResponse,
      ]);
    } catch (error) {
      console.error("Error sending audio:", error);
      toast.error("Failed to process audio.");
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { sender: "bot", text: "I couldn't process the audio." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const { status, startRecording, stopRecording } = useReactMediaRecorder({
    audio: true,
    onStop: handleSendAudio,
  });

  // Persist chat
  useEffect(() => {
    if (typeof window !== "undefined" && sessionId) {
      window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages, CHAT_HISTORY_KEY, sessionId]);

  // Auto-scroll
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector(
      'div[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | undefined;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  // -------- Text flow (unchanged core logic) --------
  const handleSendMessage = async () => {
    if (!sessionId || !inputValue.trim() || isLoading || status === "recording") return;

    const trimmed = inputValue.trim();

    // Trigger generation on the first user text turn
    if (messages.length === 1) {
      await onGenerate(trimmed);
    }

    const userMessage: Message = { sender: "user", text: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, conversation: messages, sessionId }),
      });
      if (!response.ok) throw new Error("Network response was not ok");
      const botResponse: Message = await response.json();
      setMessages((prev) => [...prev, botResponse]);
    } catch (error) {
      console.error("Error communicating with n8n workflow:", error);
      toast.error("Sorry, I couldn't connect to the assistant.");
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "I'm having some trouble connecting." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="panel p-6 flex flex-col h-screen items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="panel p-6 flex flex-col h-screen">
      <h2 className="text-xl font-semibold mb-4 flex items-center justify-between">
        Forensic Assistant
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={clearChat}
          aria-label="Clear chat"
          title="Clear chat"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </h2>

      <ScrollArea
        className="flex-1 mb-4 border rounded-lg bg-muted/30 p-4"
        ref={scrollAreaRef}
      >
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.sender === "user";
            const canEdit = isUser;
            const canDelete = index !== 0; // keep the greeting

            return (
              <div
                key={index}
                className={`group flex items-center gap-1 ${
                  isUser ? "justify-end" : "justify-start"
                }`}
              >
                {/* Arrange bubble + icons so icons sit outside the bubble edge */}
                <div
                  className={`flex items-center ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  } gap-1`}
                >
                  {/* Chat bubble */}
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

                  {/* Tiny icon actions (fade in on hover) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => editMessageAt(index)}
                        aria-label="Edit this prompt"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => deleteMessageAt(index)}
                        aria-label="Delete this message"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-xs md:max-w-md rounded-lg px-4 py-2 bg-secondary text-secondary-foreground">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse delay-75"></span>
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse delay-150"></span>
                  <span className="w-2 h-2 bg-current rounded-full animate-pulse delay-300"></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input row */}
      <div className="flex gap-2">
        <Input
          placeholder={initialValue || "Describe a facial feature..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) =>
            e.key === "Enter" &&
            !isLoading &&
            status !== "recording" &&
            handleSendMessage()
          }
          disabled={isLoading || status === "recording"}
        />
        <Button
          onClick={handleSendMessage}
          disabled={isLoading || status === "recording"}
          aria-label="Send Message"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button
          onClick={status === "recording" ? stopRecording : startRecording}
          disabled={isLoading}
          variant={status === "recording" ? "destructive" : "outline"}
          aria-label={status === "recording" ? "Stop Recording" : "Start Recording"}
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
