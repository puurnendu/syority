import { Task } from 'gantt-task-react';

export function transformActivitiesToGanttTasks(activities: any[]): Task[] {
  if (!activities || activities.length === 0) return [];

  const tasks: Task[] = [];
  
  // Group activities by workpack to create a hierarchy (MS Project-like)
  const workpackGroups = new Map<string, any[]>();
  const workpackNames = new Map<string, string>();

  activities.forEach(act => {
    const wpId = act.workpack_id || 'unassigned';
    const wpName = act.workpack?.title || 'Unassigned Tasks';
    
    if (!workpackGroups.has(wpId)) {
      workpackGroups.set(wpId, []);
      workpackNames.set(wpId, wpName);
    }
    workpackGroups.get(wpId)!.push(act);
  });

  workpackGroups.forEach((groupActs, wpId) => {
    // 1. Calculate the bounding dates for the workpack folder
    let groupStart = new Date(8640000000000000); // Max date
    let groupEnd = new Date(-8640000000000000);  // Min date
    let totalProgress = 0;

    const groupTasks: Task[] = groupActs.map(act => {
      let start = new Date(act.planned_start || act.actual_start || Date.now());
      let end = new Date(act.planned_end || act.actual_end || new Date(start.getTime() + 86400000));
      
      if (start.getTime() >= end.getTime()) {
        end = new Date(start.getTime() + 86400000);
      }

      if (start < groupStart) groupStart = start;
      if (end > groupEnd) groupEnd = end;
      totalProgress += act.progress_percent || 0;

      const dependencies: string[] = [];
      const predecessorDisplayArr: string[] = [];
      if (act.predecessors && Array.isArray(act.predecessors)) {
        act.predecessors.forEach((p: any) => {
          if (p.predecessor_id) {
            dependencies.push(p.predecessor_id);
            if (p.predecessor?.activity_number) {
                predecessorDisplayArr.push(p.predecessor.activity_number);
            }
          }
        });
      }

      const successorDisplayArr: string[] = [];
      if (act.successors && Array.isArray(act.successors)) {
        act.successors.forEach((s: any) => {
            if (s.successor?.activity_number) {
                successorDisplayArr.push(s.successor.activity_number);
            }
        });
      }

      // Duration calculation (simplified for display)
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: act.id,
        type: 'task',
        name: act.activity_number ? `${act.activity_number} - ${act.description}` : act.description,
        description: act.description,
        start,
        end,
        progress: act.progress_percent || 0,
        project: wpId, // Grouping property
        dependencies,
        // Meta fields for our custom TaskListTable
        durationDisplay: `${diffDays} day${diffDays !== 1 ? 's' : ''}`,
        predecessorsDisplay: predecessorDisplayArr.join(', '),
        successorsDisplay: successorDisplayArr.join(', '),
        text1: act.notes || '',
        text2: act.responsible || '',
        resourceNames: act.assigned_users?.map((u: any) => u.name).join(', ') || '',
        styles: {
          progressColor: '#0078d4', // MS Project Blue
          progressSelectedColor: '#005a9e',
          backgroundColor: '#eff6fc',
        }
      } as Task & { 
        durationDisplay: string; 
        predecessorsDisplay: string; 
        successorsDisplay: string;
        text1: string;
        text2: string;
        resourceNames: string;
        description: string;
      };
    });


    // 2. Create the "Summary" parent task (Workpack)
    if (wpId !== 'unassigned') {
      const parentTask: Task = {
        id: `wp-${wpId}`,
        type: 'project',
        name: workpackNames.get(wpId) || 'Workpack',
        start: groupStart,
        end: groupEnd,
        progress: Math.round(totalProgress / groupActs.length),
        hideChildren: false,
        styles: {
          progressColor: '#333333', // Blackish for summary bars
          progressSelectedColor: '#000000',
          backgroundColor: '#f3f2f1', 
        }
      };
      tasks.push(parentTask);
    }

    // 3. Add children
    tasks.push(...groupTasks);
  });

  return tasks;
}

