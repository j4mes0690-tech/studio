import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SubContractor, DistributionUser, PlannerTask } from "./types"
import { addDays, isValid, format, startOfDay } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * parseDateString - Timezone-safe date parser for construction dates (YYYY-MM-DD)
 */
export function parseDateString(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * calculateFinishDate - Determines the end date of a task based on its duration.
 * If includeWeekends is false, it skips Saturday and Sunday.
 */
export function calculateFinishDate(startDateStr: string, duration: number, includeWeekends: boolean): string {
  let date = parseDateString(startDateStr);
  if (!isValid(date)) return startDateStr;

  let count = 1;
  while (count < duration) {
    date = addDays(date, 1);
    if (!includeWeekends) {
      // Explicit check for Sunday (0) and Saturday (6)
      while (date.getDay() === 0 || date.getDay() === 6) {
        date = addDays(date, 1);
      }
    }
    count++;
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * calculateNextStartDate - Determines the start date for a successor task.
 */
export function calculateNextStartDate(finishDateStr: string, includeWeekends: boolean): string {
  let date = addDays(parseDateString(finishDateStr), 1);
  if (!isValid(date)) return finishDateStr;

  if (!includeWeekends) {
    // Explicit check for Sunday (0) and Saturday (6)
    while (date.getDay() === 0 || date.getDay() === 6) {
      date = addDays(date, 1);
    }
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * optimiseGlobalSchedule - Runs a critical path analysis on a set of tasks to 
 * shift dates based on predecessor linkages.
 */
export function optimiseGlobalSchedule(
  allPlannerTasks: PlannerTask[], 
  includeWeekends: boolean,
  onUpdate: (taskId: string, updates: Partial<PlannerTask>) => void
) {
  let changed = true;
  let iterations = 0;
  const maxIterations = allPlannerTasks.length * 2; 
  let currentTasks = [...allPlannerTasks];

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (let i = 0; i < currentTasks.length; i++) {
      const t = currentTasks[i];
      if (!t.predecessorIds || t.predecessorIds.length === 0) continue;

      const taskPredecessors = currentTasks.filter(p => t.predecessorIds.includes(p.id));
      
      let latestFinishDateStr: string | null = null;
      let latestFinishDateObj: Date | null = null;

      taskPredecessors.forEach(p => {
        const pFinishStr = p.status === 'completed' && p.actualCompletionDate 
          ? p.actualCompletionDate 
          : calculateFinishDate(p.startDate, p.durationDays, includeWeekends);
        
        const pFinishObj = parseDateString(pFinishStr);
        
        if (isValid(pFinishObj)) {
          if (!latestFinishDateObj || pFinishObj > latestFinishDateObj) {
            latestFinishDateObj = pFinishObj;
            latestFinishDateStr = pFinishStr;
          }
        }
      });

      if (latestFinishDateStr) {
        const idealStart = calculateNextStartDate(latestFinishDateStr, includeWeekends);

        if (t.startDate !== idealStart) {
          onUpdate(t.id, { startDate: idealStart });
          currentTasks[i] = { ...t, startDate: idealStart };
          changed = true;
        }
      }
    }
  }
}

/**
 * generateReference - Creates a short, unique reference number for site records.
 * @deprecated Use getNextReference for the new professional project-specific format.
 */
export function generateReference(prefix: string) {
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${randomStr}`;
}

/**
 * getProjectInitials - Extracts the first letter of each word in a project name.
 */
export function getProjectInitials(name: string) {
  if (!name) return 'PRJ';
  return name
    .split(/\s+/)
    .map(word => word[0])
    .filter(char => char && /[a-zA-Z0-9]/.test(char))
    .join('')
    .toUpperCase() || 'PRJ';
}

/**
 * getNextReference - Generates a reference string: [Initials]-[Type]-[SequentialNumber]
 */
export function getNextReference(
  existingItems: { reference: string, projectId: string }[], 
  projectId: string, 
  prefix: string, 
  projectInitials: string
) {
  const projectItems = existingItems.filter(i => i.projectId === projectId);
  const pattern = new RegExp(`^${projectInitials}-${prefix}-(\\d+)$`);
  
  let maxNum = 0;
  projectItems.forEach(item => {
    const match = (item.reference || '').match(pattern);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  });

  // If no new-format references found, fallback to count + 1 to transition smoothly
  if (maxNum === 0) {
    maxNum = projectItems.length;
  }

  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  return `${projectInitials}-${prefix}-${nextNum}`;
}

/**
 * wouldCreateCycle - Checks if adding targetPredecessorId as a predecessor to currentTaskId 
 * would create a circular dependency.
 */
export function wouldCreateCycle(
  targetPredecessorId: string,
  currentTaskId: string,
  allTasks: { id: string; predecessorIds: string[] }[]
): boolean {
  if (!targetPredecessorId || !currentTaskId) return false;
  
  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const visited = new Set<string>();

  function hasPath(startId: string, endId: string): boolean {
    if (startId === endId) return true;
    if (visited.has(startId)) return false;
    visited.add(startId);

    const task = taskMap.get(startId);
    if (!task || !task.predecessorIds) return false;

    for (const predId of task.predecessorIds) {
      if (hasPath(predId, endId)) return true;
    }
    return false;
  }

  return hasPath(targetPredecessorId, currentTaskId);
}

/**
 * getPartnerEmails - Returns a list of all emails that should receive correspondence for a partner.
 * Includes the partner's primary email and any associated users with 'receivePartnerEmails' enabled.
 */
export function getPartnerEmails(
  subId: string, 
  subContractors: SubContractor[], 
  allUsers: DistributionUser[]
): string[] {
  const emails = new Set<string>();
  
  const sub = subContractors.find(s => s.id === subId);
  if (sub?.email) {
    emails.add(sub.email.toLowerCase().trim());
  }

  if (allUsers && Array.isArray(allUsers)) {
    allUsers.forEach(user => {
      if (user.subContractorId === subId && user.receivePartnerEmails) {
        emails.add(user.email.toLowerCase().trim());
      }
    });
  }

  return Array.from(emails);
}

/**
 * scrollToFirstError - Finds the first element with a validation error and scrolls it into view.
 * Uses 'center' block alignment for better reliability on mobile devices.
 */
export function scrollToFirstError() {
  // Delay slightly to ensure React Hook Form has finished rendering the error state
  setTimeout(() => {
    // Target ShadCN/Radix error patterns: aria-invalid fields or FormMessage containers
    const firstError = document.querySelector('[aria-invalid="true"], .text-destructive, [id*="-form-item-message"]');
    
    if (firstError) {
      // Find the container FormItem so the label is also scrolled into view
      const container = firstError.closest('.space-y-2') || firstError.closest('[data-radix-collection-item]') || firstError;
      
      container.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center', // Center in viewport to avoid overlaps from headers or keyboards
        inline: 'nearest'
      });
      
      // If it's a focusable control, put the cursor there
      const focusable = firstError.hasAttribute('aria-invalid')
        ? firstError
        : firstError.closest('.space-y-2')?.querySelector('input, textarea, button, [role="combobox"]');
          
      if (focusable instanceof HTMLElement) {
        // Focus without triggering another scroll to avoid fighting the smooth animation
        setTimeout(() => focusable.focus({ preventScroll: true }), 100);
      }
    }
  }, 150);
}