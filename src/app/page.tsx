import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { MessageSquare, Sparkles, ListChecks, HardHat, HelpCircle, ClipboardCheck, Settings } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  return (
    <div className="flex flex-col w-full">
      <Header title="Dashboard" />
      <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 md:p-8">
        <HardHat className="h-24 w-24 text-primary" />
        <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Welcome to SiteCommand</h1>
            <p className="text-muted-foreground">Select an action to get started.</p>
        </div>
        <div className="grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8 w-full">
          <Link href="/instructions">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <MessageSquare className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Record, summarize, and distribute instructions to your team.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/cleanup-notices">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <Sparkles className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Clean Up Notices</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Create and send clean up notices to sub-contractors with photos.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/snagging">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <ListChecks className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Snagging Lists</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Record and track snagging items with photos and descriptions.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/information-requests">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <HelpCircle className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Info Requests</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Log and track requests for information.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/quality-control">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <ClipboardCheck className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Quality Control</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Use checklists to check each trade's work and sign off.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/settings">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full border-primary/20 bg-primary/5">
              <CardHeader className="p-0">
                <Settings className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Manage users, sub-contractors, projects, and checklist templates.
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    </div>
  );
}
