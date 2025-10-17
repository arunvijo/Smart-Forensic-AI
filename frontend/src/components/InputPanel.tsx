import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square } from "lucide-react"; // Import Mic and Square icons
import { useReactMediaRecorder } from "react-media-recorder"; // Import recorder hook
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

const N8N_WEBHOOK_URL = "https://smart-forensic-ai.app.n8n.cloud/webhook-test/mistral-chat";
const CHAT_HISTORY_KEY = 'forensic-chat-history';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

export const InputPanel = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = window.localStorage.getItem(CHAT_HISTORY_KEY);
      return saved ? JSON.parse(saved) : [{ sender: 'bot', text: "Hello! Describe a facial feature, or use the mic to speak." }];
    } catch (error) {
      console.error("Failed to parse chat history", error);
      return [{ sender: 'bot', text: "Hello! Describe a facial feature, or use the mic to speak." }];
    }
  });

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // --- Audio Recording Logic ---
  const handleSendAudio = async (blobUrl: string) => {
    setIsLoading(true);
    // Add a temporary message to show audio is being processed
    setMessages(prev => [...prev, { sender: 'user', text: "🎤 Sending audio..." }]);

    try {
      const audioBlob = await fetch(blobUrl).then(res => res.blob());
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.wav");

      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData, // The browser will set the correct Content-Type
      });

      if (!response.ok) throw new Error('Audio processing failed');
      
      const botResponse: Message = await response.json();
      
      // Replace the temporary "Sending audio..." message with the bot's response
      setMessages(prev => [...prev.slice(0, -1), botResponse]);

    } catch (error) {
      console.error("Error sending audio:", error);
      toast.error("Failed to process audio.");
      // Replace the temporary message with an error message
      setMessages(prev => [...prev.slice(0, -1), {sender: 'bot', text: "I couldn't process the audio. Please try again."}]);
    } finally {
      setIsLoading(false);
    }
  };

  const { status, startRecording, stopRecording } = useReactMediaRecorder({ 
    audio: true,
    onStop: handleSendAudio // This function is called when recording stops
  });
  // --- End of Audio Logic ---

  useEffect(() => {
    window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('div[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    const userMessage: Message = { sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMessage]);
    const currentInputValue = inputValue;
    setInputValue("");
    setIsLoading(true);

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInputValue, conversation: messages }),
      });
      if (!response.ok) throw new Error('Network response was not ok');
      const botResponse: Message = await response.json();
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error("Error communicating with n8n workflow:", error);
      toast.error("Sorry, I couldn't connect to the assistant.");
      setMessages(prev => [...prev, {sender: 'bot', text: "I'm having some trouble connecting. Please try again later."}]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel p-6 flex flex-col h-screen">
      <h2 className="text-xl font-semibold mb-4">Forensic Assistant</h2>
      
      <ScrollArea className="flex-1 mb-4 border rounded-lg bg-muted/30 p-4" ref={scrollAreaRef}>
        {/* --- FIX: This section displays the chat messages --- */}
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
        {/* --- Microphone Button --- */}
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

