import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square } from "lucide-react";
import { useReactMediaRecorder } from "react-media-recorder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useParams } from "react-router-dom";

const N8N_WEBHOOK_URL = "https://smart-forensic-ai.app.n8n.cloud/webhook/mistral-chat";

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

// --- NEW: Define props to accept from Index.tsx ---
interface InputPanelProps {
  onGenerate: (description: string) => Promise<void>;
  initialValue: string;
}

export const InputPanel = ({ onGenerate, initialValue }: InputPanelProps) => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const CHAT_HISTORY_KEY = sessionId ? `forensic-chat-history-${sessionId}` : '';

  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined' || !sessionId) {
      return [{ sender: 'bot', text: "Hello! Describe the subject or use the mic to speak." }];
    }
    try {
      const saved = window.localStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [{ sender: 'bot', text: "Hello! Describe the subject or use the mic to speak." }];
    } catch (error) {
      console.error("Failed to parse chat history for session:", sessionId, error);
      return [{ sender: 'bot', text: "Hello! Describe the subject or use the mic to speak." }];
    }
  });

  const [inputValue, setInputValue] = useState(initialValue || ""); // --- NEW: Use initialValue
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // If there's an initial value but the chat is fresh, set the input value
    if (initialValue && messages.length <= 1) {
      setInputValue(initialValue);
    }
  }, [initialValue, messages.length]);


  const handleSendAudio = async (blobUrl: string) => {
    if (!sessionId) {
      toast.error("Cannot send message: Session ID is missing.");
      return;
    }
    setIsLoading(true);
    setMessages(prev => [...prev, { sender: 'user', text: "🎤 Sending audio..." }]);
    try {
      const audioBlob = await fetch(blobUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");
      formData.append("sessionId", sessionId);

      const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST', body: formData });
      if (!response.ok) throw new Error('Audio processing failed');
      const botResponse: Message = await response.json();
      
      // --- NEW: Trigger generation on the first audio message ---
      if (messages.length === 1) {
        await onGenerate(botResponse.text); // Use transcribed text for generation
      }
      
      setMessages(prev => [...prev.slice(0, -1), { sender: 'user', text: botResponse.text }, botResponse]);
    } catch (error) {
      console.error("Error sending audio:", error);
      toast.error("Failed to process audio.");
      setMessages(prev => [...prev.slice(0, -1), {sender: 'bot', text: "I couldn't process the audio."}]);
    } finally {
      setIsLoading(false);
    }
  };

  const { status, startRecording, stopRecording } = useReactMediaRecorder({ 
    audio: true,
    onStop: handleSendAudio
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionId) {
      window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
    }
  }, [messages, CHAT_HISTORY_KEY, sessionId]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const handleSendMessage = async () => {
    if (!sessionId || !inputValue.trim()) return;

    // --- NEW: Trigger generation on the first text message ---
    if (messages.length === 1) {
      await onGenerate(inputValue);
    }

    const userMessage: Message = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    const currentInputValue = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInputValue, conversation: messages, sessionId }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const botResponse: Message = await response.json();
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error("Error communicating with n8n workflow:", error);
      toast.error("Sorry, I couldn't connect to the assistant.");
      setMessages(prev => [...prev, {sender: 'bot', text: "I'm having some trouble connecting."}]);
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
      <h2 className="text-xl font-semibold mb-4">Forensic Assistant</h2>
      
      <ScrollArea className="flex-1 mb-4 border rounded-lg bg-muted/30 p-4" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-end gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs md:max-w-md rounded-lg px-4 py-2 ${
                  msg.sender === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground'
                }`}
              >
                <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
              </div>
            </div>
          ))}
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

      <div className="flex gap-2">
        <Input
          placeholder="Describe a facial feature..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          disabled={isLoading || status === 'recording'}
        />
        <Button onClick={handleSendMessage} disabled={isLoading || status === 'recording'} aria-label="Send Message">
          <Send className="h-4 w-4" />
        </Button>
        <Button 
          onClick={status === 'recording' ? stopRecording : startRecording} 
          disabled={isLoading}
          variant={status === 'recording' ? 'destructive' : 'outline'}
          aria-label={status === 'recording' ? 'Stop Recording' : 'Start Recording'}
        >
          {status === 'recording' ? <Square className="h-4 w-4 animate-pulse" /> : <Mic className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
};

