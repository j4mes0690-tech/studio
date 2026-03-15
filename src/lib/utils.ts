import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { SubContractor, DistributionUser } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

  allUsers.forEach(user => {
    if (user.subContractorId === subId && user.receivePartnerEmails) {
      emails.add(user.email.toLowerCase().trim());
    }
  });

  return Array.from(emails);
}

/**
 * scrollToFirstError - Finds the first element with a validation error and scrolls it into view.
 * Essential for providing immediate visual feedback in long documentation forms.
 */
export function scrollToFirstError() {
  // Delay slightly to ensure React Hook Form has finished rendering the error state
  setTimeout(() => {
    // Target ShadCN/Radix error patterns: aria-invalid fields or FormMessage containers
    const firstError = document.querySelector('[aria-invalid="true"], .text-destructive, [id*="-form-item-message"]');
    
    if (firstError) {
      // Find the container FormItem so the label is also scrolled into view
      const container = firstError.closest('.space-y-2') || firstError;
      
      container.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      
      // If it's a focusable control, put the cursor there
      const focusable = firstError.hasAttribute('aria-invalid')
        ? firstError
        : firstError.closest('.space-y-2')?.querySelector('input, textarea, button, [role="combobox"]');
          
      if (focusable instanceof HTMLElement) {
        focusable.focus({ preventScroll: true });
      }
    }
  }, 150);
}
