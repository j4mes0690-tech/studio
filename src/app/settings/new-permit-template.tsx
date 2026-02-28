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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Loader2, Save, ShieldCheck, Sparkles, BrainCircuit, Upload, FileText } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Separator } from '@/components/ui/separator';
import { extractPermitDetails } from '@/ai/flows/extract-permit-details';

const NewPermitTemplateSchema = z.object({
  title: z.string().min(1, 'Title is required.'),
  type: z.enum(['Hot Work', 'Confined Space', 'Excavation', 'Lifting', 'General']),
  description: z.string().min(10, 'Standard description must be at least 10 characters.'),
  hazards: z.string().min(1, 'Identify standard hazards.'),
  precautions: z.string().min(1, 'Identify standard precautions.'),
});

type NewPermitTemplateFormValues = z.infer<typeof NewPermitTemplateSchema>;

export function NewPermitTemplate() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const db = useFirestore();
  const [isPending, startTransition] = useTransition();
  const [isExtracting, setIsExtracting] = useState(false);
  const templateInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const form = useForm<NewPermitTemplateFormValues>({
    resolver: zodResolver(NewPermitTemplateSchema),
    defaultValues: {
      title: '',
      type: 'General',
      description: '',
      hazards: '',
      precautions: '',
    },
  });

  const handleSmartFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    toast({ 
      title: "Smart Wizard Started", 
      description: "AI is analyzing your document to generate a template logic..." 
    });

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUri = event.target?.result as string;
        try {
          const result = await extractPermitDetails({ fileDataUri: dataUri });
          
          if (result) {
            if (result.type) form.setValue('type', result.type);
            form.setValue('description', result.description);
            form.setValue('hazards', result.hazards);
            form.setValue('precautions', result.precautions);
            
            // Suggest a title based on extraction
            if (!form.getValues('title')) {
                form.setValue('title', `Standard ${result.type || 'General'} Permit`);
            }
            
            toast({ 
              title: "Template Generated", 
              description: "Standard work details and controls have been successfully replicated." 
            });
          }
        } catch (err) {
          console.error("Wizard extraction error:", err);
          toast({ 
            title: "Wizard Failed", 
            description: "Could not process this document. Please ensure it's a clear PDF or image.", 
            variant: "destructive" 
          });
        } finally {
          setIsExtracting(false);
          if (templateInputRef.current) templateInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setIsExtracting(false);
    }
  };

  const onSubmit = (values: NewPermitTemplateFormValues) => {
    startTransition(async () => {
      const templateData = {
        ...values,
        createdAt: new Date().toISOString(),
      };

      const colRef = collection(db, 'permit-templates');
      addDoc(colRef, templateData)
        .then(() => {
          toast({ title: 'Success', description: 'Master permit template created.' });
          setOpen(false);
        })
        .catch((error) => {
          const permissionError = new FirestorePermissionError({
            path: colRef.path,
            operation: 'create',
            requestResourceData: templateData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-2xl border-primary/20">
        <DialogHeader className="p-6 pb-4 bg-primary/5 border-b">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2.5 rounded-lg shadow-lg shadow-primary/20">
                <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
                <DialogTitle className="text-xl">Permit Template Wizard</DialogTitle>
                <DialogDescription>
                    Define standard safety controls manually or use AI to replicate an existing document.
                </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-6">
            {/* Smart Wizard Hero Section */}
            <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-2 border-primary/20 rounded-xl p-6 mb-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="h-24 w-24 text-primary" />
                </div>
                
                <div className="relative z-10 space-y-4">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-bold text-primary flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            AI Smart Replicator
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                            Upload your existing paper permit template (PDF or Photo). SiteCommand will analyze the content, identify hazards, and replicate the form fields automatically.
                        </p>
                    </div>
                    
                    <input 
                        type="file" 
                        ref={templateInputRef} 
                        className="hidden" 
                        accept="image/*,.pdf" 
                        onChange={handleSmartFill} 
                    />
                    
                    <Button 
                        type="button" 
                        className="w-full sm:w-auto h-11 px-6 shadow-md shadow-primary/10 font-bold gap-2"
                        onClick={() => templateInputRef.current?.click()}
                        disabled={isExtracting}
                    >
                        {isExtracting ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Replicating Logic...
                            </>
                        ) : (
                            <>
                                <Upload className="h-4 w-4" />
                                Run Smart Wizard
                            </>
                        )}
                    </Button>
                </div>
            </div>

            <div className="relative mb-8">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground font-bold tracking-widest">Template Configuration</span>
                </div>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Internal Title</FormLabel>
                                <FormControl><Input placeholder="e.g., Roof-level welding" className="h-11 shadow-sm" {...field} /></FormControl>
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
                                    <FormControl><SelectTrigger className="h-11 shadow-sm"><SelectValue /></SelectTrigger></FormControl>
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
                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Standard Task Description</FormLabel>
                        <FormControl>
                            <Textarea 
                                placeholder="What standard work does this template cover?" 
                                className="min-h-[100px] resize-none shadow-sm" 
                                {...field} 
                            />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                            control={form.control}
                            name="hazards"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldCheck className="h-4 w-4 text-destructive" />
                                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Key Safety Hazards</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Standard hazards identified..." 
                                            className="min-h-[140px] bg-destructive/5 border-destructive/10 resize-none shadow-inner" 
                                            {...field} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="precautions"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center gap-2 mb-2">
                                        <ShieldCheck className="h-4 w-4 text-primary" />
                                        <FormLabel className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Required Controls</FormLabel>
                                    </div>
                                    <FormControl>
                                        <Textarea 
                                            placeholder="Standard safety precautions..." 
                                            className="min-h-[140px] bg-primary/5 border-primary/10 resize-none shadow-inner" 
                                            {...field} 
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </form>
            </Form>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/10">
            <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setOpen(false)}
                disabled={isPending}
            >
                Cancel
            </Button>
            <Button 
                onClick={form.handleSubmit(onSubmit)} 
                disabled={isPending || isExtracting} 
                className="h-12 px-8 font-bold min-w-[200px] shadow-lg shadow-primary/20"
            >
                {isPending ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving Template...
                    </>
                ) : (
                    <>
                        <Save className="mr-2 h-4 w-4" />
                        Create Template
                    </>
                )}
            </Button>
        </DialogFooter>
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
