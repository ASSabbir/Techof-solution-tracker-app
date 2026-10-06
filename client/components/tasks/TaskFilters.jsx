'use client';
import { useEffect, useState } from 'react';
import { useUsers } from '@/hooks/queries';
import Icon from '@/components/ui/Icon';

export const EMPTY_FILTERS = { search: '', assignedTo: '', status: '', priority: '', completion: '', extension: '', from: '', to: '' };

// Turn UI filter state into API params (dates -> ISO range in the viewer's local time).
export function toParams(f) {
  const p = { ...f };
  p.from = f.from ? new Date(`${f.from}T00:00:00`).toISOString() : '';
  p.to = f.to ? new Date(`${f.to}T23:59:59`).toISOString() : '';
  return p;
}

const Select = ({ value, onChange, children, label }) => (
  <div className="relative">
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="input cursor-pointer appearance-none pr-9">{children}</select>
    <Icon name="down" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
  </div>
);

export default function TaskFilters({ value, onChange, showUser = false }) {
  const { data: users = [] } = useUsers();
  const [text, setText] = useState(value.search);
  const [open, setOpen] = useState(false);
  const set = (k) => (v) => onChange({ ...value, [k]: v });

  useEffect(() => { setText(value.search); }, [value.search]);
  useEffect(() => {
    const t = setTimeout(() => { if (text !== value.search) onChange({ ...value, search: text }); }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const active = Object.entries(value).filter(([k, v]) => k !== 'search' && v).length;

  return (
    <div className="space-y-3" data-anim>
      <div className="flex gap-2.5">
        <div className="relative flex-1">
          <Icon name="search" className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input pl-10" placeholder="Search tasks..." value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button className="btn-soft relative" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name="sliders" /><span className="hidden sm:inline">Filters</span>
          {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white dark:text-slate-950">{active}</span>}
        </button>
      </div>
      {open && (
        <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4">
          {showUser && (
            <Select label="Assigned to" value={value.assignedTo} onChange={set('assignedTo')}>
              <option value="">Assigned to: anyone</option>
              {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
            </Select>
          )}
          <Select label="Status" value={value.status} onChange={set('status')}>
            <option value="">Status: any</option>
            {['ACTIVE', 'EXTENDED', 'EXTENSION_REQUESTED', 'OVERDUE', 'COMPLETED', 'CANCELLED'].map((s) => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}</option>)}
          </Select>
          <Select label="Priority" value={value.priority} onChange={set('priority')}>
            <option value="">Priority: any</option>
            {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
          </Select>
          <Select label="Completion" value={value.completion} onChange={set('completion')}>
            <option value="">Completion: any</option>
            <option value="OPEN">Still open</option>
            <option value="ON_TIME">Completed on time</option>
            <option value="WITHIN_EXTENSION">Within extension</option>
            <option value="LATE">Completed late</option>
          </Select>
          <Select label="Extension" value={value.extension} onChange={set('extension')}>
            <option value="">Extension: any</option>
            <option value="true">Has extensions</option>
            <option value="false">No extensions</option>
          </Select>
          <div><input type="date" aria-label="Due from" className="input" value={value.from} onChange={(e) => set('from')(e.target.value)} /></div>
          <div><input type="date" aria-label="Due until" className="input" value={value.to} onChange={(e) => set('to')(e.target.value)} /></div>
          <button className="btn-ghost" onClick={() => onChange({ ...EMPTY_FILTERS })}>Reset filters</button>
        </div>
      )}
    </div>
  );
}
