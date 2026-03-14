import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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

  // If the potential predecessor already depends on the current task, 
  // making it a predecessor of the current task creates a cycle.
  return hasPath(targetPredecessorId, currentTaskId);
}
