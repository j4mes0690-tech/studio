
'use client';

import { useTransition } from 'react';
import type { Invitation } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Trash2, Clock, Mail, CheckCircle2, XCircle, Link as LinkIcon, Copy, ShieldCheck, Users2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ClientDate } from '@/components/client-date';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function InvitationsList({ invitations }: { invitations: Invitation[] }) {
  const db = useFirestore();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleRemove = (id: string) => {
    startTransition(async () => {
      await deleteDoc(doc(db, 'invitations', id));
      toast({ title: 'Invite Cancelled', description: 'The onboarding link has been invalidated.' });
    });
  };

  const copyLink = (token: string) => {
    const host = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${host}/join?token=${token}`;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link Copied', description: 'Join URL copied to clipboard.' });
  };

  return (
    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
      {invitations.map((invite) => {
        const isExpired = new Date(invite.expiresAt) < new Date() && invite.status === 'pending';
        const isPending = invite.status === 'pending';
        const isAccepted = invite.status === 'accepted';

        return (
          <div key={invite.id} className={cn(
            "flex items-start justify-between p-3 rounded-lg border bg-muted/5 group",
            isExpired && "opacity-60 grayscale"
          )}>
            <div className="space-y-2 flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm">{invite.name}</p>
                <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold tracking-tighter">
                    {invite.userType === 'internal' ? <ShieldCheck className="h-2 w-2 mr-1 text-primary" /> : <Users2 className="h-2 w-2 mr-1 text-accent" />}
                    {invite.userType}
                </Badge>
              </div>
              
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-2.5 w-2.5" /> {invite.email}
                </p>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground font-medium">
                    <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Sent <ClientDate date={invite.createdAt} format="date" /></span>
                    {!isAccepted && (
                        <span className={cn(
                            "flex items-center gap-1",
                            isExpired ? "text-destructive font-bold" : "text-muted-foreground"
                        )}>
                            {isExpired ? 'Expired' : 'Expires'}: <ClientDate date={invite.expiresAt} format="date" />
                        </span>
                    )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                {isPending && !isExpired && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-6 text-[10px] gap-1.5 px-2 font-bold"
                        onClick={() => copyLink(invite.token)}
                    >
                        <Copy className="h-2.5 w-2.5" /> Copy Join Link
                    </Button>
                )}
                {isAccepted && (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-[9px] gap-1 h-5">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Joined Platform
                    </Badge>
                )}
                {isExpired && (
                    <Badge variant="destructive" className="text-[9px] gap-1 h-5">
                        <XCircle className="h-2.5 w-2.5" /> Link Expired
                    </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemove(invite.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Cancel Invitation</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        );
      })}
      {invitations.length === 0 && (
          <p className="text-muted-foreground text-center py-12 text-sm italic border-2 border-dashed rounded-lg bg-muted/5">
            No active or pending invitations.
          </p>
      )}
    </div>
  );
}
