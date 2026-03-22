
'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
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
    ListFilter
} from 'lucide-react';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, orderBy } from 'firebase/firestore';
import type { DistributionUser, QualityChecklist, PermitTemplate, ToolboxTalkTemplate } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function FormCreatorContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: sessionUser } = useUser();

  const templateId = searchParams.get('id');
  const templateType = searchParams.get('type') as 'permit' | 'qc' | 'toolbox' | null;
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
  if (templateId || templateType) {
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
                    <h2 className="text-4xl font-black tracking-tighter uppercase">Form Studio</h2>
                </div>
                <p className="text-muted-foreground font-medium max-w-xl leading-relaxed">
                    Centrally manage your project's digital documentation standards.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=permit')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><FileCheck className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">Create Permit</h3>
                </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=qc')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><ClipboardCheck className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">Create QC List</h3>
                </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=toolbox')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><BookOpen className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">Create Toolbox Talk</h3>
                </CardContent>
            </Card>
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
            />
        </div>
    </main>
  );
}

function TemplateLibraryList({ searchTerm, permits = [], qc = [], toolbox = [], onEdit }: { 
    searchTerm: string, 
    permits?: PermitTemplate[], 
    qc?: QualityChecklist[], 
    toolbox?: ToolboxTalkTemplate[],
    onEdit: (type: 'permit' | 'qc' | 'toolbox', id: string) => void
}) {
    const s = searchTerm.toLowerCase();
    const allItems = useMemo(() => {
        return [
            ...permits.map(p => ({ ...p, studioType: 'permit' as const, icon: FileCheck, typeLabel: 'Permit to Work' })),
            ...qc.map(q => ({ ...q, studioType: 'qc' as const, icon: ClipboardCheck, typeLabel: 'Quality Control' })),
            ...toolbox.map(t => ({ ...t, studioType: 'toolbox' as const, icon: BookOpen, typeLabel: 'Toolbox Talk' })),
        ].filter(t => t.title.toLowerCase().includes(s) || (t.trade && t.trade.toLowerCase().includes(s)))
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
        <div className="rounded-md border bg-card">
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow>
                        <TableHead className="w-[40%]">Reference Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Trade Discipline</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {allItems.map((item) => (
                        <TableRow 
                            key={item.id} 
                            className="group cursor-pointer hover:bg-muted/50"
                            onClick={() => onEdit(item.studioType, item.id)}
                        >
                            <TableCell className="font-bold py-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-muted p-2 rounded group-hover:bg-background transition-colors">
                                        <item.icon className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="group-hover:text-primary transition-colors">{item.title}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-widest bg-muted/50 border-none px-2 h-5">
                                    {item.typeLabel}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-muted-foreground uppercase">
                                {item.trade || 'General Standard'}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="h-8 gap-2 font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    Edit Template <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
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
      <Header title="Form Studio" />
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
