
'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { FormWizard } from './form-wizard';
import { Loader2, Wand2, ShieldAlert, ArrowLeft } from 'lucide-react';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { DistributionUser } from '@/lib/types';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

function FormCreatorContent() {
  const db = useFirestore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user: sessionUser } = useUser();

  const templateId = searchParams.get('id');
  const templateType = searchParams.get('type') as 'permit' | 'qc' | 'toolbox' | null;

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

  if (profileLoading || (templateId && templateLoading)) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Security Check: Only admins/full visibility can create master templates
  if (!profile?.permissions?.hasFullVisibility) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-6 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive mb-4 opacity-20" />
        <h3 className="text-xl font-bold">Template Access Restricted</h3>
        <p className="text-muted-foreground text-sm max-w-md mt-2">
          Creating or editing system-wide templates for permits and quality control requires administrative oversight.
        </p>
      </div>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-8 lg:p-10 max-w-5xl mx-auto w-full">
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
            <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-xl">
                <Wand2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">
                {templateId ? 'Edit Template' : 'Form Studio'}
            </h2>
            </div>
            <p className="text-muted-foreground font-medium">
                {templateId ? `Refining "${existingTemplate?.title || '...'}"` : 'Create professional site templates with custom verification logic.'}
            </p>
        </div>
        {templateId && (
            <Button variant="ghost" onClick={() => router.push('/settings')} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Settings
            </Button>
        )}
      </div>

      <FormWizard 
        currentUser={profile} 
        initialTemplate={existingTemplate} 
        initialType={templateType} 
      />
    </main>
  );
}

export default function FormCreatorPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-muted/5">
      <Header title="Form Creator Wizard" />
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
