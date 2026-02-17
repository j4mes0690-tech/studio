
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Header } from '@/components/layout/header';
import { MessageSquare, Sparkles, ListChecks, HardHat } from 'lucide-react';
import Link from 'next/link';

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
        <div className="grid max-w-6xl gap-6 md:grid-cols-3 lg:gap-8">
          <Link href="/instructions">
            <Card className="flex flex-col items-center justify-center p-8 text-center hover:bg-muted/50 transition-colors h-full">
              <CardHeader className="p-0">
                <MessageSquare className="h-16 w-16 text-primary mb-4" />
                <CardTitle className="text-2xl">Instructions</CardTitle>
              </CardHeader>
              <CardContent className="p-0 mt-2">
                <p className="text-muted-foreground">
                  Record, summarize, and distribute client instructions to your team.
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
        </div>
      </main>
    </div>
  );
}
