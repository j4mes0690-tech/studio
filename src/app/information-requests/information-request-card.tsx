
import type { InformationRequest, Client, Project, DistributionUser } from '@/lib/types';
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
import { EditInformationRequest } from './edit-information-request';

type InformationRequestCardProps = {
  item: InformationRequest;
  clients: Client[];
  projects: Project[];
  distributionUsers: DistributionUser[];
};

export function InformationRequestCard({
  item,
  clients,
  projects,
  distributionUsers,
}: InformationRequestCardProps) {
  const client = clients.find((c) => c.id === item.clientId);
  const project = projects.find((p) => p.id === item.projectId);

  const assignedToArray = Array.isArray(item.assignedTo)
    ? item.assignedTo
    : item.assignedTo ? [item.assignedTo] : [];

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
                - {new Date(item.createdAt).toLocaleString()}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge>Info Request</Badge>
            <EditInformationRequest item={item} clients={clients} projects={projects} distributionUsers={distributionUsers} />
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
          {item.photo && (
            <AccordionItem value="photo">
              <AccordionTrigger className="text-sm font-semibold">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <span>Attached Photo</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <Image
                    src={item.photo.url}
                    alt="Information request photo"
                    width={600}
                    height={400}
                    className="rounded-md border object-cover"
                    data-ai-hint="document blueprint"
                  />
                  <p className="text-xs text-muted-foreground">
                    Taken on:{' '}
                    {new Date(item.photo.takenAt).toLocaleString()}
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </CardContent>
    </Card>
  );
}
