'use client';

import { Suspense, useEffect, useState, useMemo, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import { FormWizard } from './form-wizard';
import { 
    Loader2, 
    Wand2, 
    ShieldAlert, 
    ArrowLeft, 
    FileCheck, 
    ClipboardCheck, 
    BookOpen, 
    ChevronRight,
    Search,
    Plus,
    Layout,
    ListFilter,
    PlusCircle,
    Trash2,
    Fingerprint,
    History
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy, deleteDoc } from 'firebase/firestore';
import { DistributionUser, QualityChecklist, PermitTemplate, ToolboxTalkTemplate } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

function FormCreatorContent() {
  const db = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: sessionUser } = useUser();
  const [isPendingDelete, startTransition] = useTransition();

  const templateId = searchParams.get('id');
  const templateType = searchParams.get('type') as 'permit' | 'qc' | 'toolbox' | null;
  const isCreatingNew = searchParams.get('new') === 'true';
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Fetch Profile
  const profileRef = useMemoFirebase(() => {
    if (!db || !sessionUser?.email) return null;
    return doc(db, 'users', sessionUser.email.toLowerCase().trim());
  }, [db, sessionUser?.email]);
  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  // 2. Fetch Existing Template (if editing)
  const templateRef = useMemoFirebase(() => {
    if (!db || !templateId || !templateType) return null;
    const collectionName = 
      templateType === 'permit' ? 'permit-templates' :
      templateType === 'qc' ? 'quality-checklists' :
      'toolbox-talk-templates';
    return doc(db, collectionName, templateId);
  }, [db, templateId, templateType]);

  const { data: existingTemplate, isLoading: templateLoading } = useDoc<any>(templateRef);

  // 3. Library Fetching
  const qcQuery = useMemoFirebase(() => db ? query(collection(db, 'quality-checklists'), where('isTemplate', '==', true)) : null, [db]);
  const { data: qcTemplates } = useCollection<QualityChecklist>(qcQuery);

  const permitQuery = useMemoFirebase(() => db ? collection(db, 'permit-templates') : null, [db]);
  const { data: permitTemplates } = useCollection<PermitTemplate>(permitQuery);

  const toolboxQuery = useMemoFirebase(() => db ? collection(db, 'toolbox-talk-templates') : null, [db]);
  const { data: toolboxTemplates } = useCollection<ToolboxTalkTemplate>(toolboxQuery);

  const handleDeleteTemplate = (id: string, type: 'permit' | 'qc' | 'toolbox') => {
    startTransition(async () => {
        try {
            const collectionName = 
                type === 'permit' ? 'permit-templates' :
                type === 'qc' ? 'quality-checklists' :
                'toolbox-talk-templates';
            
            await deleteDoc(doc(db!, collectionName, id));
            toast({ title: 'Template Deleted', description: 'Record removed from master library.' });
        } catch (err) {
            toast({ title: 'Error', variant: 'destructive', description: 'Failed to delete template.' });
        }
    });
  };

  if (profileLoading || (templateId && templateLoading)) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Security Check
  if (!profile?.permissions?.hasFullVisibility) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4 opacity-20" />
        <h3 className="text-xl font-bold">Access Restricted</h3>
        <p className="text-muted-foreground text-sm max-w-md mt-2">
          Management of master templates requires administrative oversight.
        </p>
      </div>
    );
  }

  // If we have an ID or type, we are in Editor View
  if (templateId || templateType || isCreatingNew) {
    return (
        <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
            <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2.5 rounded-xl">
                            <Wand2 className="h-8 w-8 text-primary" />
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">
                            {templateId ? 'Template Editor' : 'Template Designer'}
                        </h2>
                    </div>
                    <p className="text-muted-foreground font-medium">
                        {templateId ? `Refining "${existingTemplate?.title || '...'}"` : 'Construct a master digital form for site use.'}
                    </p>
                </div>
                <Button variant="ghost" onClick={() => router.push('/form-creator')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Exit Editor
                </Button>
            </div>

            <FormWizard 
                currentUser={profile} 
                initialTemplate={existingTemplate} 
                initialType={templateType} 
            />
        </main>
    );
  }

  // ELSE: Show Library Explorer (List View)
  return (
    <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-7xl mx-auto w-full space-y-10 pb-32">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-3 rounded-2xl shadow-sm">
                        <Layout className="h-8 w-8 text-primary" />
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter uppercase">Form Editor</h2>
                </div>
                <p className="text-muted-foreground font-medium max-w-xl leading-relaxed">
                    Centrally manage your project's digital documentation standards with automated revision control.
                </p>
            </div>
            <Button onClick={() => router.push('/form-creator?new=true')} className="gap-2 h-12 px-6 font-bold shadow-lg shadow-primary/20">
                <PlusCircle className="h-5 w-5" />
                New Template
            </Button>
        </div>

        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <div className="flex items-center gap-3">
                    <ListFilter className="h-5 w-5 text-muted-foreground" />
                    <h3 className="font-black uppercase text-sm tracking-widest">Master Template Library</h3>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search templates..." 
                        className="pl-10 h-10 bg-muted/20 border-none shadow-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <TemplateLibraryList 
                searchTerm={searchTerm}
                permits={permitTemplates || []}
                qc={qcTemplates || []}
                toolbox={toolboxTemplates || []}
                onEdit={(type, id) => router.push(`/form-creator?type=${type}&id=${id}`)}
                onDelete={handleDeleteTemplate}
                isDeleting={isPendingDelete}
            />
        </div>
    </main>
  );
}

