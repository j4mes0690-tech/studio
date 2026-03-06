
'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { 
  MessageSquare, 
  Sparkles, 
  ListChecks, 
  HardHat, 
  HelpCircle, 
  ClipboardCheck, 
  MessageCircle, 
  ShoppingCart, 
  FileCheck, 
  Truck, 
  Calculator,
  GraduationCap,
  Loader2,
  ShieldCheck,
  Banknote
} from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { DistributionUser } from '@/lib/types';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

const DASHBOARD_CARDS = [
  { href: '/materials-orders', label: 'Materials Orders', icon: ShoppingCart, desc: 'Create and manage purchase orders for project materials.', permission: 'accessMaterials' },
  { href: '/plant-orders', label: 'Plant Orders', icon: Truck, desc: 'Track equipment hire, off-hire dates, and commercial rates.', permission: 'accessPlant' },
  { href: '/variations', label: 'Variations', icon: Calculator, desc: 'Manage additions and omissions linked to instructions.', permission: 'accessVariations' },
  { href: '/payment-notices', label: 'Payment Notices', icon: Banknote, desc: 'Track subcontractor applications, certificates, and invoices.', permission: 'accessPaymentNotices' },
  { href: '/permits', label: 'Permits to Work', icon: FileCheck, desc: 'Issue and track high-risk activity permits electronically.', permission: 'accessPermits' },
  { href: '/training', label: 'Training & Compliance', icon: GraduationCap, desc: 'Store employee certificates and monitor expiry dates.', permission: 'accessTraining' },
  { href: '/client-instructions', label: 'Client Instructions', icon: MessageCircle, desc: 'Directives received from the client for implementation.', permission: 'accessClientInstructions' },
  { href: '/instructions', label: 'Site Instructions', icon: MessageSquare, desc: 'Record and distribute instructions to trade partners.', permission: 'accessSiteInstructions' },
  { href: '/cleanup-notices', label: 'Clean Up Notices', icon: Sparkles, desc: 'Create and send clean up notices with site photos.', permission: 'accessCleanupNotices' },
  { href: '/snagging', label: 'Snagging Lists', icon: ListChecks, desc: 'Record and track defects with completion documentation.', permission: 'accessSnagging' },
  { href: '/quality-control', label: 'Quality Control', icon: ClipboardCheck, desc: 'Project area inspections and quality sign-off.', permission: 'accessQualityControl' },
  { href: '/information-requests', label: 'Info Requests', icon: HelpCircle, desc: 'Technical queries and clarifications.', permission: 'accessInfoRequests' },
];

export default function Dashboard() {
  const { user, isLoading: userLoading } = useUser();
  const db = useFirestore();

  const profileRef = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return doc(db, 'users', user.email.toLowerCase().trim());
  }, [db, user?.email]);

  const { data: profile, isLoading: profileLoading } = useDoc<DistributionUser>(profileRef);

  const allowedCards = useMemo(() => {
    if (!profile) return [];
    return DASHBOARD_CARDS.filter(card => {
        if (!card.permission) return true;
        return profile.permissions?.[card.permission as keyof typeof profile.permissions] !== false;
    });
  }, [profile]);

  if (userLoading || profileLoading) {
    return (
        <div className="flex flex-col w-full h-screen">
            <Header title="Dashboard" />
            <main className="flex flex-1 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </main>
        </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 md:p-8">
        <div className="flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-primary/10 rounded-full">
                <HardHat className="h-16 w-16 text-primary" />
            </div>
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome to SiteCommand</h1>
                <p className="text-muted-foreground">Select an action to get started with site operations.</p>
            </div>
        </div>

        <div className="grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8 w-full">
          {allowedCards.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className={cn(
                  "flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-all hover:border-primary/50 hover:shadow-md h-full group"
              )}>
                <CardHeader className="p-0">
                  <card.icon className={cn(
                      "h-12 w-12 mb-4 transition-transform group-hover:scale-110 text-muted-foreground group-hover:text-primary"
                  )} />
                  <CardTitle className="text-xl">{card.label}</CardTitle>
                </CardHeader>
                <CardContent className="p-0 mt-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {card.desc}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {allowedCards.length === 0 && (
            <div className="text-center py-12 px-6 border-2 border-dashed rounded-xl bg-muted/5">
                <p className="font-bold text-muted-foreground">No Modules Assigned</p>
                <p className="text-xs text-muted-foreground mt-1">Please contact your system administrator to assign module access to your profile.</p>
            </div>
        )}
      </main>
    </div>
  );
}
