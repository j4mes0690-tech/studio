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
  CalendarRange,
  ClipboardList,
  BarChart3,
  Sun,
  BookOpen,
  FolderOpen,
  LayoutList,
  Layers,
  Wand2
} from 'lucide-react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { DistributionUser, InformationRequest, ClientInstruction, HolidayRequest, Project } from '@/lib/types';
import { useMemo, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Logo } from '@/components/logo';

const DASHBOARD_CARDS = [
  { id: 'form-creator', href: '/form-creator', label: 'Form Editor', icon: Wand2, desc: 'Master template library and high-fidelity form designer.', permission: 'hasFullVisibility' },
  { id: 'insights', href: '/insights', label: 'Project Insights', icon: BarChart3, desc: 'Project performance, procurement tracking, and RFI analytics.', permission: 'hasFullVisibility' },
  { id: 'documents', href: '/documents', label: 'Drawing Register', icon: FolderOpen, desc: 'Manage project drawings with authorised SharePoint backups.', permission: 'accessDocuments' },
  { id: 'site-diary', href: '/site-diary', label: 'Site Diary', icon: BookOpen, desc: 'Daily records of weather, labour resources, and site activities.', permission: 'accessSiteDiary' },
  { id: 'planner', href: '/planner', label: 'Work Planner', icon: CalendarRange, desc: 'Walkthrough properties and identify activities.', permission: 'accessPlanner' },
  { id: 'procurement', href: '/procurement', label: 'Procurement Schedule', icon: ShoppingCart, desc: 'Track the tendering lifecycle and milestone appointments.', permission: 'accessProcurement' },
  { id: 'irs', href: '/irs', label: 'IRS Schedule', icon: CalendarClock, desc: 'Information Required Schedule for design deliverables.', permission: 'accessIRS' },
  { id: 'materials', href: '/materials-orders', label: 'Materials Orders', icon: ClipboardList, desc: 'Create and manage purchase orders for project materials.', permission: 'accessMaterials' },
  { id: 'plant', href: '/plant-orders', label: 'Plant Orders', icon: Truck, desc: 'Track equipment hire, off-hire dates, and commercial rates.', permission: 'accessPlant' },
  { id: 'subcontract-orders', href: '/subcontract-orders', label: 'Sub-contract Orders', icon: FileSignature, desc: 'Track the drafting and DocuSign signing status of partners.', permission: 'accessSubContractOrders' },
  { id: 'variations', href: '/variations', label: 'Variations', icon: Calculator, permission: 'accessVariations' },
  { id: 'payment-notices', label: 'Payment Notices', href: '/payment-notices', icon: Banknote, desc: 'Track sub-contractor applications, certificates, and invoices.', permission: 'accessPaymentNotices' },
  { id: 'permits', href: '/permits', label: 'Permits to Work', icon: FileCheck, desc: 'Issue and track high-risk activity permits electronically.', permission: 'accessPermits' },
  { id: 'training', href: '/training', label: 'Training & Compliance', icon: GraduationCap, desc: 'Store employee certificates and monitor expiry dates.', permission: 'accessTraining' },
  { id: 'holidays', href: '/holidays', label: 'Holiday Booking', icon: Sun, desc: 'Request leave and track team availability.', permission: 'accessHolidays' },
  { id: 'client-instructions', href: '/client-instructions', label: 'Client Instructions', icon: MessageCircle, permission: 'accessClientInstructions' },
  { id: 'site-instructions', href: '/instructions', label: 'Site Instructions', icon: MessageSquare, permission: 'accessSiteInstructions' },
  { id: 'cleanup-notices', href: '/cleanup-notices', label: 'Clean Up Notices', icon: Sparkles, permission: 'accessCleanupNotices' },
  { id: 'snagging', href: '/snagging', label: 'Snagging Lists', icon: ListChecks, permission: 'accessSnagging' },
  { id: 'quality-control', href: '/quality-control', label: 'Quality Control', icon: ClipboardCheck, permission: 'accessQualityControl' },
  { id: 'information-requests', href: '/information-requests', label: 'Info Requests', icon: HelpCircle, permission: 'accessInfoRequests' },
];

function FlashingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center z-40">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
      <span className="relative inline-flex rounded-full h-4 w-4 bg-primary text-[8px] font-black text-white items-center justify-center shadow-lg border border-white/20">
        {count}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading: userLoading } = useUser();
  const db = useFirestore();
  const pathname = usePathname();
  const [isCompact, setIsCompact] = useState(false);
  const [orderedCardIds, setOrderedCardIds] = useState<string[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [canDragId, setCanDragId] = useState<string | null>(null);
  const [loadingModule, setLoadingModule] = useState<string | null>(null);

  const projectsQuery = useMemoFirebase(() => {
    if (!db) return null;
    return collection(db, 'projects');
  }, [db]);
  const { data: allProjects } = useCollection<Project>(projectsQuery);

  const rfiQuery = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return query(collection(db, 'information-requests'), where('status', '==', 'open'));
  }, [db, user?.email]);
  const { data: rawRequests } = useCollection<InformationRequest>(rfiQuery);

  const ciQuery = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return query(collection(db, 'client-instructions'), where('status', '==', 'open'));
  }, [db, user?.email]);
  const { data: rawClientInstructions } = useCollection<ClientInstruction>(ciQuery);

  const holidayQuery = useMemoFirebase(() => {
    if (!db || !user?.email) return null;
    return query(collection(db, 'holiday-requests'), where('status', '==', 'pending'));
  }, [db, user?.email]);
  const { data: rawHolidays } = useCollection<HolidayRequest>(holidayQuery);

  useEffect(() => {
    setLoadingModule(null);
    const savedDensity = localStorage.getItem('sitecommand_dashboard_compact');
    if (savedDensity !== null) setIsCompact(savedDensity === 'true');
    const savedOrder = localStorage.getItem('sitecommand_dashboard_order');
    const defaultIds = DASHBOARD_CARDS.map(c => c.id);
    if (savedOrder) {
      try {
        const parsed = JSON.parse(savedOrder) as string[];
        const existingIds = new Set(defaultIds);
        const filteredParsed = parsed.filter(id => existingIds.has(id));
        const missingIds = defaultIds.filter(id => !filteredParsed.includes(id));
        setOrderedCardIds([...filteredParsed, ...missingIds]);
      } catch (e) { setOrderedCardIds(defaultIds); }
    } else { setOrderedCardIds(defaultIds); }
  }, [pathname]);

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

  const allowedProjectIds = useMemo(() => {
    if (!allProjects || !profile) return [];
    if (profile.permissions?.hasFullVisibility) return allProjects.map(p => p.id);
    const email = profile.email.toLowerCase().trim();
    return allProjects
      .filter(p => (p.assignedUsers || []).some(uEmail => uEmail.toLowerCase().trim() === email))
      .map(p => p.id);
  }, [allProjects, profile]);

  const pendingCounts = useMemo(() => {
    if (!profile || !user?.email || !allowedProjectIds) return {};
    const email = user.email.toLowerCase().trim();
    
    const rfiCount = (rawRequests || []).filter(req => {
        if (!allowedProjectIds.includes(req.projectId)) return false;
        if (req.dismissedBy?.includes(email)) return false;
        
        const isAssignedToMe = req.assignedTo.some(e => e.toLowerCase().trim() === email);
        const messages = req.messages || [];
        const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        
        // Alert if:
        // 1. Assigned to me AND (it's new OR someone else spoke last)
        const assigneeNeedsAction = isAssignedToMe && (!lastMessage || lastMessage.senderEmail.toLowerCase().trim() !== email);
        
        // 2. Raised by me AND someone else spoke last
        const raiserNeedsAction = req.raisedBy.toLowerCase().trim() === email && lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== email;
        
        return assigneeNeedsAction || raiserAction;
    }).length;

    const ciCount = (rawClientInstructions || []).filter(ci => {
        if (!allowedProjectIds.includes(ci.projectId)) return false;
        if (ci.dismissedBy?.includes(email)) return false;
        
        const isRecipient = (ci.recipients || []).some(e => e.toLowerCase().trim() === email);
        const messages = ci.messages || [];
        const lastMessage = messages.length > 0 ? [...messages].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        
        // Alert if I'm a recipient and someone else (the raiser/client) was the last to speak
        const hasExternalUpdate = lastMessage && lastMessage.senderEmail.toLowerCase().trim() !== email;
        
        return isRecipient && (!lastMessage || hasExternalUpdate);
    }).length;

    const hCount = (rawHolidays || []).filter(req => {
        const isApprover = profile.permissions?.canApproveHolidays || profile.permissions?.hasFullVisibility;
        const isLineManager = req.lineManagerEmail?.toLowerCase().trim() === email;
        return isApprover || isLineManager;
    }).length;

    return {
        'information-requests': rfiCount,
        'client-instructions': ciCount,
        'holidays': hCount
    };
  }, [rawRequests, rawClientInstructions, rawHolidays, profile, user?.email, allowedProjectIds]);

  const allowedCards = useMemo(() => {
    if (!profile || orderedCardIds.length === 0) return [];
    const allowed = DASHBOARD_CARDS.filter(card => {
        if (!card.permission) return true;
        return profile.permissions?.[card.permission as keyof typeof profile.permissions] !== false;
    });
    return [...allowed].sort((a, b) => orderedCardIds.indexOf(a.id) - orderedCardIds.indexOf(b.id));
  }, [profile, orderedCardIds]);

  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedId(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;
    const newOrder = [...orderedCardIds];
    const draggedIndex = newOrder.indexOf(draggedId);
    const targetIndex = newOrder.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedId);
    setOrderedCardIds(newOrder);
    localStorage.setItem('sitecommand_dashboard_order', JSON.stringify(newOrder));
    setDraggedId(null);
  };
  const handleDragEnd = () => setDraggedId(null);

  if (userLoading || profileLoading) {
    return (
        <div className="flex flex-col w-full h-screen">
            <Header title="Dashboard" />
            <main className="flex flex-1 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>
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
                    <Button asChild variant="destructive" size="sm" className="font-bold gap-2 shrink-0"><Link href="/account">Update Account <ArrowRight className="h-4 w-4" /></Link></Button>
                </AlertDescription>
            </Alert>
        )}

        <div className="flex flex-col items-center text-center gap-3 mt-4 md:mt-8 relative w-full max-w-6xl">
            <div className={cn("p-4 bg-primary/10 rounded-2xl transition-all shadow-[0_0_30px_rgba(242,101,34,0.15)]", isCompact && "p-2")}>
                <Logo hideText iconClassName={cn("transition-all", isCompact ? "h-10 w-10" : "h-16 w-16 md:h-24 md:w-24")} />
            </div>
            <div className="px-4 mt-2 text-center">
                <h1 className={cn("font-black tracking-tighter transition-all uppercase inline-flex items-center gap-2", isCompact ? "text-xl md:text-2xl" : "text-3xl md:text-6xl")}>
                  Site<span className="text-primary">Command</span>
                </h1>
                {!isCompact && <p className="text-muted-foreground text-sm mt-2 font-bold uppercase tracking-widest opacity-60">Intelligence Hub for Modern Construction</p>}
            </div>
            <div className="absolute top-0 right-0 hidden md:flex items-center gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={toggleView} className="h-9 w-9 border-primary/20 hover:bg-primary/5">
                                {isCompact ? <LayoutGrid className="h-4 w-4 text-primary" /> : <Grid2X2 className="h-4 w-4 text-primary" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Switch to {isCompact ? 'Standard' : 'Compact'} View</p></TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>

        <div className={cn(
            "grid w-full pb-12 transition-all mt-8",
            isCompact ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-6xl"
        )}>
          {allowedCards.map((card) => {
            const pendingCount = pendingCounts[card.id as keyof typeof pendingCounts] || 0;
            return (
                <div key={card.id} draggable={canDragId === card.id} onDragStart={(e) => handleDragStart(e, card.id)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, card.id)} onDragEnd={handleDragEnd} className={cn("relative transition-opacity group", draggedId === card.id ? "opacity-40" : "opacity-100")}>
                    <div className="absolute top-2 left-2 z-30 p-1.5 opacity-0 md:group-hover:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-background/90 rounded border border-border shadow-sm hidden md:block" onMouseEnter={() => setCanDragId(card.id)} onMouseLeave={() => setCanDragId(null)}><GripVertical className="h-3.5 w-3.5 text-primary" /></div>
                    <Link href={card.href} className="block h-full" onClick={() => { if (!draggedId) setLoadingModule(card.id); }}>
                        <Card className={cn(
                          "flex flex-col items-center justify-center transition-all hover:bg-muted/50 hover:border-primary hover:shadow-[0_4px_20px_rgba(242,101,34,0.1)] h-full relative overflow-hidden", 
                          isCompact ? "p-4" : "p-6 md:p-8", 
                          loadingModule === card.id && "ring-2 ring-primary ring-offset-2"
                        )}>
                            {loadingModule === card.id && (<div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-[1px] animate-in fade-in duration-200"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>)}
                            <div className="relative flex flex-col items-center justify-center w-full h-full">
                                <div className="relative mb-4 flex items-center justify-center shrink-0">
                                    <div className={cn("flex items-center justify-center", isCompact ? "h-10 w-10" : "h-16 w-16")}>
                                        <card.icon className={cn(
                                            "transition-transform group-hover:scale-110 text-muted-foreground group-hover:text-primary", 
                                            isCompact ? "h-7 w-7" : "h-12 w-12 md:h-14 md:w-14", 
                                            loadingModule === card.id && "opacity-20"
                                        )} />
                                    </div>
                                    <FlashingBadge count={pendingCount} />
                                </div>
                                <CardTitle className={cn(
                                    "transition-all font-bold text-center w-full leading-tight", 
                                    isCompact ? "text-xs px-1" : "text-lg md:text-xl"
                                )}>
                                    {card.label}
                                </CardTitle>
                                {!isCompact && card.desc && (
                                    <div className="mt-3 hidden sm:block text-center w-full">
                                        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                                            {card.desc}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </Link>
                </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