function TemplateLibraryList({ searchTerm, permits = [], qc = [], toolbox = [], onEdit, onDelete, isDeleting }: { 
    searchTerm: string, 
    permits?: PermitTemplate[], 
    qc?: QualityChecklist[], 
    toolbox?: ToolboxTalkTemplate[],
    onEdit: (type: 'permit' | 'qc' | 'toolbox', id: string) => void,
    onDelete: (id: string, type: 'permit' | 'qc' | 'toolbox') => void,
    isDeleting: boolean
}) {
    const s = searchTerm.toLowerCase();
    const allItems = useMemo(() => {
        return [
            ...permits.map(p => ({ ...p, studioType: 'permit' as const, icon: FileCheck, typeLabel: 'Permit' })),
            ...qc.map(q => ({ ...q, studioType: 'qc' as const, icon: ClipboardCheck, typeLabel: 'Quality Control' })),
            ...toolbox.map(t => ({ ...t, studioType: 'toolbox' as const, icon: BookOpen, typeLabel: 'Toolbox Talk' })),
        ].filter(t => t.title.toLowerCase().includes(s))
         .sort((a, b) => a.title.localeCompare(b.title));
    }, [permits, qc, toolbox, s]);

    if (allItems.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/5 opacity-40">
                <p className="font-bold">No templates found matching your search.</p>
            </div>
        );
    }

    return (
        <div className="rounded-md border bg-card overflow-hidden">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[120px]"><div className="flex items-center gap-2"><Fingerprint className="h-3 w-3" /> Ref</div></TableHead>
                        <TableHead>Template Title</TableHead>
                        <TableHead className="w-[150px]">Category</TableHead>
                        <TableHead className="w-[100px] text-center"><div className="flex items-center justify-center gap-2"><History className="h-3 w-3" /> Rev</div></TableHead>
                        <TableHead className="text-right pr-6">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allItems.map((item) => (
                        <TableRow 
                            key={item.id} 
                            className="group cursor-pointer hover:bg-muted/50"
                            onClick={() => onEdit(item.studioType, item.id)}
                        >
                            <TableCell className="font-mono text-[10px] font-bold text-primary">
                                {item.reference || '---'}
                            </TableCell>
                            <TableCell className="font-bold py-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-muted p-2 rounded group-hover:bg-background transition-colors shrink-0">
                                        <item.icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="group-hover:text-primary transition-colors truncate">{item.title}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest bg-muted/50 border-none px-2 h-5">
                                    {item.typeLabel}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                                    {item.revision ? item.revision.toString().padStart(2, '0') : '01'}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6" onClick={e => e.stopPropagation()}>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Master Template?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Permanently remove "<strong>{item.title}</strong>" from the library. This will not affect existing site forms already created from this template.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction 
                                                className="bg-destructive" 
                                                onClick={() => onDelete(item.id, item.studioType)}
                                                disabled={isDeleting}
                                            >
                                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                Delete Template
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

export default function FormCreatorPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-background">
      <Header title="Form Editor" />
      <Suspense fallback={
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <FormCreatorContent />
      </Suspense>
    </div>
  );
}
