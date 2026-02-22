"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import type { ControllerRenderProps } from 'react-hook-form';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormLabel, FormMessage, FormItem } from '@/components/ui/form';

type DatePickerProps = {
  field: ControllerRenderProps<any, any>;
  label: string;
};

export function DatePicker({ field, label }: DatePickerProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <FormItem className="flex flex-col">
      <FormLabel>{label}</FormLabel>
      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={'outline'}
            className={cn(
              'w-[240px] justify-start text-left font-normal',
              !field.value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {field.value ? (
              format(new Date(field.value), 'PPP')
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="w-auto p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Pick a date</DialogTitle>
          </DialogHeader>
          <Calendar
            mode="single"
            selected={field.value ? new Date(field.value) : undefined}
            onSelect={(date) => {
              field.onChange(date ? date.toISOString() : undefined);
              setCalendarOpen(false);
            }}
            initialFocus
            hideHead
          />
        </DialogContent>
      </Dialog>
      <FormMessage />
    </FormItem>
  );
}
