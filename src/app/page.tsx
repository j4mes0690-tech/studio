
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
  ArrowRight,
  LayoutGrid,
  Grid2X2,
  GripVertical,
  FileSignature,
  CalendarClock,
  AlertTriangle,
  CalendarRange
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
  { id: 'planner', href: '/planner', label: 'Work Planner', icon: CalendarRange, desc: 'walkthrough properties and identify activities.', permission: 'accessPlanner' },
  { id: 'irs', href: '/irs', label: 'IRS Schedule', icon: CalendarClock, desc: 'Information Required Schedule for design deliverables.', permission: 'accessIRS' },
  { id: 'materials', href: '/materials-orders', label: 'Materials Orders', icon: ShoppingCart, desc: 'Create and manage purchase orders for project materials.', permission: 'accessMaterials' },
  { id: 'plant', href: '/plant-orders', label: 'Plant Orders', icon: Truck, desc: 'Track equipment hire, off-hire dates, and commercial rates.', permission: 'accessPlant' },
  { id: 'subcontract-orders', href: '/subcontract-orders', label: 'Sub Contract Orders', icon: FileSignature, desc: 'Track the drafting and DocuSign signing status of partners.', permission: 'accessSubContractOrders' },
  { id: 'variations', href: '/variations', label: 'Variations', icon: Calculator, desc: 'Manage additions and omissions linked to instructions.', permission: 'accessVariations' },
  { id: 'payment-notices', label: 'Payment Notices', href: '/payment-notices', icon: Banknote, desc: 'Track subcontractor applications, certificates, and invoices.', permission: 'accessPaymentNotices' },
  { id: 'permits', href: '/permits', label: 'Permits to Work', icon: FileCheck, desc: 'Issue and track high-risk activity permits electronically.', permission: 'accessPermits' },
  { id: 'training', href: '/training', label: 'Training & Compliance', icon: GraduationCap, desc: 'Store employee certificates and monitor expiry dates.', permission: 'accessTraining' },
  { id: 'client-instructions', href: '/client-instructions', label: 'Client Instructions', icon: MessageCircle, desc: 'Directives received from the client for implementation.', permission: 'accessClientInstructions' },
  { id: 'site-instructions', href: '/instructions', label: 'Site Instructions', icon: MessageSquare, desc: 'Record and distribute instructions to trade partners.', permission: 'accessSiteInstructions' },
  { id: 'cleanup-notices', href: '/cleanup-notices', label: 'Clean Up Notices', icon: Sparkles, desc: 'Create and send clean up notices with site photos.', permission: 'accessCleanupNotices' },
  { id: 'snagging', href: '/snagging', label: 'Snagging Lists', icon: ListChecks, desc: 'Record and track defects with completion documentation.', permission: 'accessSnagging' },
  { id: 'quality-control', href: '/quality-control', label: 'Quality Control', icon: ClipboardCheck, desc: 'Project area inspections and quality sign-off.', permission: 'accessQualityControl' },
  { id: 'information-requests', href: '/information-requests', label: 'Info Requests', icon: HelpCircle, desc: 'Technical queries and clarifications.', permission: 'accessInfoRequests' },
];

