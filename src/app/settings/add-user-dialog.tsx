'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { UserPlus } from 'lucide-react';
import { AddUserForm } from './add-user-form';

export function AddUserDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 h-9">
          <UserPlus className="h-4 w-4" />
          Add New User
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create System User</DialogTitle>
          <DialogDescription>
            Manually create a internal user profile and configure their system-wide permissions.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Note: In a real app, we might want to pass a callback to close the dialog on success */}
          <AddUserForm />
        </div>
      </DialogContent>
    </Dialog>
  );
}
