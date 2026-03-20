
'use client';

import { useTransition, useMemo } from 'react';
import type { HolidayRequest, DistributionUser } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Calendar, 
  Clock, 
  User, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ShieldCheck,
  Plane,
  Stethoscope,
  Info,
  Calculator
} from 'lucide-react';
import { ClientDate } from '@/components/client-date';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { sendHolidayStatusEmailAction } from './actions';

export function HolidayRequestCard({ 
  request, 
  currentUser,
  canApprove,
  remainingDays
}: { 
  request: HolidayRequest; 
  currentUser: DistributionUser;
  canApprove: boolean;
  remainingDays?: number;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const isPendingStatus = request.status === 'pending';
  const isMe = request.userEmail.toLowerCase() === currentUser.email.toLowerCase();

  const handleUpdateStatus = (newStatus: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        const docRef = doc(db, 'holiday-requests', request.id);
        const updates = {
          status: newStatus,
          approvedByEmail: currentUser.email,
          approvedByName: currentUser.name
        };
        
        await updateDoc(docRef, updates);
        
        // Notify the user via email
        await sendHolidayStatusEmailAction({
            email: request.userEmail,
            name: request.userName,
            status: newStatus,
            startDate: request.startDate,
            endDate: request.endDate,
            type: request.type,
            approvedBy: currentUser.name
        });

        toast({ title: `Request ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`, description: `${request.userName}'s leave record has been updated.` });
      } catch (err) {
        toast({ title: 'Error', description: 'Failed to update request.', variant: 'destructive' });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'holiday-requests', request.id));
      toast({ title: 'Request Cancelled', description: 'The leave request has been removed.' });
    });
  };

  const typeConfig = {
    holiday: { icon: Plane, label: 'Holiday', color: 'text-blue-600', bg: 'bg-blue-50' },
    sick: { icon: Stethoscope, label: 'Sick Leave', color: 'text-rose-600', bg: 'bg-rose-50' },
    other: { icon: Info, label: 'Other', color: 'text-slate-600', bg: 'bg-slate-50' }
  };

  const config = typeConfig[request.type];

  return (
    <Card className={cn(
        "transition-all border-l-4 shadow-sm group",
        request.status === 'approved' ? 'border-l-green-500 bg-green-50/5' :
        request.status === 'rejected' ? 'border-l-red-500 opacity-75' : 'border-l-primary'
    )}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={cn("p-1.5 rounded-md", config.bg)}>
                <config.icon className={cn("h-3.5 w-3.5", config.color)} />
              </div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              <Badge variant="secondary" className="text-[9px] uppercase font-black h-4 px-1.5">{request.totalDays} Days</Badge>
            </div>
            <CardDescription className="flex items-center gap-2 font-bold text-foreground text-xs uppercase tracking-tight">
              <User className="h-3 w-3 text-primary" /> {request.userName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Badge className={cn(
                "text-[9px] uppercase font-bold tracking-tight h-5",
                request.status === 'approved' ? 'bg-green-100 text-green-800' :
                request.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            )}>
                {request.status}
            </Badge>
            {isPendingStatus && isMe && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleDelete}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {request.notes && <p className="text-[11px] text-muted-foreground italic leading-relaxed">"{request.notes}"</p>}
        
        <div className="grid grid-cols-2 gap-3 bg-muted/20 p-3 rounded-lg border border-dashed text-[11px]">
            <div className="space-y-1">
                <p className="font-bold text-muted-foreground uppercase tracking-widest">Start Date</p>
                <p className="font-bold flex items-center gap-1.5">
                    <Calendar className="h-3 w-3 text-primary" />
                    <ClientDate date={request.startDate} format="date" />
                </p>
            </div>
            <div className="space-y-1 text-right">
                <p className="font-bold text-muted-foreground uppercase tracking-widest">End Date</p>
                <p className="font-bold flex items-center justify-end gap-1.5">
                    <Calendar className="h-3 w-3 text-primary" />
                    <ClientDate date={request.endDate} format="date" />
                </p>
            </div>
        </div>

        {request.status !== 'pending' && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
                <ShieldCheck className="h-3 w-3" />
                <span>Decision by {request.approvedByName} on <ClientDate date={request.createdAt} /></span>
            </div>
        )}

        {isPendingStatus && canApprove && !isMe && (
            <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                        <Calculator className="h-3 w-3" /> Remaining Balance
                    </span>
                    <Badge variant="outline" className={cn(
                        "h-5 px-2 text-[10px] font-black border-transparent",
                        (remainingDays || 0) <= 0 ? "bg-red-50 text-red-700" : 
                        (remainingDays || 0) <= 5 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"
                    )}>
                        {remainingDays ?? 0} Days Left
                    </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <Button 
                        variant="outline" 
                        className="h-9 gap-2 text-red-600 border-red-200 bg-red-50/50 hover:bg-red-50 font-bold"
                        onClick={() => handleUpdateStatus('rejected')}
                        disabled={isPending}
                    >
                        <XCircle className="h-4 w-4" />
                        Reject
                    </Button>
                    <Button 
                        className="h-9 gap-2 bg-green-600 hover:bg-green-700 font-bold"
                        onClick={() => handleUpdateStatus('approved')}
                        disabled={isPending}
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                    </Button>
                </div>
            </div>
        )}
      </CardContent>
    </Card>
  );
}
