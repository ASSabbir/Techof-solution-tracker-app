'use client';
import { useRouter } from 'next/navigation';
import { useEnter } from '@/hooks/useEnter';
import TaskForm from '@/components/tasks/TaskForm';
import { PageHeader } from '@/components/ui/primitives';

export default function CreateTaskPage() {
  const router = useRouter();
  const ref = useEnter(true);
  return (
    <div ref={ref} className="mx-auto max-w-3xl">
      <PageHeader eyebrow="New task" title="Create a task" subtitle="Assign it, set a deadline, and the countdown starts immediately." />
      <div className="card card-pad" data-anim>
        <TaskForm onDone={(t) => router.push(t?._id ? `/tasks/${t._id}` : '/tasks/my')} onCancel={() => router.back()} />
      </div>
    </div>
  );
}
