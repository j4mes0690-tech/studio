'use client';

import type { InformationRequest, Project, DistributionUser } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Camera, Users, MessageSquareReply, CalendarClock, XCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EditInformationRequest } from './edit-information-request';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { RespondToRequest } from './respond-to-request';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
  } from '@/components/ui/tooltip';
import { closeInformationRequestAction, reopenInformationRequestAction, deleteInformationRequestAction } from './actions';
import { useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ClientDate } from '../../components/client-date';


function CloseRequestButton({ requestId }: { requestId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleClose = () => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', requestId);
            const result = await closeInformationRequestAction(formData);

            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <XCircle className="h-4 w-4" />
                                <span className="sr-only">Close Request</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Close Request</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will close the information request and no more replies can be added.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClose} disabled={isPending}>
                        {isPending ? 'Closing...' : 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function ReopenRequestButton({ requestId }: { requestId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleReopen = () => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', requestId);
            const result = await reopenInformationRequestAction(formData);

            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <RefreshCw className="h-4 w-4" />
                                <span className="sr-only">Reopen Request</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Reopen Request</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reopen the information request, allowing replies to be added again.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReopen} disabled={isPending}>
                        {isPending ? 'Reopening...' : 'Confirm'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function DeleteRequestButton({ requestId }: { requestId: string }) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    const handleDelete = () => {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('id', requestId);
            const result = await deleteInformationRequestAction(formData);

            if (result.success) {
                toast({ title: 'Success', description: result.message });
            } else {
                toast({
                    title: 'Error',
                    description: result.message,
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <AlertDialog>
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Trash2 className="h-4 w-4 text-destructive" />
                                <span className="sr-only">Delete Request</span>
                            </Button>
                        </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Delete Request</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete this information request and all of its messages. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending} className="bg-destructive hover:bg-destructive/90">
                        {isPending ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}


type InformationRequestCardProps = {
  item: InformationRequest;
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function InformationRequestCard({
  item,
  projects,
  distributionUsers,
}: InformationRequestCardProps) {
  const project = projects.find((p) => p.id === item.projectId);

  const assignedToArray = Array.isArray(item.assignedTo)
    ? item.assignedTo
    : item.assignedTo ? [item.assignedTo] : [];
    
  const messages = item.messages || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{project?.name || 'Unknown Project'}</CardTitle>
            <CardDescription className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground/80">
                    <ClientDate date={item.createdAt} />
                </span>
            </CardDescription>
            {item.requiredBy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                    <CalendarClock className="h-4 w-4" />
                    <span>Required by: <ClientDate date={item.requiredBy} format="date" /></span>
                </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={item.status === 'open' ? 'default' : 'secondary'} className='capitalize'>{item.status}</Badge>
            {item.status === 'open' && (
                <>
                    <RespondToRequest item={item} distributionUsers={distributionUsers} />
                    <CloseRequestButton requestId={item.id} />
                </>
            )}
            {item.status === 'closed' && (
              <ReopenRequestButton requestId={item.id} />
            )}
            <EditInformationRequest item={item} projects={projects} distributionUsers={distributionUsers} />
            <DeleteRequestButton requestId={item.id} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground mb-4">{item.description}</p>
        <Accordion type="single" collapsible className="w-full">
          {assignedToArray.length > 0 && (
            <AccordionItem value="assigned-to">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>
                    Assigned To ({assignedToArray.length})
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="flex flex-wrap gap-1">
                  {assignedToArray.map((email, index) => {
                    const user = distributionUsers.find(u => u.email === email);
                    const displayName = user ? `${user.name} (${user.email})` : email;
                    return <Badge key={index} variant="outline">{displayName}</Badge>;
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="conversation">
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <MessageSquareReply className="h-4 w-4" />
                <span>Conversation ({messages.length})</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              {messages.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">No replies yet.</p>
              ) : (
                  messages.map((msg) => (
                        <div key={msg.id} className="rounded-md border bg-muted/50 p-3">
                          <div className="flex items-center justify-between">
                              <p className="font-semibold text-sm">{msg.sender}</p>
                              <p className="text-xs text-muted-foreground"><ClientDate date={msg.createdAt} /></p>
                          </div>
                          <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">{msg.message}</p>
                      </div>
                  ))
              )}
            </AccordionContent>
          </AccordionItem>
          {item.photos && item.photos.length > 0 && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>Attached Photos ({item.photos.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Carousel className="w-full max-w-sm mx-auto">
                  <CarouselContent>
                    {item.photos.map((photo, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <div className="space-y-2">
                            <Image
                              src={photo.url}
                              alt={`Information request photo ${index + 1}`}
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                              data-ai-hint="document blueprint"
                            />
                            <p className="text-xs text-muted-foreground">
                              Taken on:{' '}
                              <ClientDate date={photo.takenAt} />
                            </p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {item.photos.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
