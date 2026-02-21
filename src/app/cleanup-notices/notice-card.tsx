
import type { CleanUpNotice, Client, Project } from '@/lib/types';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Camera, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type NoticeCardProps = {
  notice: CleanUpNotice;
  clients: Client[];
  projects: Project[];
};

export function NoticeCard({
  notice,
  clients,
  projects,
}: NoticeCardProps) {
  const client = clients.find((c) => c.id === notice.clientId);
  const project = projects.find((p) => p.id === notice.projectId);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{project?.name || 'Unknown Project'}</CardTitle>
            <CardDescription className="flex items-center gap-2 pt-1">
              <Avatar className="h-6 w-6">
                <AvatarImage src={client?.avatarUrl} />
                <AvatarFallback>{client?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <span>{client?.name || 'Unknown Client'}</span>
              <span className="text-xs text-muted-foreground/80">
                - {new Date(notice.createdAt).toLocaleString()}
              </span>
            </CardDescription>
          </div>
          <Badge variant="destructive">Clean Up Notice</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground mb-4">{notice.description}</p>
        <Accordion type="single" collapsible className="w-full">
          {notice.recipients && notice.recipients.length > 0 && (
             <AccordionItem value="recipients">
             <AccordionTrigger className="text-sm font-semibold">
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4" />
                 <span>
                   Notified Sub-Contractors ({notice.recipients.length})
                 </span>
               </div>
             </AccordionTrigger>
             <AccordionContent>
              <div className="flex flex-wrap gap-1">
                {notice.recipients.map((email, index) => (
                  <Badge key={index} variant="outline">{email}</Badge>
                ))}
              </div>
             </AccordionContent>
           </AccordionItem>
          )}
          {notice.photos && notice.photos.length > 0 && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>Attached Photos ({notice.photos.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Carousel className="w-full max-w-sm mx-auto">
                  <CarouselContent>
                    {notice.photos.map((photo, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <div className="space-y-2">
                            <Image
                              src={photo.url}
                              alt={`Clean up notice photo ${index + 1}`}
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                              data-ai-hint="construction mess debris"
                            />
                            <p className="text-xs text-muted-foreground">
                              Taken on:{' '}
                              {new Date(photo.takenAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {notice.photos.length > 1 && (
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
