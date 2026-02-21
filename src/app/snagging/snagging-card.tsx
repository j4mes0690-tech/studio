import type { SnaggingItem, Client, Project } from '@/lib/types';
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
import { Camera } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EditSnaggingItem } from './edit-snagging-item';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { ClientDate } from '../../components/client-date';

type SnaggingItemCardProps = {
  item: SnaggingItem;
  clients: Client[];
  projects: Project[];
};

export function SnaggingItemCard({
  item,
  clients,
  projects,
}: SnaggingItemCardProps) {
  const client = clients.find((c) => c.id === item.clientId);
  const project = projects.find((p) => p.id === item.projectId);

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
                - <ClientDate date={item.createdAt} />
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">Snagging Item</Badge>
            <EditSnaggingItem item={item} clients={clients} projects={projects} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-foreground mb-4">{item.description}</p>
        <Accordion type="single" collapsible className="w-full">
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
                              alt={`Snagging item photo ${index + 1}`}
                              width={600}
                              height={400}
                              className="rounded-md border object-cover aspect-video"
                              data-ai-hint="construction defect"
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
