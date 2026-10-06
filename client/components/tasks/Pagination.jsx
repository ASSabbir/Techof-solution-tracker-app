'use client';
import Icon from '@/components/ui/Icon';

export default function Pagination({ page, pages, onChange }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button className="btn-soft btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}><Icon name="left" className="h-3.5 w-3.5" />Previous</button>
      <span className="text-sm font-semibold text-muted">Page {page} of {pages}</span>
      <button className="btn-soft btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next<Icon name="right" className="h-3.5 w-3.5" /></button>
    </div>
  );
}
