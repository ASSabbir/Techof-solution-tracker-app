'use client';
import TaskBrowser from '@/components/tasks/TaskBrowser';

export default function TeamTasksPage() {
  return <TaskBrowser mine={false} />;
}
