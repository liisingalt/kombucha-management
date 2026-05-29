import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useChatWithAdvisor,
  useGetChatHistory, getGetChatHistoryQueryKey,
  useTextToSpeech,
  useGetProfile, getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Volume2, VolumeX } from "lucide-react";
import { format } from "date-fns";

function playBase64Audio(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/mp3" });
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
}

type Message = {
  id?: number;
  role: string;
  content: string;
  createdAt?: string;
};

export default function AdvisorPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [loadingTts, setLoadingTts] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = useGetProfile({ query: { queryKey: getGetProfileQueryKey() } });
  const history = useGetChatHistory({ query: { queryKey: getGetChatHistoryQueryKey() } });
  const chat = useChatWithAdvisor();
  const tts = useTextToSpeech();

  const ttsEnabled = profile.data?.ttsEnabled ?? true;

  useEffect(() => {
    if (history.data) {
      setLocalMessages(history.data);
    }
  }, [history.data]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const userMsg: Message = { role: "user", content: text, createdAt: new Date().toISOString() };
    setLocalMessages(prev => [...prev, userMsg]);

    try {
      const result = await chat.mutateAsync({ data: { message: text } });
      const assistantMsg: Message = { role: "assistant", content: result.reply, createdAt: new Date().toISOString() };
      setLocalMessages(prev => [...prev, assistantMsg]);
      queryClient.invalidateQueries({ queryKey: getGetChatHistoryQueryKey() });

      if (ttsEnabled) {
        handleSpeak(result.reply);
      }
    } catch {
      toast({ title: "Could not get response", variant: "destructive" });
    }
  };

  const handleSpeak = async (text: string) => {
    setLoadingTts(text);
    try {
      const result = await tts.mutateAsync({ data: { text } });
      playBase64Audio(result.audio);
    } catch {
      toast({ title: "TTS unavailable", variant: "destructive" });
    } finally {
      setLoadingTts(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-80px)] lg:h-screen max-w-2xl mx-auto">
        <div className="p-6 pb-3 border-b border-border">
          <h1 className="text-2xl font-serif font-semibold">Kombucha Abiline</h1>
          <p className="text-muted-foreground text-sm mt-1">Sinu isiklik kombucha nõustaja</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {history.isLoading ? (
            <div className="space-y-3 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                  <div className={`h-10 rounded-2xl ${i % 2 === 0 ? "bg-muted w-3/4" : "bg-primary/20 w-1/2"}`} />
                </div>
              ))}
            </div>
          ) : localMessages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">?</span>
              </div>
              <p className="font-serif font-semibold text-lg mb-2">Küsi minult midagi</p>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Saan aidata käärimisaja, SCOBY tõrkeotsingu, maitsestamisidede ja muuga.
              </p>
            </div>
          ) : (
            localMessages.map((msg, i) => (
              <div
                key={i}
                data-testid={`message-${i}`}
                className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold flex-shrink-0 mt-1">
                    A
                  </div>
                )}
                <div className={`group max-w-[80%] ${msg.role === "user" ? "" : ""}`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        data-testid={`button-tts-${i}`}
                        onClick={() => handleSpeak(msg.content)}
                        disabled={loadingTts === msg.content}
                        className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {loadingTts === msg.content ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Volume2 size={14} />
                        )}
                      </button>
                      {msg.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(msg.createdAt), "h:mm a")}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {chat.isPending && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-semibold">A</div>
              <div className="px-4 py-2.5 rounded-2xl bg-card border border-border">
                <Loader2 size={14} className="animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              data-testid="input-chat-message"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Küsi oma pruulimise kohta..."
              disabled={chat.isPending}
              className="flex-1"
            />
            <Button
              data-testid="button-send-message"
              onClick={handleSend}
              disabled={chat.isPending || !input.trim()}
              size="icon"
            >
              <Send size={16} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Kõnesüntees: {ttsEnabled ? "sees" : "väljas"} — muuda seadetes
          </p>
        </div>
      </div>
    </Layout>
  );
}
