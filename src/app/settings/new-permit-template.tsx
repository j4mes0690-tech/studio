'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Save, ShieldCheck, Sparkles, BrainCircuit, Upload, Trash2, Layout } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { replicatePermitTemplate } from '@/ai/flows/replicate-permit-template';
import type { TemplateSection, PermitType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const NewPermitTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().min(10, 'Description is required.'),
});

type NewPermitTemplateFormValues = z.infer<typeof NewPermitTemplateSchema>;

export function NewPermitTemplate() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isExtracting, setIsExtracting] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Content State
  const [sections, setSections] = useState<TemplateSection[]>([]);

  const form = useForm<NewPermitTemplateFormValues>({
    resolver: zodResolver(NewPermitTemplateSchema),
    defaultValues: {
      title: '',
      type: 'General',
      description: '',
    },
  });

  const handleSmartReplication = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    toast({ 
      title: "Replicator Waking Up", 
      description: "AI is mapping the structure of your document..." 
    });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        try {
          const result = await replicatePermitTemplate({ fileDataUri: dataUri });
          
          if (result) {
            form.setValue('title', result.title);
            form.setValue('type', result.type);
            form.setValue('description', result.description);
            setSections(result.sections);
            
            toast({ 
              title: "Replication Complete", 
              description: `Generated ${result.sections.length} custom sections based on your document.` 
            });
          }
        } catch (err) {
          console.error("Extraction error:", err);
          toast({ 
            title: "Wizard Failed", 
            description: "Could not replicate this document structure.", 
            variant: "destructive" 
          });
        } finally {
          setIsExtracting(false);
          if (templateInputRef.current) templateInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setIsExtracting(false);
    }
  };

  const onSubmit = (values: NewPermitTemplateFormValues) => {
    if (sections.length === 0) {
        toast({ title: "Template Empty", description: "Use Smart Replicator or add sections manually.", variant: "destructive" });
        return;
    }

    startTransition(async () => {
      const templateData = {
        ...values,
        sections,
        createdAt: new Date().toISOString(),
      };

      const colRef = collection(db, 'permit-templates');
      addDoc(colRef, templateData)
        .then(() => {
          toast({ title: 'Success', description: 'Custom permit template created.' });
          setOpen(false);
        })
        .catch((error) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: templateData,
          }));
        });
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
      setSections([]);
      setIsExtracting(false);
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Permit Template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-lg shadow-lg shadow-primary/20">
                <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl">Template Replicator Wizard</DialogTitle>
                <DialogDescription>
                    Create specialized permit forms by replicating existing document structures.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* AI Action Area */}
            <div className="bg-gradient-to-br from-primary/10 to-background border-2 border-primary/20 rounded-xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                    <Sparkles className="h-24 w-24 text-primary" />
                </div>
                
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-bold text-primary flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            AI Smart Replication
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                            Upload your current PDF permit or a photo of your paper forms. The AI will generate a visually and structurally similar digital version.
                        </p>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={templateInputRef} 
                        className="hidden" 
                        accept="image/*,.pdf" 
                        onChange={handleSmartReplication} 
                    />
                    
                    <Button 
                        type="button" 
                        className="w-full sm:w-auto h-11 px-6 font-bold gap-2"
                        onClick={() => templateInputRef.current?.click()}
                        disabled={isExtracting}
                    >
                        {isExtracting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Analyzing Document Structure...
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Replicate Existing Form
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <Form {...form}>
                <form className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Digital Template Name</FormLabel>
                                <FormControl><Input placeholder="e.g., Warehouse Welding Permit" className="h-11" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Permit Classification</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl><SelectTrigger className="h-11"><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="Hot Work">Hot Work</SelectItem>
                                        <SelectItem value="Confined Space">Confined Space</SelectItem>
                                        <SelectItem value="Excavation">Excavation</SelectItem>
                                        <SelectItem value="Lifting">Lifting Ops</SelectItem>
                                        <SelectItem value="General">General Works</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Scope Summary</FormLabel>
                            <FormControl><Input placeholder="Usage scope for this template..." {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Replicated Form Preview */}
                    {sections.length > 0 && (
                        <div className="space-y-6 pt-4">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-bold flex items-center gap-2 text-primary">
                                    <Layout className="h-4 w-4" />
                                    Replicated Form Logic
                                </h4>
                                <Badge variant="outline">{sections.length} Sections Found</Badge>
                            </div>
                            
                            <div className="space-y-8">
                                {sections.map((section, sIdx) => (
                                    <div key={sIdx} className="space-y-4">
                                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded">
                                            <span className="font-bold text-xs uppercase tracking-wider">{section.title}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setSections(sections.filter((_, i) => i !== sIdx))}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-4 border-l-2 border-primary/10">
                                            {section.fields.map((field, fIdx) => (
                                                <div key={fIdx} className="flex items-center gap-3 p-2 bg-muted/5 rounded border border-dashed">
                                                    <div className={cn(
                                                        "h-2 w-2 rounded-full",
                                                        field.type === 'checkbox' ? 'bg-green-500' : 'bg-primary'
                                                    )} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold truncate">{field.label}</p>
                                                        <p className="text-[8px] text-muted-foreground uppercase">{field.type}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/10">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
            <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isPending || isExtracting || sections.length === 0} 
                className="h-12 px-8 font-bold min-w-[200px]"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Template...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Digital Template
                    </>
                )}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
