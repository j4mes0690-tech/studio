
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

/**
 * ManageTradesDialog - Wraps the Trade Management interface in a Dialog
 * to provide a discrete entry point from other administration modules.
 */
export function ManageTradesDialog() {
  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 text-primary hover:bg-primary/5 transition-colors">
                <Settings2 className="h-5 w-5" />
                <span className="sr-only">Manage Trades</span>
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
