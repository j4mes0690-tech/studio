
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Settings2, Tag } from 'lucide-react';
import { ManageTrades } from './manage-trades';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * ManageTradesDialog - Wraps the Trade Management interface in a Dialog.
 * Providing a discrete entry point for configuring global trade categories.
 */
export function ManageTradesDialog({ showLabel = false }: { showLabel?: boolean }) {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size={showLabel ? "sm" : "icon"} 
                className={cn(
                    "text-primary hover:bg-primary/5 transition-colors shrink-0",
                    showLabel ? "h-8 gap-2 px-3" : "h-10 w-10"
                )}
              >
                <Settings2 className="h-4 w-4" />
                {showLabel && <span className="text-xs font-semibold">Edit Trades</span>}
                {!showLabel && <span className="sr-only">Manage Trades</span>}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Manage Trade Categories</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <DialogTitle>System Trade Categories</DialogTitle>
          </div>
          <DialogDescription>
            Add or remove trade disciplines used across SiteCommand for partner classification and quality checklists.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <ManageTrades />
        </div>
      </DialogContent>
    </Dialog>
  );
}
