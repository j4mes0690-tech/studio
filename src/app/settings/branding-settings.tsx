'use client';

import { useState, useTransition, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirestore, useStorage, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { uploadFile, dataUriToBlob } from '@/lib/storage-utils';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Trash2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import Image from 'next/image';
import type { SystemSettings } from '@/lib/types';

export function BrandingSettings() {
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const settingsRef = useMemoFirebase(() => doc(db, 'system-settings', 'branding'), [db]);
  const { data: settings, isLoading } = useDoc<SystemSettings>(settingsRef);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    startTransition(async () => {
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUri = event.target?.result as string;
          const blob = await dataUriToBlob(dataUri);
          const logoUrl = await uploadFile(storage, 'branding/logo.png', blob);

          await setDoc(settingsRef, {
            id: 'branding',
            logoUrl
          }, { merge: true });

          toast({ title: 'Branding Updated', description: 'Your company logo has been saved and will appear on PDF exports.' });
        };
        reader.readAsDataURL(file);
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to upload logo.', variant: 'destructive' });
      }
    });
  };

  const removeLogo = () => {
    startTransition(async () => {
      await setDoc(settingsRef, {
        logoUrl: null
      }, { merge: true });
      toast({ title: 'Logo Removed', description: 'System will revert to standard branding.' });
    });
  };

  if (isLoading) return <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto my-8" />;

  return (
    <Card className="border-primary/20 shadow-sm overflow-hidden">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg shadow-lg shadow-primary/20">
            <ImageIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle>Company Branding</CardTitle>
            <CardDescription>Upload your logo to personalize project PDF exports.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="flex flex-col items-center gap-4 shrink-0">
            <div className="relative w-40 h-40 rounded-xl border-2 border-dashed border-muted flex items-center justify-center bg-muted/10 overflow-hidden group">
              {settings?.logoUrl ? (
                <>
                  <Image src={settings.logoUrl} alt="Company Logo" fill className="object-contain p-4" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button variant="destructive" size="sm" className="h-8 gap-2 font-bold" onClick={removeLogo}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4">
                  <ImageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Logo Set</p>
                </div>
              )}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full font-bold gap-2" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {settings?.logoUrl ? 'Change Logo' : 'Upload Logo'}
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleLogoUpload} 
            />
          </div>

          <div className="flex-1 space-y-4 pt-2">
            <div className="space-y-1">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Active PDF Visibility
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your logo will automatically be placed in the header of the following documents:
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Purchase Order Exports',
                'Plant Hire Contracts',
                'Snagging List Audits',
                'Project Summary Reports'
              ].map(item => (
                <li key={item} className="flex items-center gap-2 text-[11px] font-medium text-foreground bg-muted/30 p-2 rounded border">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg">
              <p className="text-[10px] text-amber-800 font-medium">
                <strong>Pro-tip:</strong> Use a transparent PNG with a minimum width of 400px for the best results on printed reports.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