export default function Dashboard() {
  const { user, isLoading: userLoading } = useUser();
  const db = useFirestore();
  const [isCompact, setIsCompact] = useState(false);
  const [orderedCardIds, setOrderedCardIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [canDragId, setCanDragId] = useState<string | null>(null);

  // Load persistence
  useEffect(() => {
    const savedDensity = localStorage.getItem('sitecommand_dashboard_compact');
    if (savedDensity !== null) {
      setIsCompact(savedDensity === 'true');
    }

    const savedOrder = localStorage.getItem('sitecommand_dashboard_order');
    const defaultIds = DASHBOARD_CARDS.map(c => c.id);
    
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder) as string[];
        const existingIds = new Set(defaultIds);
        const filteredParsed = parsed.filter(id => existingIds.has(id));
        const missingIds = defaultIds.filter(id => !filteredParsed.includes(id));
        setOrderedCardIds([...filteredParsed, ...missingIds]);
      } catch (e) {
        setOrderedCardIds(defaultIds);
      }
    } else {
      setOrderedCardIds(defaultIds);
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
    if (!profile || orderedCardIds.length === 0) return [];
    
    const allowed = DASHBOARD_CARDS.filter(card => {
        if (!card.permission) return true;
        return profile.permissions?.[card.permission as keyof typeof profile.permissions] !== false;
    });

    // Sort based on saved ID order
    return [...allowed].sort((a, b) => {
        return orderedCardIds.indexOf(a.id) - orderedCardIds.indexOf(b.id);
    });
  }, [profile, orderedCardIds]);

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...orderedCardIds];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);

    setOrderedCardIds(newOrder);
    localStorage.setItem('sitecommand_dashboard_order', JSON.stringify(newOrder));
    setDraggedId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

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
      <main className="flex flex-1 flex-col items-center gap-4 p-3 md:gap-8 md:p-8">
        
        {profile?.requirePasswordChange && (
            <Alert variant="destructive" className="max-w-6xl w-full border-2 bg-destructive/5 animate-in fade-in slide-in-from-top-4 duration-500">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-bold">Security Action Required</AlertTitle>
                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                    <p>You are currently using a temporary password. Please update your account credentials immediately.</p>
                    <Button asChild variant="destructive" size="sm" className="font-bold gap-2 shrink-0">
                        <Link href="/account">
                            Update Account <ArrowRight className="h-4 w-4" />
                        </Link>
                    </Button>
                </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col items-center text-center gap-3 mt-2 md:mt-4 relative w-full max-w-6xl">
            <div className={cn("p-3 bg-primary/10 rounded-full transition-all md:p-4", isCompact && "p-2")}>
                <HardHat className={cn("text-primary transition-all", isCompact ? "h-6 w-6" : "h-10 w-10 md:h-16 md:w-16")} />
            </div>
            <div className="px-4">
                <h1 className={cn("font-bold tracking-tight transition-all", isCompact ? "text-lg md:text-xl" : "text-xl md:text-3xl")}>Welcome to SiteCommand</h1>
                {!isCompact && <p className="text-muted-foreground text-xs md:text-sm mt-1 max-w-sm md:max-w-none">Select an action to get started. Long-press or use grip to reorder.</p>}
            </div>

            <div className="absolute top-0 right-0 hidden md:flex items-center gap-2">
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
                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3" 
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-6xl"
        )}>
          {allowedCards.map((card) => (
            <div
                key={card.id}
                draggable={canDragId === card.id}
                onDragStart={(e) => handleDragStart(e, card.id)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, card.id)}
                onDragEnd={handleDragEnd}
                className={cn(
                    "relative transition-opacity group",
                    draggedId === card.id ? "opacity-40" : "opacity-100"
                )}
            >
                {/* Drag Handle - Only this area allows reordering cursors and initiation */}
                <div 
                    className="absolute top-2 left-2 z-30 p-1.5 opacity-0 md:group-hover:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-background/90 rounded border border-border shadow-sm hidden md:block"
                    onMouseEnter={() => setCanDragId(card.id)}
                    onMouseLeave={() => setCanDragId(null)}
                >
                    <GripVertical className="h-3.5 w-3.5 text-primary" />
                </div>

                <Link href={card.href} className="block h-full">
                    <Card className={cn(
                        "flex flex-col items-center justify-center transition-all hover:bg-muted/50 hover:border-primary/50 hover:shadow-md h-full relative",
                        isCompact ? "p-3 md:p-4 text-center" : "p-5 md:p-8 text-center"
                    )}>
                        <CardHeader className="p-0">
                        <card.icon className={cn(
                            "mb-2 transition-transform group-hover:scale-110 text-muted-foreground group-hover:text-primary",
                            isCompact ? "h-6 w-6" : "h-8 w-8 mb-2 md:h-12 md:w-12 md:mb-4"
                        )} />
                        <CardTitle className={cn("transition-all", isCompact ? "text-xs md:text-sm" : "text-sm md:text-xl")}>{card.label}</CardTitle>
                        </CardHeader>
                        {!isCompact && (
                            <CardContent className="p-0 mt-2 hidden sm:block">
                                <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">
                                    {card.desc}
                                </p>
                            </CardContent>
                        )}
                    </Card>
                </Link>
            </div>
          ))}
        </div>

        {allowedCards.length === 0 && (
            <div className="text-center py-12 px-6 border-2 border-dashed rounded-xl bg-muted/5 w-full max-w-md">
                <p className="font-bold text-muted-foreground">No Modules Assigned</p>
                <p className="text-xs text-muted-foreground mt-1">Please contact your system administrator to assign module access to your profile.</p>
            </div>
        )}
      </main>
    </div>
  );
}
