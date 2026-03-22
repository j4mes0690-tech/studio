
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
    Layout
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

  // If we have an ID, we are in Edit/Create Mode
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
                            {templateId ? 'Edit Template' : 'Template Designer'}
                        </h2>
                    </div>
                    <p className="text-muted-foreground font-medium">
                        {templateId ? `Refining "${existingTemplate?.title || '...'}"` : 'Construct a master digital form for site use.'}
                    </p>
                </div>
                <Button variant="ghost" onClick={() => router.push('/form-creator')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Cancel & Return
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

  // ELSE: Show Library Explorer
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
                    Centrally manage your project's digital documentation standards. Create, refine, and reorder master templates.
                </p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => router.push('/form-creator?type=permit')} className="h-12 px-6 font-bold shadow-lg shadow-primary/20">
                    <Plus className="mr-2 h-5 w-5" /> Create New
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=permit')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><FileCheck className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">New Permit</h3>
                </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=qc')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><ClipboardCheck className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">New QC Checklist</h3>
                </CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/10 hover:bg-primary/10 transition-colors cursor-pointer group" onClick={() => router.push('/form-creator?type=toolbox')}>
                <CardContent className="p-6 text-center space-y-3">
                    <div className="bg-background h-12 w-12 rounded-xl flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform"><BookOpen className="h-6 w-6 text-primary" /></div>
                    <h3 className="font-bold uppercase text-[10px] tracking-widest">New Toolbox Talk</h3>
                </CardContent>
            </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
                <TabsList className="h-10 p-1 bg-muted/50">
                    <TabsTrigger value="all" className="text-xs font-bold uppercase tracking-tight">All Templates</TabsTrigger>
                    <TabsTrigger value="permit" className="text-xs font-bold uppercase tracking-tight">Permits</TabsTrigger>
                    <TabsTrigger value="qc" className="text-xs font-bold uppercase tracking-tight">QC Lists</TabsTrigger>
                    <TabsTrigger value="toolbox" className="text-xs font-bold uppercase tracking-tight">Talks</TabsTrigger>
                </TabsList>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search your library..." 
                        className="pl-10 h-10 bg-muted/20 border-none shadow-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <TabsContent value="all" className="mt-0">
                <TemplateLibraryGrid 
                    searchTerm={searchTerm}
                    permits={permitTemplates || []}
                    qc={qcTemplates || []}
                    toolbox={toolboxTemplates || []}
                    onEdit={(type, id) => router.push(`/form-creator?type=${type}&id=${id}`)}
                />
            </TabsContent>
            <TabsContent value="permit" className="mt-0">
                <TemplateLibraryGrid 
                    searchTerm={searchTerm}
                    permits={permitTemplates || []}
                    onEdit={(type, id) => router.push(`/form-creator?type=${type}&id=${id}`)}
                />
            </TabsContent>
            <TabsContent value="qc" className="mt-0">
                <TemplateLibraryGrid 
                    searchTerm={searchTerm}
                    qc={qcTemplates || []}
                    onEdit={(type, id) => router.push(`/form-creator?type=${type}&id=${id}`)}
                />
            </TabsContent>
            <TabsContent value="toolbox" className="mt-0">
                <TemplateLibraryGrid 
                    searchTerm={searchTerm}
                    toolbox={toolboxTemplates || []}
                    onEdit={(type, id) => router.push(`/form-creator?type=${type}&id=${id}`)}
                />
            </TabsContent>
        </Tabs>
    </main>
  );
}

function TemplateLibraryGrid({ searchTerm, permits = [], qc = [], toolbox = [], onEdit }: { 
    searchTerm: string, 
    permits?: PermitTemplate[], 
    qc?: QualityChecklist[], 
    toolbox?: ToolboxTalkTemplate[],
    onEdit: (type: 'permit' | 'qc' | 'toolbox', id: string) => void
}) {
    const s = searchTerm.toLowerCase();
    const filtered = [
        ...permits.map(p => ({ ...p, studioType: 'permit' as const, icon: FileCheck })),
        ...qc.map(q => ({ ...q, studioType: 'qc' as const, icon: ClipboardCheck })),
        ...toolbox.map(t => ({ ...t, studioType: 'toolbox' as const, icon: BookOpen })),
    ].filter(t => t.title.toLowerCase().includes(s) || (t.trade && t.trade.toLowerCase().includes(s)));

    if (filtered.length === 0) {
        return (
            <div className="py-20 text-center border-2 border-dashed rounded-2xl bg-muted/5 opacity-40">
                <p className="font-bold">No templates found matching your search.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item) => (
                <Card key={item.id} className="group hover:border-primary transition-all shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                            <Badge variant="secondary" className="uppercase text-[8px] font-black tracking-widest h-5 px-2 bg-muted/50 border-none">
                                {item.studioType}
                            </Badge>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onEdit(item.studioType, item.id)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <CardTitle className="text-base line-clamp-1 group-hover:text-primary transition-colors">{item.title}</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-tight flex items-center gap-1.5">
                            <item.icon className="h-3 w-3 text-muted-foreground" />
                            {item.trade || 'General Site Standard'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <Button 
                            variant="outline" 
                            className="w-full h-9 font-bold text-xs uppercase tracking-tight border-primary/20 text-primary hover:bg-primary/5"
                            onClick={() => onEdit(item.studioType, item.id)}
                        >
                            Open in Designer
                        </Button>
                    </CardContent>
                </Card>
            ))}
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
