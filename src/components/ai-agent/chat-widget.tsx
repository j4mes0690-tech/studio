'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
    BrainCircuit, 
    X, 
    Send, 
    Loader2, 
    MessageSquare, 
    Sparkles,
    User,
    Bot,
    ChevronDown,
    Maximize2,
    Minimize2
} from 'lucide-react';
import { siteAgentChat } from '@/ai/flows/site-agent-flow';
import { useUser } from '@/firebase';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type ChatRole = 'user' | 'model';

type LocalMessage = {
    role: ChatRole;
    content: string;
    timestamp: number;
};

export function SiteAgentWidget() {
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<LocalMessage[]>([]);
    const [isPending, startTransition] = useTransition();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isPending]);

    const handleSend = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!input.trim() || isPending) return;

        const userMsg: LocalMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        };

        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');

        startTransition(async () => {
            try {
                const response = await siteAgentChat({
                    messages: updatedMessages.map(m => ({ 
                        role: m.role, 
                        content: m.content 
                    })),
                    userEmail: user?.email
                });

                if (response) {
                    setMessages(prev => [...prev, {
                        role: 'model',
                        content: response,
                        timestamp: Date.now()
                    }]);
                }
            } catch (err) {
                setMessages(prev => [...prev, {
                    role: 'model',
                    content: "I'm sorry, I encountered a technical issue connecting to the site mainframe. Please try again in a moment.",
                    timestamp: Date.now()
                }]);
            }
        });
    };

    if (!user) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">
            {isOpen && (
                <Card className={cn(
                    "pointer-events-auto shadow-2xl border-primary/20 flex flex-col transition-all duration-300 animate-in slide-in-from-bottom-4 zoom-in-95",
                    isExpanded ? "w-[95vw] h-[85vh] sm:w-[600px] sm:h-[700px]" : "w-[350px] h-[500px]"
                )}>
                    <CardHeader className="bg-primary p-4 text-white flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                                <BrainCircuit className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-black uppercase tracking-widest">Site Intelligence</CardTitle>
                                <Badge variant="secondary" className="h-4 text-[8px] bg-white/10 text-white border-transparent uppercase">Gemini 1.5 Flash</Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsExpanded(!isExpanded)}>
                                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => setIsOpen(false)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 overflow-hidden p-0 bg-muted/5">
                        <ScrollArea className="h-full p-4">
                            <div className="space-y-4">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                                        <div className="bg-primary/5 p-4 rounded-full">
                                            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold">How can I assist today?</p>
                                            <p className="text-[10px] text-muted-foreground uppercase font-medium max-w-[200px]">I can lookup project info, trade partners, or guide you through site processes.</p>
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 w-full max-w-[250px]">
                                            <Button variant="outline" size="sm" className="text-[10px] h-8 justify-start font-bold uppercase tracking-tighter" onClick={() => { setInput("What projects am I assigned to?"); }}>
                                                <ChevronDown className="mr-2 h-3 w-3 text-primary rotate-[-90deg]" /> My Projects
                                            </Button>
                                            <Button variant="outline" size="sm" className="text-[10px] h-8 justify-start font-bold uppercase tracking-tighter" onClick={() => { setInput("Who are our registered designers?"); }}>
                                                <ChevronDown className="mr-2 h-3 w-3 text-primary rotate-[-90deg]" /> List Designers
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {messages.map((msg, i) => (
                                    <div key={i} className={cn(
                                        "flex flex-col",
                                        msg.role === 'user' ? "items-end" : "items-start"
                                    )}>
                                        <div className={cn(
                                            "max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm",
                                            msg.role === 'user' 
                                                ? "bg-primary text-primary-foreground rounded-tr-none" 
                                                : "bg-white border rounded-tl-none prose prose-sm prose-slate"
                                        )}>
                                            {msg.role === 'model' ? (
                                                <div className="flex gap-3">
                                                    <div className="mt-1 shrink-0"><Bot className="h-4 w-4 text-primary" /></div>
                                                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                                                </div>
                                            ) : (
                                                <p className="leading-relaxed">{msg.content}</p>
                                            )}
                                        </div>
                                        <span className="text-[8px] mt-1 text-muted-foreground font-bold px-2">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                                
                                {isPending && (
                                    <div className="flex justify-start">
                                        <div className="bg-white border px-4 py-3 rounded-2xl rounded-tl-none flex items-center gap-3 shadow-sm">
                                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">SIA is thinking...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-4 border-t shrink-0">
                        <form onSubmit={handleSend} className="flex w-full gap-2">
                            <Input 
                                placeholder="Ask SIA anything..." 
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                disabled={isPending}
                                className="bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary h-11"
                            />
                            <Button type="submit" size="icon" disabled={!input.trim() || isPending} className="h-11 w-11 shrink-0 shadow-lg shadow-primary/20">
                                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}

            <button 
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "pointer-events-auto h-14 w-14 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-95 group relative",
                    isOpen ? "bg-white text-primary border-2 border-primary" : "bg-primary text-white"
                )}
            >
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl group-hover:scale-125 transition-transform animate-pulse" />
                {isOpen ? <X className="h-6 w-6 relative z-10" /> : <BrainCircuit className="h-7 w-7 relative z-10" />}
                {!isOpen && (
                    <div className="absolute -top-1 -left-1 bg-white p-1 rounded-full border shadow-sm scale-0 group-hover:scale-100 transition-transform">
                        <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                )}
            </button>
        </div>
    );
}
