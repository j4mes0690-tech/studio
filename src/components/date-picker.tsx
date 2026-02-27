"use client";

import { cn } from '@/lib/utils';
import { FormLabel, FormMessage, FormItem, FormControl } from '@/components/ui/form';
import type { ControllerRenderProps } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { addWeeks } from 'date-fns';
import { useState } from 'react';

type DatePickerProps = {
  field: ControllerRenderProps<any, any>;
  label: string;
};

export function DatePicker({ field, label }: DatePickerProps) {
  const [isFocused, setIsFocused] = useState(false);

  // The native date input expects a 'yyyy-mm-dd' string.
  // The form state stores an ISO string. We convert it for the input.
  const value = field.value ? new Date(field.value).toISOString().split('T')[0] : '';

  // On change, the input gives us a 'yyyy-mm-dd' string.
  // We need to convert it back to an ISO string for the form state.
  // We construct the date as UTC to avoid timezone-related off-by-one day errors.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && val !== 'ASAP') {
      const [year, month, day] = val.split('-').map(Number);
      const dateInUTC = new Date(Date.UTC(year, month - 1, day));
      field.onChange(dateInUTC.toISOString());
    } else {
      field.onChange(undefined);
    }
  };
  
  const setQuickDate = (weeks: number | 'asap') => {
    if (weeks === 'asap') {
      field.onChange(undefined);
    } else {
      const newDate = addWeeks(new Date(), weeks);
      field.onChange(newDate.toISOString());
    }
  }

  const displayValue = (field.value || isFocused) ? value : 'ASAP';
  const inputType = (field.value || isFocused) ? 'date' : 'text';

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex flex-wrap items-center gap-2">
        <FormControl>
            <input
            type={inputType}
            className={cn(
                "flex h-10 w-auto rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            )}
            value={displayValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              setIsFocused(false);
              field.onBlur();
            }}
            name={field.name}
            ref={field.ref}
            />
        </FormControl>
        <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate('asap')}>ASAP</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(1)}>+1w</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(2)}>+2w</Button>
      </div>
      <FormMessage />
    </FormItem>
  );
}
