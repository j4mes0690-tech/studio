import type { Instruction, Client, Project } from '@/lib/types';
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
import { CheckSquare, MessageCircle, Camera, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '@/components/client-date';

type InstructionCardProps = {
  instruction: Instruction;
  clients: Client[];
  projects: Project[];
};

export function InstructionCard({
  instruction,
  clients,
  projects,
}: InstructionCardProps) {
  const client = clients.find((c) => c.id === instruction.clientId);
  const project = projects.find((p) => p.id === instruction.projectId);

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
                - <ClientDate date={instruction.createdAt} />
              </span>
            </CardDescription>
          </div>
          <Badge variant="secondary">Instruction</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground mb-4">{instruction.summary}</p>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="action-items">
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                <span>
                  Action Items ({instruction.actionItems.length})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted-foreground">
                {instruction.actionItems.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
          {instruction.recipients && instruction.recipients.length > 0 && (
             <AccordionItem value="recipients">
             <AccordionTrigger className="text-sm font-semibold">
               <div className="flex items-center gap-2">
                 <Users className="h-4 w-4" />
                 <span>
                   Distribution List ({instruction.recipients.length})
                 </span>
               </div>
             </AccordionTrigger>
             <AccordionContent>
              <div className="flex flex-wrap gap-1">
                {instruction.recipients.map((email, index) => (
                  <Badge key={index} variant="outline">{email}</Badge>
                ))}
              </div>
             </AccordionContent>
           </AccordionItem>
          )}
          {instruction.photos && instruction.photos.length > 0 && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>Attached Photos ({instruction.photos.length})</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Carousel className="w-full max-w-sm mx-auto">
                  <CarouselContent>
                    {instruction.photos.map((photo, index) => (
                      <CarouselItem key={index}>
                        <div className="p-1">
                          <div className="space-y-2">
                            <Image
                              src={photo.url}
                              alt={`Instruction photo ${index + 1}`}
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                              data-ai-hint="construction site"
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
                   {instruction.photos.length > 1 && (
                    <>
                      <CarouselPrevious />
                      <CarouselNext />
                    </>
                  )}
                </Carousel>
              </AccordionContent>
            </AccordionItem>
          )}
          <AccordionItem value="original-text">
            <AccordionTrigger className="text-sm font-semibold">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                <span>Original Instruction</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {instruction.originalText}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
