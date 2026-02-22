"use client";

import { cn } from '@/lib/utils';
import { FormLabel, FormMessage, FormItem, FormControl } from '@/components/ui/form';
import type { ControllerRenderProps } from 'react-hook-form';

type DatePickerProps = {
  field: ControllerRenderProps<any, any>;
  label: string;
};

export function DatePicker({ field, label }: DatePickerProps) {
  // The native date input expects a 'yyyy-mm-dd' string.
  // The form state stores an ISO string. We convert it for the input.
  const value = field.value ? new Date(field.value).toISOString().split('T')[0] : '';

  // On change, the input gives us a 'yyyy-mm-dd' string.
  // We need to convert it back to an ISO string for the form state.
  // We construct the date as UTC to avoid timezone-related off-by-one day errors.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month, day] = e.target.value.split('-').map(Number);
      const dateInUTC = new Date(Date.UTC(year, month - 1, day));
      field.onChange(dateInUTC.toISOString());
    } else {
      field.onChange(undefined);
    }
  };

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <FormControl>
        <input
          type="date"
          className={cn(
            "flex h-10 w-[240px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          )}
          value={value}
          onChange={handleChange}
          onBlur={field.onBlur}
          name={field.name}
          ref={field.ref}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  );
}
