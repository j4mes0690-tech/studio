
'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Building2,
  ShoppingCart,
  Truck,
  HelpCircle,
  Calculator,
  CalendarRange,
  ClipboardCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  Layers,
  FileCheck
} from 'lucide-react';
import type { 
  Project, 
  ProcurementItem, 
  PlantOrder, 
  PurchaseOrder, 
  InformationRequest, 
  Variation, 
  PlannerTask, 
  QualityChecklist, 
  SnaggingItem 
} from '@/lib/types';
import { cn } from '@/lib/utils';

export function ProjectInsightsContent({ allowedProjects }: { allowedProjects: Project[] }) {
  const db = useFirestore();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(allowedProjects[0]?.id || '');

  // --- DATA FETCHING ---
  const procQuery = useMemoFirebase(() => (db ? collection(db, 'procurement-items') : null), [db]);
  const { data: allProcurement } = useCollection<ProcurementItem>(procQuery);

  const plantQuery = useMemoFirebase(() => (db ? collection(db, 'plant-orders') : null), [db]);
  const { data: allPlant } = useCollection<PlantOrder>(plantQuery);

  const materialsQuery = useMemoFirebase(() => (db ? collection(db, 'purchase-orders') : null), [db]);
  const { data: allMaterials } = useCollection<PurchaseOrder>(materialsQuery);

  const rfiQuery = useMemoFirebase(() => (db ? collection(db, 'information-requests') : null), [db]);
  const { data: allRFIs } = useCollection<InformationRequest>(rfiQuery);

  const variationQuery = useMemoFirebase(() => (db ? collection(db, 'variations') : null), [db]);
  const { data: allVariations } = useCollection<Variation>(variationQuery);

  const plannerQuery = useMemoFirebase(() => (db ? collection(db, 'planner-tasks') : null), [db]);
  const { data: allTasks } = useCollection<PlannerTask>(plannerQuery);

  const qcQuery = useMemoFirebase(() => (db ? collection(db, 'quality-checklists') : null), [db]);
  const { data: allQC } = useCollection<QualityChecklist>(qcQuery);

  const snagQuery = useMemoFirebase(() => (db ? collection(db, 'snagging-items') : null), [db]);
  const { data: allSnags } = useCollection<SnaggingItem>(snagQuery);

  // --- ANALYTICS LOGIC ---
  const stats = useMemo(() => {
    if (!selectedProjectId) return null;

    // 1. Procurement
    const projectProc = (allProcurement || []).filter(i => i.projectId === selectedProjectId);
    const totalProc = projectProc.length;
    const orderedProc = projectProc.filter(i => !!i.orderPlacedDate).length;
    const procProgress = totalProc > 0 ? (orderedProc / totalProc) * 100 : 0;

    // 2. RFIs
    const projectRFIs = (allRFIs || []).filter(i => i.projectId === selectedProjectId);
    const openRFIs = projectRFIs.filter(i => i.status === 'open');
    const overdueRFIs = openRFIs.filter(i => i.requiredBy && new Date(i.requiredBy) < new Date());

    // 3. Financials
    const projectVariations = (allVariations || []).filter(i => i.projectId === selectedProjectId);
    const netVariations = projectVariations.reduce((sum, v) => sum + (v.totalAmount || 0), 0);
    const agreedVariations = projectVariations.filter(v => v.status === 'agreed').length;

    // 4. Plant & Materials
    const activePlantCount = (allPlant || []).filter(o => o.projectId === selectedProjectId && (o.status === 'on-hire' || o.status === 'scheduled')).length;
    const totalMaterialsValue = (allMaterials || []).filter(o => o.projectId === selectedProjectId && o.status === 'issued').reduce((sum, o) => sum + o.totalAmount, 0);
    const materialOrdersCount = (allMaterials || []).filter(o => o.projectId === selectedProjectId && o.status === 'issued').length;

    // 5. Schedule
    const projectTasks = (allTasks || []).filter(t => t.projectId === selectedProjectId);
    const completedTasks = projectTasks.filter(t => t.status === 'completed').length;
    const scheduleProgress = projectTasks.length > 0 ? (completedTasks / projectTasks.length) * 100 : 0;

    // 6. Quality & Snagging
    const projectChecklists = (allQC || []).filter(c => !c.isTemplate && c.projectId === selectedProjectId);
    const totalPoints = projectChecklists.reduce((sum, c) => sum + c.items.length, 0);
    const passedPoints = projectChecklists.reduce((sum, c) => sum + c.items.filter(i => i.status === 'yes').length, 0);
    const qualityScore = totalPoints > 0 ? (passedPoints / totalPoints) * 100 : 0;

    const projectSnagLists = (allSnags || []).filter(l => l.projectId === selectedProjectId);
    const openSnags = projectSnagLists.reduce((sum, l) => sum + l.items.filter(i => i.status !== 'closed').length, 0);

    return {
      procurement: { total: totalProc, ordered: orderedProc, progress: procProgress },
      rfis: { total: projectRFIs.length, open: openRFIs.length, overdue: overdueRFIs.length },
      financials: { netValue: netVariations, agreedCount: agreedVariations, totalCount: projectVariations.length },
      plant: { activeCount: activePlantCount },
      materials: { value: totalMaterialsValue, count: materialOrdersCount },
      schedule: { total: projectTasks.length, completed: completedTasks, progress: scheduleProgress },
      quality: { score: qualityScore, listCount: projectChecklists.length },
      snagging: { openCount: openSnags }
    };
  }, [selectedProjectId, allProcurement, allRFIs, allVariations, allPlant, allMaterials, allTasks, allQC, allSnags]);

  const project = allowedProjects.find(p => p.id === selectedProjectId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Executive Dashboard</h2>
          <p className="text-sm text-muted-foreground">Comprehensive performance metrics aggregated across all project modules.</p>
        </div>
        <div className="w-full md:w-[300px]">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="bg-background h-11 border-primary/20 ring-primary/20">
              <Building2 className="mr-2 h-4 w-4 text-primary" />
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              {allowedProjects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!stats ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/5">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="font-bold text-muted-foreground">Aggregating Project Data...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Top Line KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> Schedule Progress
                </CardDescription>
                <CardTitle className="text-2xl font-black">{Math.round(stats.schedule.progress)}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={stats.schedule.progress} className="h-1.5" />
                <p className="text-[10px] text-muted-foreground mt-2 font-bold">{stats.schedule.completed} / {stats.schedule.total} Activities Closed</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-accent shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <ShoppingCart className="h-3 w-3" /> Procurement
                </CardDescription>
                <CardTitle className="text-2xl font-black">{Math.round(stats.procurement.progress)}%</CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={stats.procurement.progress} className="h-1.5 bg-accent/10" indicatorClassName="bg-accent" />
                <p className="text-[10px] text-muted-foreground mt-2 font-bold">{stats.procurement.ordered} / {stats.procurement.total} Packages Ordered</p>
              </CardContent>
            </Card>

            <Card className={cn(
                "border-l-4 shadow-sm hover:shadow-md transition-all",
                stats.rfis.overdue > 0 ? "border-l-destructive bg-destructive/5" : "border-l-blue-500"
            )}>
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <HelpCircle className="h-3 w-3" /> Technical RFIs
                </CardDescription>
                <CardTitle className="text-2xl font-black">{stats.rfis.open}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                    <Badge variant={stats.rfis.overdue > 0 ? "destructive" : "secondary"} className="text-[9px] font-black uppercase">
                        {stats.rfis.overdue} OVERDUE
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-bold">of {stats.rfis.total} total</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardDescription className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Calculator className="h-3 w-3" /> Variation Impact
                </CardDescription>
                <CardTitle className={cn(
                    "text-2xl font-black",
                    stats.financials.netValue >= 0 ? "text-green-600" : "text-red-600"
                )}>
                    {stats.financials.netValue < 0 ? '-' : '+'}£{Math.abs(stats.financials.netValue).toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">
                    {stats.financials.agreedCount} of {stats.financials.totalCount} Variations Agreed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        Logistics & Assets
                    </CardTitle>
                    <CardDescription>Live site resource tracking.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl border bg-muted/5 flex items-center gap-4">
                            <div className="bg-primary/10 p-3 rounded-lg"><Truck className="h-6 w-6 text-primary" /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Active Plant Hires</p>
                                <p className="text-2xl font-black">{stats.plant.activeCount}</p>
                            </div>
                        </div>
                        <div className="p-4 rounded-xl border bg-muted/5 flex items-center gap-4">
                            <div className="bg-accent/10 p-3 rounded-lg"><ClipboardList className="h-6 w-6 text-accent" /></div>
                            <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Materials Value (Issued)</p>
                                <p className="text-2xl font-black text-accent">£{stats.materials.value.toLocaleString()}</p>
                                <p className="text-[9px] text-muted-foreground font-bold">{stats.materials.count} Purchase Orders</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileCheck className="h-5 w-5 text-green-600" />
                        Quality & Defects
                    </CardTitle>
                    <CardDescription>Audit and sign-off status.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">QC Pass Rate</span>
                            <span className="text-sm font-bold text-green-600">{Math.round(stats.quality.score)}%</span>
                        </div>
                        <Progress value={stats.quality.score} className="h-2" indicatorClassName="bg-green-500" />
                        <p className="text-[9px] text-muted-foreground font-bold uppercase">{stats.quality.listCount} Trade Checklists Active</p>
                    </div>

                    <div className="pt-4 border-t border-dashed space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                Outstanding Snags
                            </span>
                            <Badge variant="destructive" className="h-6 font-black">{stats.snagging.openCount}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Open defects requiring immediate subcontractor remediation to maintain project handover dates.
                        </p>
                    </div>
                </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
