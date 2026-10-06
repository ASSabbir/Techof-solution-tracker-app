import { Badge } from '@/components/ui/primitives';
import { STATUS_META, PRIORITY_META, RESULT_META } from '@/lib/constants';

export const StatusBadge = ({ status }) => {
  const m = STATUS_META[status] || STATUS_META.PENDING;
  return <Badge tone={m.tone} dot>{m.label}</Badge>;
};
export const PriorityBadge = ({ priority }) => {
  const m = PRIORITY_META[priority] || PRIORITY_META.MEDIUM;
  return <Badge tone={m.tone}>{m.label}</Badge>;
};
export const ResultBadge = ({ result }) => {
  const m = RESULT_META[result];
  return m ? <Badge tone={m.tone} icon="check">{m.short}</Badge> : null;
};
