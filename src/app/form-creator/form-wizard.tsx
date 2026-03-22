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
  RefreshCw
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
        setTitle(result.title || title || '');
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
          title: isRefining ? "Refinement Applied" : "AI Draft Ready", 
          description: isRefining ? "Structure updated per your instruction." : "The template draft has been generated." 
        });
        
        if (!isRefining) setStep('structure');
        setRefinePrompt('');
      }
    } catch (err) {
      toast({ title: "Generation Failed", description: "The AI was unable to parse your request. Try more specific instructions.", variant: "destructive" });
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
        toast({ title: 'Success', description: 'Template published successfully.' });
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
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'permit' ? "border-primary bg-primary/5" : "hover:border-primary/30")} onClick={() => { setType('permit'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><FileCheck className="h-10 w-10" /></div>
                <CardTitle>Permit to Work</CardTitle>
                <CardDescription>High-risk task authorization forms.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'qc' ? "border-primary bg-primary/5" : "hover:border-primary/30")} onClick={() => { setType('qc'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><ClipboardCheck className="h-10 w-10" /></div>
                <CardTitle>QC Checklist</CardTitle>
                <CardDescription>Quality assurance & trade sign-offs.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'toolbox' ? "border-primary bg-primary/5" : "hover:border-primary/30")} onClick={() => { setType('toolbox'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><BookOpen className="h-10 w-10" /></div>
                <CardTitle>Toolbox Talk</CardTitle>
                <CardDescription>Safety briefings and education.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {step === 'info' && (
          <Card className="animate-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto w-full">
            <CardHeader className="bg-muted/30 border-b">
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Assistant</CardTitle>
              <CardDescription>Describe what this form should cover, and Gemini will draft the structure for you.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-3">
                <Label className="font-bold">Natural Language Prompt</Label>
                <Textarea 
                  placeholder={`e.g. Create a permit for ${type === 'permit' ? 'hot work welding' : type === 'qc' ? 'second fix plumbing' : 'using ladders safely'} including standard checks and PPE...`}
                  className="min-h-[120px] text-base"
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                />
                <Button className="w-full h-12 gap-2 font-bold" onClick={() => handleAiGenerate(false)} disabled={isGenerating || !aiPrompt.trim()}>
                  {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wand2 className="h-5 w-5" />}
                  Generate Structure with AI
                </Button>
              </div>
              <Separator />
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center">Or design manually</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter template name..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Trade / Discipline</Label>
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
              <Button onClick={() => setStep('structure')} disabled={!title}>Continue to Structure <ChevronRight className="ml-2 h-4 w-4" /></Button>
            </CardFooter>
          </Card>
        )}

        {step === 'structure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4 duration-300">
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Structure Builder</h3>
                <Button variant="outline" size="sm" onClick={() => setChecklistItems([...checklistItems, { id: `ci-${Date.now()}`, text: '' }])} className="gap-2">
                  <Plus className="h-4 w-4" /> Add Item
                </Button>
              </div>

              {type === 'permit' ? (
                <div className="space-y-8">
                  {sections.map((section, sIdx) => (
                    <Card key={section.id}>
                      <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between">
                        <Input 
                          value={section.title} 
                          onChange={e => setSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                          className="bg-transparent border-transparent font-bold h-8 text-xs uppercase"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSections(sections.filter(s => s.id !== section.id))}><Trash2 className="h-4 w-4" /></Button>
                      </CardHeader>
                      <CardContent className="p-4 space-y-3">
                        {section.fields.map((field, fIdx) => (
                          <div key={field.id} className="flex gap-2 items-center bg-muted/5 p-2 rounded border border-dashed">
                            <Input value={field.label} onChange={e => {
                              const newSections = [...sections];
                              newSections[sIdx].fields[fIdx].label = e.target.value;
                              setSections(newSections);
                            }} className="flex-1 h-8 text-xs" />
                            <Select value={field.type as any} onValueChange={(v: any) => {
                              const newSections = [...sections];
                              newSections[sIdx].fields[fIdx].type = v;
                              setSections(newSections);
                            }}>
                              <SelectTrigger className="w-32 h-8 text-[10px] uppercase font-bold"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="checkbox">Checkbox</SelectItem>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="textarea">Text Area</SelectItem>
                                <SelectItem value="yes-no-na">Yes/No/NA</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        <Button variant="ghost" size="sm" className="text-[10px] h-7 gap-1 text-primary" onClick={() => addField(section.id)}>
                            <Plus className="h-3 w-3" /> Add Field
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full border-dashed" onClick={() => setSections([...sections, { id: `sec-${Date.now()}`, title: 'New Section', fields: [] }])}>
                      <Plus className="h-4 w-4 mr-2" /> Add Section
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklistItems.map((item, idx) => (
                    <div key={item.id} className="flex gap-2 group">
                      <div className="flex-1 flex gap-2 items-center bg-background p-2 rounded border shadow-sm">
                        <span className="text-[10px] font-black text-muted-foreground w-4">{idx + 1}.</span>
                        <Input value={item.text} onChange={e => {
                          const newItems = [...checklistItems];
                          newItems[idx].text = e.target.value;
                          setChecklistItems(newItems);
                        }} className="border-none shadow-none h-8 text-sm" />
                      </div>
                      <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive opacity-0 group-hover:opacity-100" onClick={() => setChecklistItems(checklistItems.filter(i => i.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Refine
                  </CardTitle>
                  <CardDescription className="text-[10px]">Describe changes to the current structure.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea 
                    placeholder="e.g. Add a section for Electrical Isolation..." 
                    className="min-h-[80px] text-xs bg-background"
                    value={refinePrompt}
                    onChange={e => setRefinePrompt(e.target.value)}
                  />
                  <Button 
                    variant="secondary" 
                    className="w-full h-9 text-xs font-bold gap-2"
                    onClick={() => handleAiGenerate(true)}
                    disabled={isGenerating || !refinePrompt.trim()}
                  >
                    {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Update with AI
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Summary</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Title</Label>
                    <p className="font-bold text-sm">{title || 'Untitled'}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Category</Label>
                    <Badge variant="secondary" className="h-5 text-[9px] uppercase">{type}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 pt-4">
                  <Button className="w-full h-11 font-bold gap-2" onClick={() => setStep('review')}>
                    <CheckCircle2 className="h-4 w-4" /> Final Review
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        )}

        {step === 'review' && (
          <Card className="animate-in zoom-in duration-300 max-w-2xl mx-auto w-full">
            <CardHeader className="bg-primary/5 text-center border-b">
              <div className="bg-primary/10 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <CardTitle>Ready to Publish?</CardTitle>
              <CardDescription>Confirm your template structure before saving.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Title</p>
                  <p className="text-lg font-bold">{title}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Trade</p>
                  <Badge variant="outline" className="h-6 font-bold text-primary">{trade || 'General'}</Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0 gap-4">
              <Button variant="ghost" onClick={() => setStep('structure')} className="flex-1 h-12 font-bold">Refine</Button>
              <Button onClick={handleSaveTemplate} disabled={isPending} className="flex-[2] h-12 font-black text-lg shadow-lg shadow-primary/20 gap-2">
                {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Publish Template
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
                fields: [...s.fields, { id: `f-${Date.now()}`, label: 'New Field', type: 'checkbox' }]
            };
        }
        return s;
    }));
  }
}
