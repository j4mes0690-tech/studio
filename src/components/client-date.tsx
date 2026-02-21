'use client';

import { useState, useEffect } from 'react';

type ClientDateProps = {
  date: string | Date;
  format?: 'datetime' | 'date';
};

export function ClientDate({ date, format = 'datetime' }: ClientDateProps) {
  const [formattedDate, setFormattedDate] = useState<string | null>(null);

  useEffect(() => {
    if (date) {
        const dateObj = new Date(date);
        if (format === 'date') {
        setFormattedDate(dateObj.toLocaleDateString());
        } else {
        setFormattedDate(dateObj.toLocaleString());
        }
    }
  }, [date, format]);

  // To prevent hydration mismatch, we render null on the server and the formatted date on the client.
  return <>{formattedDate}</>;
}
