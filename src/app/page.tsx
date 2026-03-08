
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
  Banknote,
  AlertTriangle,
  ArrowRight,
  LayoutGrid,
  Grid2X2
} from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { DistributionUser } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
  const [isCompact, setIsCompact] = useState(false);

  // Load persistence
  useEffect(() => {
    const saved = localStorage.getItem('sitecommand_dashboard_compact');
    if (saved !== null) {
      setIsCompact(saved === 'true');
    }
  }, []);

  const toggleView = () => {
    const newVal = !isCompact;
    setIsCompact(newVal);
    localStorage.setItem('sitecommand_dashboard_compact', String(newVal));
  };

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
      <main className="flex flex-1 flex-col items-center gap-8 p-4 md:p-8">
        
        {profile?.requirePasswordChange && (
            <Alert variant="destructive" className="max-w-6xl w-full border-2 bg-destructive/5 animate-in fade-in slide-in-from-top-4 duration-500">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold">Security Action Required</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                    <p>You are currently using a temporary password. Please update your account credentials immediately to secure your access.</p>
                    <Button asChild variant="destructive" size="sm" className="font-bold gap-2 shrink-0">
                        <Link href="/account">
                            Update Password <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col items-center text-center gap-4 mt-4 relative w-full max-w-6xl">
            <div className={cn("p-4 bg-primary/10 rounded-full transition-all", isCompact && "p-2")}>
                <HardHat className={cn("text-primary transition-all", isCompact ? "h-8 w-8" : "h-16 w-16")} />
            </div>
            <div>
                <h1 className={cn("font-bold tracking-tight transition-all", isCompact ? "text-xl" : "text-3xl")}>Welcome to SiteCommand</h1>
                {!isCompact && <p className="text-muted-foreground">Select an action to get started with site operations.</p>}
            </div>

            <div className="absolute top-0 right-0">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={toggleView}
                                className="h-9 w-9"
                            >
                                {isCompact ? <LayoutGrid className="h-4 w-4" /> : <Grid2X2 className="h-4 w-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Switch to {isCompact ? 'Standard' : 'Compact'} View</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>

        <div className={cn(
            "grid w-full pb-12 transition-all",
            isCompact 
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3" 
                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-6xl"
        )}>
          {allowedCards.map((card) => (
            <Link key={card.href} href={card.href}>
              <Card className={cn(
                  "flex flex-col items-center justify-center transition-all hover:bg-muted/50 hover:border-primary/50 hover:shadow-md h-full group",
                  isCompact ? "p-4 text-center" : "p-8 text-center"
              )}>
                <CardHeader className="p-0">
                  <card.icon className={cn(
                      "mb-2 transition-transform group-hover:scale-110 text-muted-foreground group-hover:text-primary",
                      isCompact ? "h-8 w-8" : "h-12 w-12 mb-4"
                  )} />
                  <CardTitle className={cn("transition-all", isCompact ? "text-sm" : "text-xl")}>{card.label}</CardTitle>
                </CardHeader>
                {!isCompact && (
                    <CardContent className="p-0 mt-2">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {card.desc}
                        </p>
                    </CardContent>
                )}
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
