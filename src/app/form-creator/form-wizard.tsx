'use client';

import { useState, useTransition, useMemo } from 'react';
import { 
  Wand2, 
  FileCheck, 
  ClipboardCheck, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  Layout, 
  Sparkles,
  Save,
  Tag,
  X,
  RefreshCw,
  Eye,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { 
  FormWizardType, 
  TemplateSection, 
  TemplateField, 
  PermitType, 
  Trade,
  DistributionUser 
} from '@/lib/types';
import { generateFormStructure } from '@/ai/flows/generate-form-structure';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

type Step = 'type' | 'info' | 'structure' | 'review';

export function FormWizard({ currentUser }: { currentUser: DistributionUser }) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);

  // Wizard State
  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<FormWizardType | null>(null);
  
  // Data State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [trade, setTrade] = useState('');
  const [permitType, setPermitType] = useState<PermitType>('General');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [checklistItems, setChecklistItems] = useState<{ id: string, text: string }[]>([]);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [refinePrompt, setRefinePrompt] = useState('');

  const tradesQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'trades');
  }, [db]);
  const { data: trades } = useCollection<Trade>(tradesQuery);

  const handleAiGenerate = async (isRefining = false) => {
    const promptText = isRefining ? refinePrompt : aiPrompt;
    if (!promptText.trim() || !type) return;
    
    setIsGenerating(true);
    try {
      const currentStructure = isRefining ? JSON.stringify({
        title,
        description,
        topic,
        content,
        sections,
        items: checklistItems
      }) : undefined;

      const result = await generateFormStructure({ 
        type, 
        prompt: promptText,
        currentStructure
      });
      
      if (result) {
        if (result.title) setTitle(result.title);
        if (result.description) setDescription(result.description);
        if (result.topic) setTopic(result.topic);
        if (result.content) setContent(result.content);
        
        if (result.sections) {
            setSections(result.sections.map((s: any, i: number) => ({
                id: `sec-${Date.now()}-${i}`,
                title: s.title,
                fields: s.fields.map((f: any, fi: number) => ({
                    id: `f-${Date.now()}-${i}-${fi}`,
                    label: f.label,
                    type: f.type
                }))
            })));
        }

        if (result.items) {
            setChecklistItems(result.items.map((it: any, i: number) => ({ 
                id: `it-${Date.now()}-${i}`, 
                text: it.text 
            })));
        }
        
        toast({ 
          title: isRefining ? "Design Refined" : "Initial Draft Ready", 
          description: isRefining ? "Gemini has updated the structure." : "Review the generated preview." 
        });
        
        if (!isRefining) setStep('structure');
        setRefinePrompt('');
      }
    } catch (err) {
      toast({ title: "Generation Failed", description: "AI could not parse your request. Try being more specific.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveTemplate = () => {
    startTransition(async () => {
      try {
        let collName = '';
        let data: any = {
          title,
          trade,
          createdAt: new Date().toISOString(),
          createdByEmail: currentUser.email
        };

        if (type === 'permit') {
          collName = 'permit-templates';
          data = { ...data, type: permitType, description, sections };
        } else if (type === 'qc') {
          collName = 'quality-checklists';
          data = { ...data, isTemplate: true, items: checklistItems.map(i => ({ ...i, status: 'pending' })) };
        } else {
          collName = 'toolbox-talk-templates';
          data = { ...data, topic, content, verificationItems: checklistItems };
        }

        await addDoc(collection(db, collName), data);
        toast({ title: 'Success', description: 'Master template published.' });
        setStep('type');
        setType(null);
        setTitle('');
        setAiPrompt('');
      } catch (err) {
        toast({ title: 'Save Error', description: 'Failed to publish template.', variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Progress HUD */}
      <div className="flex items-center justify-between px-2 max-w-2xl mx-auto">
        {(['type', 'info', 'structure', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
              step === s ? "bg-primary text-white scale-110 shadow-lg" : "bg-muted text-muted-foreground"
            )}>{i + 1}</div>
            <span className={cn("text-[10px] font-black uppercase tracking-widest hidden sm:block", step === s ? "text-primary" : "text-muted-foreground")}>{s}</span>
            {i < 3 && <Separator className="w-8 sm:w-16" />}
          </div>
        ))}
      </div>

      <div className="grid gap-8">
        {step === 'type' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'permit' ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/30")} onClick={() => { setType('permit'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><FileCheck className="h-10 w-10" /></div>
                <CardTitle>Permit to Work</CardTitle>
                <CardDescription>High-risk authorization forms.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'qc' ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/30")} onClick={() => { setType('qc'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><ClipboardCheck className="h-10 w-10" /></div>
                <CardTitle>QC Checklist</CardTitle>
                <CardDescription>Quality assurance sign-offs.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'toolbox' ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/30")} onClick={() => { setType('toolbox'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><BookOpen className="h-10 w-10" /></div>
                <CardTitle>Toolbox Talk</CardTitle>
                <CardDescription>Safety briefings & education.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {step === 'info' && (
          <Card className="animate-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto w-full">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Design Studio</CardTitle>
              <CardDescription>Describe the activity, and Gemini will draft the sections and verification logic.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Describe your requirements</Label>
                <Textarea 
                  placeholder={`e.g. Create a permit for ${type === 'permit' ? 'hot work welding' : type === 'qc' ? 'second fix plumbing' : 'using ladders safely'} including standard checks and PPE...`}
                  className="min-h-[150px] text-base"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
                <Button className="w-full h-12 gap-2 font-bold text-lg shadow-lg shadow-primary/20" onClick={() => handleAiGenerate(false)} disabled={isGenerating || !aiPrompt.trim()}>
                  {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                  Generate Form Draft
                </Button>
              </div>
              <Separator />
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Or Manual Configuration</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Template Name..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Discipline</Label>
                    <Select value={trade} onValueChange={setTrade}>
                      <SelectTrigger><SelectValue placeholder="Select trade" /></SelectTrigger>
                      <SelectContent>{trades?.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t justify-between p-6">
              <Button variant="ghost" onClick={() => setStep('type')}>Back</Button>
              <Button onClick={() => setStep('structure')} disabled={!title}>Next Step <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </CardFooter>
          </Card>
        )}

        {step === 'structure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="space-y-1">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Eye className="h-5 w-5 text-primary" />
                        Live Form Preview
                    </h3>
                    <p className="text-xs text-muted-foreground">This is how the digital form will appear to site users.</p>
                </div>
                {type !== 'permit' && (
                    <Button variant="outline" size="sm" onClick={() => setChecklistItems([...checklistItems, { id: `ci-${Date.now()}`, text: '' }])} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Line
                    </Button>
                )}
              </div>

              <div className="space-y-6 bg-muted/5 p-6 rounded-xl border border-dashed min-h-[400px]">
                <div className="text-center mb-8 border-b pb-4">
                    <Badge variant="secondary" className="mb-2 uppercase text-[10px] font-black">{type}</Badge>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{title || 'Untitled Form'}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>

                {type === 'permit' ? (
                    <div className="space-y-8">
                        {sections.map((section, sIdx) => (
                            <div key={section.id} className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-black text-xs uppercase tracking-widest text-primary">{section.title}</h4>
                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setSections(sections.filter(s => s.id !== section.id))}><Trash2 className="h-3 w-3" /></Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {section.fields.map((field) => (
                                        <div key={field.id} className="p-3 bg-white border rounded-lg shadow-sm flex items-center justify-between gap-4">
                                            <span className="text-xs font-bold leading-tight">{field.label}</span>
                                            {field.type === 'checkbox' ? (
                                                <div className="h-5 w-5 rounded border-2 border-primary/20" />
                                            ) : field.type === 'yes-no-na' ? (
                                                <Badge variant="outline" className="text-[8px] font-black">Y / N / NA</Badge>
                                            ) : (
                                                <div className="h-6 w-24 bg-muted/30 rounded border border-dashed" />
                                            )}
                                        </div>
                                    ))}
                                    <Button variant="ghost" className="h-10 border-dashed border-2 text-[10px] font-bold text-muted-foreground" onClick={() => addField(section.id)}><Plus className="h-3 w-3 mr-1" /> Field</Button>
                                </div>
                            </div>
                        ))}
                        <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setSections([...sections, { id: `sec-${Date.now()}`, title: 'New Safety Section', fields: [] }])}>
                            <Plus className="h-4 w-4 mr-2" /> Add Section
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {checklistItems.map((item, idx) => (
                            <div key={item.id} className="flex gap-3 group bg-white p-3 rounded-lg border shadow-sm items-center">
                                <span className="text-[10px] font-black text-muted-foreground w-4">{idx + 1}.</span>
                                <Input value={item.text} onChange={e => {
                                    const newItems = [...checklistItems];
                                    newItems[idx].text = e.target.value;
                                    setChecklistItems(newItems);
                                }} className="border-none shadow-none h-8 text-sm p-0 focus-visible:ring-0" />
                                <Badge variant="outline" className="text-[8px] opacity-40">Compliance Item</Badge>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setChecklistItems(checklistItems.filter(i => i.id !== item.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <Card className="border-primary/20 bg-primary/5 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Modify with Gemini
                  </CardTitle>
                  <CardDescription className="text-[10px]">Iterative editing: Tell the AI what to change.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea 
                    placeholder="e.g. Add a section for Electrical Isolation..." 
                    className="min-h-[100px] text-xs bg-background"
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                  />
                  <Button 
                    className="w-full h-10 text-xs font-bold gap-2"
                    onClick={() => handleAiGenerate(true)}
                    disabled={isGenerating || !refinePrompt.trim()}
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Refine Form Structure
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Template Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Category</Label>
                    <Badge variant="secondary" className="h-5 text-[9px] uppercase px-2">{type}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 pt-4 px-4 pb-4">
                  <Button className="w-full h-11 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => setStep('review')}>
                    Final Review <ChevronRight className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

        {step === 'review' && (
          <Card className="animate-in zoom-in duration-300 max-w-2xl mx-auto w-full border-2 border-primary/20 shadow-2xl">
            <CardHeader className="bg-primary/5 text-center border-b p-8">
              <div className="bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary shadow-inner">
                <CheckCircle2 className="h-12 w-12" />
              </div>
              <CardTitle className="text-3xl font-black">Publish Template</CardTitle>
              <CardDescription className="text-base">This form will be available immediately for all site users.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Template Title</p>
                  <p className="text-xl font-bold border-l-4 border-primary pl-4">{title}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Module</p>
                  <Badge variant="outline" className="h-8 px-4 font-bold text-primary border-primary/30 bg-primary/5 uppercase tracking-widest">
                    {type === 'permit' ? 'Permits' : type === 'qc' ? 'Quality Control' : 'Toolbox Talks'}
                  </Badge>
                </div>
              </div>
              
              <div className="bg-muted/30 p-6 rounded-xl border border-dashed space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Structure Summary</p>
                <ul className="text-sm space-y-2">
                    {type === 'permit' ? (
                        <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> {sections.length} Safety Sections defined</li>
                    ) : (
                        <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> {checklistItems.length} Compliance Points defined</li>
                    )}
                    <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Automated PDF logic initialized</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="p-10 pt-0 gap-4">
              <Button variant="ghost" onClick={() => setStep('structure')} className="flex-1 h-14 font-bold">Back to Editor</Button>
              <Button onClick={handleSaveTemplate} disabled={isPending} className="flex-[2] h-14 font-black text-lg shadow-lg shadow-primary/20 gap-3">
                {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                Publish Master Template
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );

  function addField(sectionId: string) {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return {
                ...s,
                fields: [...s.fields, { id: `f-${Date.now()}`, label: 'New Requirement', type: 'checkbox' }]
            };
        }
        return s;
    }));
  }
}
