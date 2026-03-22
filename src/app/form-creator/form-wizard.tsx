'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { 
  FileCheck, 
  ClipboardCheck, 
  BookOpen, 
  ChevronRight, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  Layout, 
  Save,
  Eye,
  Maximize2,
  Minimize2,
  X,
  Calendar as CalendarIcon,
  Type,
  Image as ImageIcon,
  CheckSquare,
  AlignLeft,
  ListTodo,
  GripVertical,
  Fingerprint,
  Asterisk,
  HelpCircle
} from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { collection, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import type { 
  FormWizardType, 
  TemplateSection, 
  TemplateFieldType,
  PermitType, 
  DistributionUser,
  TemplateField,
  ChecklistItem,
  QCSection
} from '@/lib/types';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRouter } from 'next/navigation';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

type Step = 'type' | 'info' | 'structure' | 'review';

export function FormWizard({ 
    currentUser, 
    initialTemplate, 
    initialType 
}: { 
    currentUser: DistributionUser, 
    initialTemplate?: any, 
    initialType?: FormWizardType | null 
}) {
  const { toast } = useToast();
  const db = useFirestore();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard State - Skip 'type' if initialType or template is provided
  const [step, setStep] = useState<Step>((initialTemplate || initialType) ? 'info' : 'type');
  const [type, setType] = useState<FormWizardType | null>(initialType || null);
  
  // Data State
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [permitType, setPermitType] = useState<PermitType>('General');
  const [sections, setSections] = useState<TemplateSection[]>([]);
  const [qcSections, setQCSections] = useState<QCSection[]>([]);
  const [checklistItems, setChecklistItems] = useState<{ id: string, text: string }[]>([]);
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');

  // Drag and Drop State
  const [draggedFieldInfo, setDraggedFieldId] = useState<{ sectionId: string, fieldId: string } | null>(null);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);

  // Sync initial data if editing
  useEffect(() => {
    if (initialTemplate) {
        setTitle(initialTemplate.title || '');
        setReference(initialTemplate.reference || '');
        setDescription(initialTemplate.description || '');
        
        if (initialType === 'permit') {
            setSections(initialTemplate.sections || []);
            setPermitType(initialTemplate.type || 'General');
        } else if (initialType === 'qc') {
            // Support legacy conversion
            if (initialTemplate.sections) {
                setQCSections(initialTemplate.sections);
            } else {
                setQCSections([{ 
                    id: 'default-sec', 
                    title: 'Verification Points', 
                    items: initialTemplate.items || [] 
                }]);
            }
        } else if (initialType === 'toolbox') {
            setTopic(initialTemplate.topic || '');
            setContent(initialTemplate.content || '');
            setChecklistItems(initialTemplate.verificationItems || []);
        }
    } else {
        generateNextRef();
    }
  }, [initialTemplate, initialType]);

  const generateNextRef = async () => {
    if (initialTemplate || !db) return;
    try {
        const collectionsList = ['permit-templates', 'quality-checklists', 'toolbox-talk-templates'];
        let maxNum = 0;
        for (const colName of collectionsList) {
            const snap = await getDocs(collection(db, colName));
            snap.docs.forEach(d => {
                const ref = d.data().reference;
                if (ref && ref.startsWith('TMP-')) {
                    const num = parseInt(ref.split('-')[1]);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
        }
        const nextNum = (maxNum + 1).toString().padStart(4, '0');
        setReference(`TMP-${nextNum}`);
    } catch (e) {}
  };

  const handleSaveTemplate = () => {
    startTransition(async () => {
      try {
        let collName = '';
        const currentRevision = initialTemplate?.revision || 0;
        const nextRevision = currentRevision + 1;

        let data: any = {
          title,
          reference,
          revision: nextRevision,
          description,
          updatedAt: new Date().toISOString(),
        };

        if (type === 'permit') {
          collName = 'permit-templates';
          data = { ...data, type: permitType, sections };
        } else if (type === 'qc') {
          collName = 'quality-checklists';
          data = { 
            ...data, 
            isTemplate: true, 
            sections: qcSections,
            items: [] // Keep legacy flat array empty for new sectional checklists
          };
        } else {
          collName = 'toolbox-talk-templates';
          data = { ...data, topic, content, verificationItems: checklistItems };
        }

        if (initialTemplate?.id) {
            await updateDoc(doc(db, collName, initialTemplate.id), data);
            toast({ title: 'Template Revised', description: `Saved as Revision ${nextRevision}.` });
        } else {
            data.createdAt = new Date().toISOString();
            data.createdByEmail = currentUser.email;
            await addDoc(collection(db, collName), data);
            toast({ title: 'Success', description: `Master template published: ${reference}-Rev01.` });
        }

        router.push('/form-creator');
      } catch (err) {
        toast({ title: 'Save Error', description: 'Failed to publish template.', variant: 'destructive' });
      }
    });
  };

  const addField = (sectionId: string) => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return {
                ...s,
                fields: [...s.fields, { id: `f-${Date.now()}`, label: 'New Point', type: 'checkbox', width: 'full', required: false }]
            };
        }
        return s;
    }));
  };

  const addQCItem = (sectionId: string) => {
    setQCSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return {
                ...s,
                items: [...s.items, { id: `i-${Date.now()}`, text: 'New verification question...', status: 'pending' }]
            };
        }
        return s;
    }));
  };

  const updateFieldWidth = (sectionId: string, fieldId: string, width: 'half' | 'full') => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, width } : f) };
        }
        return s;
    }));
  };

  const updateFieldType = (sectionId: string, fieldId: string, fieldType: TemplateFieldType) => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, type: fieldType } : f) };
        }
        return s;
    }));
  };

  const updateFieldLabel = (sectionId: string, fieldId: string, label: string) => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, label } : f) };
        }
        return s;
    }));
  };

  const toggleFieldRequired = (sectionId: string, fieldId: string) => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.map(f => f.id === fieldId ? { ...f, required: !f.required } : f) };
        }
        return s;
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setSections(prev => prev.map(s => {
        if (s.id === sectionId) {
            return { ...s, fields: s.fields.filter(f => f.id !== fieldId) };
        }
        return s;
    }));
  };

  const handleFieldDragStart = (sectionId: string, fieldId: string) => {
    setDraggedFieldId({ sectionId, fieldId });
  };

  const handleFieldDrop = (targetSectionId: string, targetFieldId: string) => {
    if (!draggedFieldInfo || draggedFieldInfo.fieldId === targetFieldId) return;

    setSections(prev => prev.map(section => {
      if (section.id === targetSectionId) {
        const newFields = [...section.fields];
        const draggedIdx = newFields.findIndex(f => f.id === draggedFieldInfo.fieldId);
        const targetIdx = newFields.findIndex(f => f.id === targetFieldId);

        if (draggedIdx > -1 && targetIdx > -1) {
          const [draggedField] = newFields.splice(draggedIdx, 1);
          newFields.splice(targetIdx, 0, draggedField);
          return { ...section, fields: newFields };
        }
      }
      return section;
    }));
    setDraggedFieldId(null);
  };

  const handleSectionDragStart = (id: string) => setDraggedSectionId(id);
  const handleSectionDrop = (targetId: string) => {
    if (!draggedSectionId || draggedSectionId === targetId) return;
    if (type === 'permit') {
        const newSections = [...sections];
        const draggedIdx = newSections.findIndex(s => s.id === draggedSectionId);
        const targetIdx = newSections.findIndex(s => s.id === targetId);
        if (draggedIdx > -1 && targetIdx > -1) {
            const [draggedSection] = newSections.splice(draggedIdx, 1);
            newSections.splice(targetIdx, 0, draggedSection);
            setSections(newSections);
        }
    } else if (type === 'qc') {
        const newSections = [...qcSections];
        const draggedIdx = newSections.findIndex(s => s.id === draggedSectionId);
        const targetIdx = newSections.findIndex(s => s.id === targetId);
        if (draggedIdx > -1 && targetIdx > -1) {
            const [draggedSection] = newSections.splice(draggedIdx, 1);
            newSections.splice(targetIdx, 0, draggedSection);
            setQCSections(newSections);
        }
    }
    setDraggedSectionId(null);
  };

  const getFieldTypeIcon = (fieldType: TemplateFieldType) => {
    switch (fieldType) {
        case 'checkbox': return <CheckSquare className="h-3 w-3" />;
        case 'date': return <CalendarIcon className="h-3 w-3" />;
        case 'text': return <Type className="h-3 w-3" />;
        case 'textarea': return <AlignLeft className="h-3 w-3" />;
        case 'photo': return <ImageIcon className="h-3 w-3" />;
        case 'yes-no-na': return <ListTodo className="h-3 w-3" />;
        default: return <CheckSquare className="h-3 w-3" />;
    }
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
            {i < 3 && <Separator className="w-4 sm:w-16" />}
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
                <CardDescription>High-risk activity documentation with dynamic sections and data types.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'qc' ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/30")} onClick={() => { setType('qc'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><ClipboardCheck className="h-10 w-10" /></div>
                <CardTitle>QC Checklist</CardTitle>
                <CardDescription>Standardised quality assurance inspection forms with sectional verification.</CardDescription>
              </CardHeader>
            </Card>
            <Card className={cn("cursor-pointer transition-all hover:scale-[1.02] border-2", type === 'toolbox' ? "border-primary bg-primary/5 shadow-md" : "hover:border-primary/30")} onClick={() => { setType('toolbox'); setStep('info'); }}>
              <CardHeader className="text-center">
                <div className="bg-primary/10 p-4 rounded-2xl w-fit mx-auto mb-4 text-primary"><BookOpen className="h-10 w-10" /></div>
                <CardTitle>Toolbox Talk</CardTitle>
                <CardDescription>Educational safety briefings with verification points.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        )}

        {step === 'info' && (
          <Card className="animate-in slide-in-from-right-4 duration-300 max-w-2xl mx-auto w-full">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="flex items-center gap-2">Template Identity</CardTitle>
              <CardDescription>Define the reference and basic properties of your template.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                            <Fingerprint className="h-3.5 w-3.5 text-primary" />
                            Unique Reference
                        </Label>
                        <Input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} placeholder="e.g. TMP-0001" disabled={!!initialTemplate} className="font-mono" />
                        <p className="text-[10px] text-muted-foreground">Revisions will be tracked as a suffix.</p>
                    </div>
                    <div className="space-y-2">
                        <Label>Template Title</Label>
                        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Roof Work Permit" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Short Description / Scope</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief purpose or instructions..." className="min-h-[100px]" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 border-t justify-between p-6">
              <Button variant="ghost" onClick={() => setStep('type')} disabled={!!initialTemplate || !!initialType}>Back</Button>
              <Button onClick={() => setStep('structure')} disabled={!title || !reference}>
                Next: Build Structure <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
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
                    <p className="text-xs text-muted-foreground">Adjust layout widths and data types for each capture point.</p>
                </div>
                {type === 'permit' ? (
                    <Button variant="outline" size="sm" onClick={() => setSections([...sections, { id: `sec-${Date.now()}`, title: 'New Section', fields: [] }])} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Section
                    </Button>
                ) : type === 'qc' ? (
                    <Button variant="outline" size="sm" onClick={() => setQCSections([...qcSections, { id: `sec-qc-${Date.now()}`, title: 'New Category', items: [] }])} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Section
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => setChecklistItems([...checklistItems, { id: `ci-${Date.now()}`, text: '' }])} className="gap-2">
                        <Plus className="h-4 w-4" /> Add Item
                    </Button>
                )}
              </div>

              <div className="space-y-6 bg-muted/5 p-4 md:p-6 rounded-xl border border-dashed min-h-[400px]">
                <div className="text-center mb-8 border-b pb-4">
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <Badge variant="secondary" className="uppercase text-[10px] font-black tracking-widest">{type}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{reference}-Rev{(initialTemplate?.revision || 0) + 1}</Badge>
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{title || 'Untitled Template'}</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
                </div>

                {type === 'permit' ? (
                    <div className="space-y-8">
                        <Accordion type="multiple" defaultValue={sections.map(s => s.id)} className="space-y-4">
                            {sections.map((section) => (
                                <AccordionItem 
                                    key={section.id} 
                                    value={section.id}
                                    draggable
                                    onDragStart={() => handleSectionDragStart(section.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleSectionDrop(section.id)}
                                    className={cn("border bg-white rounded-xl overflow-hidden shadow-sm transition-all", draggedSectionId === section.id && "opacity-20")}
                                >
                                    <div className="flex items-center justify-between bg-muted/20 p-2 group/sec">
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                                            <Input 
                                                value={section.title} 
                                                onChange={(e) => setSections(sections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))} 
                                                className="bg-transparent border-transparent hover:border-border font-bold text-xs uppercase tracking-widest text-primary h-8" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button type="button" variant="ghost" size="sm" onClick={() => addField(section.id)} className="h-8 text-[10px] uppercase font-bold text-primary">
                                                <Plus className="h-3 w-3 mr-1" /> Add Field
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setSections(sections.filter(s => s.id !== section.id))}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <AccordionTrigger className="flex-none w-8 h-8 p-0 flex items-center justify-center border-none shadow-none hover:bg-transparent" />
                                        </div>
                                    </div>
                                    <AccordionContent className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {section.fields.map((field) => (
                                                <div 
                                                    key={field.id} 
                                                    draggable
                                                    onDragStart={() => handleFieldDragStart(section.id, field.id)}
                                                    onDragOver={(e) => e.preventDefault()}
                                                    onDrop={() => handleFieldDrop(section.id, field.id)}
                                                    className={cn(
                                                        "p-3 bg-white border rounded-lg shadow-sm space-y-3 transition-all relative group",
                                                        field.width === 'half' ? "col-span-1" : "col-span-1 md:col-span-2",
                                                        draggedFieldInfo?.fieldId === field.id && "opacity-40"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded text-muted-foreground">
                                                                <GripVertical className="h-3.5 w-3.5" />
                                                            </div>
                                                            <div className="flex-1 space-y-1">
                                                                <div className="flex items-center gap-1">
                                                                    <Input 
                                                                        value={field.label} 
                                                                        onChange={(e) => updateFieldLabel(section.id, field.id, e.target.value)}
                                                                        className="h-7 text-xs font-bold leading-tight bg-transparent border-transparent p-0 focus-visible:ring-0 placeholder:text-muted-foreground/30" 
                                                                        placeholder="Label..."
                                                                    />
                                                                    {field.required && <Asterisk className="h-2.5 w-2.5 text-red-500" />}
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Select 
                                                                        value={field.type} 
                                                                        onValueChange={(v: TemplateFieldType) => updateFieldType(section.id, field.id, v)}
                                                                    >
                                                                        <SelectTrigger className="h-5 text-[8px] w-24 bg-muted/30 border-none px-1.5 font-black uppercase tracking-tighter">
                                                                            <div className="flex items-center gap-1.5">
                                                                                {getFieldTypeIcon(field.type)}
                                                                                <SelectValue />
                                                                            </div>
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="checkbox" className="text-[10px]">Checkbox</SelectItem>
                                                                            <SelectItem value="date" className="text-[10px]">Date Field</SelectItem>
                                                                            <SelectItem value="text" className="text-[10px]">Short Text</SelectItem>
                                                                            <SelectItem value="textarea" className="text-[10px]">Long Text</SelectItem>
                                                                            <SelectItem value="photo" className="text-[10px]">Photo Upload</SelectItem>
                                                                            <SelectItem value="yes-no-na" className="text-[10px]">Yes/No/NA</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className={cn("h-6 w-6", field.required ? "text-red-500 bg-red-50" : "text-muted-foreground")}
                                                                            onClick={() => toggleFieldRequired(section.id, field.id)}
                                                                        >
                                                                            <Asterisk className="h-3 w-3" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>{field.required ? 'Make Optional' : 'Make Mandatory'}</p></TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            className={cn("h-6 w-6", field.width === 'half' ? "text-primary bg-primary/10" : "text-muted-foreground")}
                                                                            onClick={() => updateFieldWidth(section.id, field.id, field.width === 'half' ? 'full' : 'half')}
                                                                        >
                                                                            {field.width === 'half' ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent><p>{field.width === 'half' ? 'Set to Full Width' : 'Set to Half Width'}</p></TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeField(section.id, field.id)}><X className="h-3 w-3" /></Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                ) : type === 'qc' ? (
                    <div className="space-y-8">
                        <Accordion type="multiple" defaultValue={qcSections.map(s => s.id)} className="space-y-4">
                            {qcSections.map((section) => (
                                <AccordionItem 
                                    key={section.id} 
                                    value={section.id}
                                    draggable
                                    onDragStart={() => handleSectionDragStart(section.id)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={() => handleSectionDrop(section.id)}
                                    className={cn("border bg-white rounded-xl overflow-hidden shadow-sm transition-all", draggedSectionId === section.id && "opacity-20")}
                                >
                                    <div className="flex items-center justify-between bg-muted/20 p-2">
                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                            <div className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground"><GripVertical className="h-4 w-4" /></div>
                                            <Input 
                                                value={section.title} 
                                                onChange={(e) => setQCSections(qcSections.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))} 
                                                className="bg-transparent border-transparent hover:border-border font-bold text-xs uppercase tracking-widest text-primary h-8" 
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button type="button" variant="ghost" size="sm" onClick={() => addQCItem(section.id)} className="h-8 text-[10px] uppercase font-bold text-primary">
                                                <Plus className="h-3 w-3 mr-1" /> Add Question
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setQCSections(qcSections.filter(s => s.id !== section.id))}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                            <AccordionTrigger className="flex-none w-8 h-8 p-0 flex items-center justify-center border-none shadow-none hover:bg-transparent" />
                                        </div>
                                    </div>
                                    <AccordionContent className="p-4 space-y-3">
                                        {section.items.map((item, qIdx) => (
                                            <div key={item.id} className="flex gap-3 bg-white p-3 rounded-lg border shadow-sm items-center group/q">
                                                <span className="text-[10px] font-black text-muted-foreground w-4">{qIdx + 1}.</span>
                                                <Input 
                                                    value={item.text} 
                                                    onChange={e => {
                                                        const newSections = [...qcSections];
                                                        const sIdx = newSections.findIndex(s => s.id === section.id);
                                                        newSections[sIdx].items[qIdx].text = e.target.value;
                                                        setQCSections(newSections);
                                                    }} 
                                                    className="border-none shadow-none h-8 text-sm p-0 focus-visible:ring-0 font-medium" 
                                                    placeholder="Enter verification question..." 
                                                />
                                                <Badge variant="outline" className="hidden sm:flex text-[8px] uppercase font-bold text-muted-foreground gap-1">
                                                    <ListTodo className="h-2 w-2" /> Yes/No/NA + Photo
                                                </Badge>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive opacity-0 group-hover/q:opacity-100 transition-opacity" onClick={() => {
                                                    const newSections = [...qcSections];
                                                    const sIdx = newSections.findIndex(s => s.id === section.id);
                                                    newSections[sIdx].items = newSections[sIdx].items.filter(i => i.id !== item.id);
                                                    setQCSections(newSections);
                                                }}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                        {section.items.length === 0 && (
                                            <div className="py-8 text-center text-[10px] text-muted-foreground italic border-2 border-dashed rounded-lg">
                                                No questions added to this section.
                                            </div>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {checklistItems.map((item, idx) => (
                            <div key={item.id} className="flex gap-3 bg-white p-3 rounded-lg border shadow-sm items-center">
                                <span className="text-[10px] font-black text-muted-foreground w-4">{idx + 1}.</span>
                                <Input value={item.text} onChange={e => {
                                    const newItems = [...checklistItems];
                                    newItems[idx].text = e.target.value;
                                    setChecklistItems(newItems);
                                }} className="border-none shadow-none h-8 text-sm p-0 focus-visible:ring-0" placeholder="Verification criteria..." />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setChecklistItems(checklistItems.filter(i => i.id !== item.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Metadata</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-xs font-bold" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground">Category</Label>
                    <Badge variant="secondary" className="h-5 text-[9px] uppercase px-2 w-full justify-center">{type}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="bg-muted/10 pt-4 px-4 pb-4">
                  <Button className="w-full h-11 font-black uppercase text-[10px] tracking-widest gap-2" onClick={() => setStep('review')}>
                    Review & Save <ChevronRight className="h-3 w-3" />
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
              <CardTitle className="text-3xl font-black">{initialTemplate ? 'Publish Revision' : 'Publish Master Template'}</CardTitle>
              <CardDescription className="text-base">Revision {(initialTemplate?.revision || 0) + 1} will be active immediately.</CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-10">
              <div className="grid grid-cols-2 gap-12">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Template Reference</p>
                  <p className="text-xl font-bold border-l-4 border-primary pl-4">{reference}-Rev{(initialTemplate?.revision || 0) + 1}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">System Module</p>
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
                    ) : type === 'qc' ? (
                        <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> {qcSections.length} Categorised Verification Sections</li>
                    ) : (
                        <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> {checklistItems.length} Compliance Points defined</li>
                    )}
                    <li className="flex items-center gap-2"><div className="h-1.5 w-1.5 rounded-full bg-primary" /> Real-time mobile logic updated</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="p-10 pt-0 flex flex-col sm:flex-row gap-4">
              <Button variant="ghost" onClick={() => setStep('structure')} className="w-full sm:flex-1 h-14 font-bold">Back to Editor</Button>
              <Button onClick={handleSaveTemplate} disabled={isPending} className="w-full sm:flex-[2] h-14 font-black text-lg shadow-lg shadow-primary/20 gap-3">
                {isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                {initialTemplate ? 'Confirm Revision' : 'Publish Master Template'}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
