import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SubContractor, DistributionUser, PlannerTask } from "./types"
import { addDays, isValid, format, startOfDay, differenceInDays } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * parseDateString - Robust date parser for construction planning (YYYY-MM-DD).
 * Anchors dates to noon to prevent timezone-related day shifts during calculations.
 */
export function parseDateString(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date(NaN);
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create date at noon local time to avoid midnight boundary issues
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * calculateWorkingDays - Calculates the number of working days (Mon-Fri) between two dates inclusive.
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string): number {
  const start = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);
  if (!isValid(start) || !isValid(end) || start > end) return 0;

  let count = 0;
  let current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) { // Not Sunday (0) or Saturday (6)
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * calculateFinishDate - Determines the end date of a task based on its duration and working week.
 */
export function calculateFinishDate(
  startDateStr: string, 
  duration: number, 
  includeSaturday: boolean, 
  includeSunday: boolean
): string {
  let date = parseDateString(startDateStr);
  if (!isValid(date)) return startDateStr;

  // 1. If the requested start falls on a non-working day, shift it forward to the first working day
  while ((date.getDay() === 6 && !includeSaturday) || (date.getDay() === 0 && !includeSunday)) {
    date = addDays(date, 1);
  }

  // 2. Count working days to determine finish date
  let count = 1;
  while (count < duration) {
    date = addDays(date, 1);
    const day = date.getDay();
    const isSat = day === 6;
    const isSun = day === 0;

    if ((isSat && !includeSaturday) || (isSun && !includeSunday)) {
      continue; // Skip non-working day
    }
    count++;
  }

  return format(date, 'yyyy-MM-dd');
}

/**
 * calculateNextStartDate - Determines the start date for a successor task.
 */
export function calculateNextStartDate(
  finishDateStr: string, 
  includeSaturday: boolean, 
  includeSunday: boolean
): string {
  // A successor starts on the next working day AFTER the predecessor finishes
  let date = addDays(parseDateString(finishDateStr), 1);
  if (!isValid(date)) return finishDateStr;

  while ((date.getDay() === 6 && !includeSaturday) || (date.getDay() === 0 && !includeSunday)) {
    date = addDays(date, 1);
  }
  return format(date, 'yyyy-MM-dd');
}

/**
 * optimiseGlobalSchedule - Runs a critical path analysis on a set of tasks.
 */
export function optimiseGlobalSchedule(
  allPlannerTasks: PlannerTask[], 
  includeSaturday: boolean,
  includeSunday: boolean,
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
          : calculateFinishDate(p.startDate, p.durationDays, includeSaturday, includeSunday);
        
        const pFinishObj = parseDateString(pFinishStr);
        
        if (isValid(pFinishObj)) {
          if (!latestFinishDateObj || pFinishObj > latestFinishDateObj) {
            latestFinishDateObj = pFinishObj;
            latestFinishDateStr = pFinishStr;
          }
        }
      });

      if (latestFinishDateStr) {
        const idealStart = calculateNextStartDate(latestFinishDateStr, includeSaturday, includeSunday);

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
 */
export function scrollToFirstError() {
  setTimeout(() => {
    const firstError = document.querySelector('[aria-invalid="true"], .text-destructive, [id*="-form-item-message"]');
    if (firstError) {
      const container = firstError.closest('.space-y-2') || firstError.closest('[data-radix-collection-item]') || firstError;
      container.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      const focusable = firstError.hasAttribute('aria-invalid')
        ? firstError
        : firstError.closest('.space-y-2')?.querySelector('input, textarea, button, [role="combobox"]');
      if (focusable instanceof HTMLElement) {
        setTimeout(() => focusable.focus({ preventScroll: true }), 100);
      }
    }
  }, 150);
}
