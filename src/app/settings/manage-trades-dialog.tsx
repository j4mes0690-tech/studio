
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
import { Settings2 } from 'lucide-react';
import { ManageTrades } from './manage-trades';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * ManageTradesDialog - Wraps the Trade Management interface in a Dialog
 * to provide a discrete entry point from other administration modules.
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
                    "text-primary hover:bg-primary/5 transition-colors",
                    showLabel ? "h-8 gap-2 px-3" : "h-9 w-9"
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Trade Category Management</DialogTitle>
          <DialogDescription>
            Add or remove trade specialties used across all site quality checklists.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <ManageTrades />
        </div>
      </DialogContent>
    </Dialog>
  );
}
