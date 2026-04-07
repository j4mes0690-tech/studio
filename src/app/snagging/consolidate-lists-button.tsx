'use client';

import { useState, useTransition, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Layers, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, arrayUnion } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { SnaggingItem, DistributionUser } from '@/lib/types';
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

/**
 * ConsolidateListsButton - Logic to merge multiple snagging lists for the same area into one.
 */
export function ConsolidateListsButton({ 
    allLists, 
    profile 
}: { 
    allLists: SnaggingItem[], 
    profile?: DistributionUser 
}) {
    const { toast } = useToast();
    const db = useFirestore();
    const [isPending, startTransition] = useTransition();

    const duplicatesGroups = useMemo(() => {
        const groups = new Map<string, SnaggingItem[]>();
        allLists.forEach(l => {
            const key = `${l.projectId}-${l.areaId || 'site-wide'}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(l);
        });
        return Array.from(groups.values()).filter(group => group.length > 1);
    }, [allLists]);

    const handleConsolidate = () => {
        startTransition(async () => {
            try {
                const batch = writeBatch(db);
                let totalMerged = 0;

                duplicatesGroups.forEach(listGroup => {
                    // Sort by creation date to pick the oldest as master
                    const sorted = [...listGroup].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                    const master = sorted[0];
                    const others = sorted.slice(1);

                    const combinedItems = others.flatMap(l => l.items || []);
                    const combinedPhotos = others.flatMap(l => l.photos || []);

                    if (combinedItems.length > 0 || combinedPhotos.length > 0) {
                        batch.update(doc(db, 'snagging-items', master.id), {
                            items: arrayUnion(...combinedItems),
                            photos: arrayUnion(...combinedPhotos)
                        });
                    }

                    others.forEach(l => {
                        batch.delete(doc(db, 'snagging-items', l.id));
                    });
                    totalMerged++;
                });

                await batch.commit();
                toast({ title: 'Consolidation Complete', description: `Successfully merged records for ${totalMerged} site areas.` });
            } catch (err) {
                console.error(err);
                toast({ title: 'Merge Failed', description: 'Could not consolidate lists. Check connection.', variant: 'destructive' });
            }
        });
    };

    const hasAdminAccess = profile?.permissions?.hasFullVisibility || profile?.email === 'admin@example.com';
    if (duplicatesGroups.length === 0 || !hasAdminAccess) return null;

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" className="gap-2 text-primary border-primary/20 hover:bg-primary/5 font-bold h-9">
                    <Layers className="h-4 w-4" />
                    Consolidate {duplicatesGroups.length} Areas
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <div className="flex items-center gap-3 text-primary mb-2">
                        <AlertTriangle className="h-6 w-6" />
                        <AlertDialogTitle>Consolidate Area Lists?</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription>
                        There are {duplicatesGroups.length} areas with multiple snagging lists. 
                        This tool will merge all defects and photos into a single master record per area to maintain a clean project audit trail.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConsolidate} disabled={isPending} className="bg-primary hover:bg-primary/90 font-bold">
                        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Merge Duplicate Lists
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
