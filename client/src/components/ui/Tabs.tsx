import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './cn';

export interface TabItem<K extends string> {
  key: K;
  label: ReactNode;
  badge?: ReactNode;
}

interface Props<K extends string> {
  tabs: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
  children: (key: K) => ReactNode;
}

/** ARIA tabs: o'q tugmalari bilan boshqariladi. Faqat faol panel DOMda render qilinmaydi — holat parent formada saqlanadi. */
export function Tabs<K extends string>({ tabs, active, onChange, label, className, children }: Props<K>) {
  const id = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    else return;
    e.preventDefault();
    const k = tabs[next]!.key;
    onChange(k);
    refs.current[k]?.focus();
  };

  return (
    <div className={className}>
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => { refs.current[t.key] = el; }}
            role="tab"
            type="button"
            id={`${id}-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={active === t.key ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              '-mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium',
              active === t.key ? 'border-primary-700 text-primary-700' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-${active}`} aria-labelledby={`${id}-tab-${active}`} className="pt-4">
        {children(active)}
      </div>
    </div>
  );
}
