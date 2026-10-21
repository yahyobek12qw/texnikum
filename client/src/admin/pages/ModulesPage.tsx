import { useEffect, useState } from 'react';
import { MODULES, defaultModules, type ModuleKey, type ModulesState } from '@uchkoprik/shared';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../components/ui/cn';
import { useSaveSettings } from '../api';
import { useAdminModules } from '../auth';
import { Card, PageTitle } from '../components/common';
import { errorMessage } from '../components/row-actions';

function Switch({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string; id: string }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer font-medium">{label}</label>
        <p id={`${id}-d`} className="text-sm text-muted">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={`${id}-d`}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors', checked ? 'border-accent-600 bg-accent-600' : 'border-line bg-surface')}
      >
        <span className="sr-only">{checked ? 'Yoqilgan' : 'O‘chirilgan'}</span>
        <span aria-hidden className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </li>
  );
}

export default function ModulesPage() {
  const toast = useToast();
  const current = useAdminModules();
  const save = useSaveSettings();
  const [draft, setDraft] = useState<ModulesState>(current);
  useEffect(() => setDraft(current), [current]);

  const dirty = MODULES.some((m) => draft[m.key] !== current[m.key]);
  const set = (k: ModuleKey, v: boolean) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = async () => {
    try {
      await save.mutateAsync({ modules: draft });
      toast.success('Modullar saqlandi. O‘zgarish saytda darhol kuchga kirdi.');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const group = (g: 'main' | 'extra', title: string, text: string) => (
    <Card title={title}>
      <p className="mb-2 text-sm text-muted">{text}</p>
      <ul className="divide-y divide-line">
        {MODULES.filter((m) => m.group === g).map((m) => (
          <Switch key={m.key} id={`mod-${m.key}`} checked={draft[m.key]} onChange={(v) => set(m.key, v)} label={m.label} description={m.description} />
        ))}
      </ul>
    </Card>
  );

  return (
    <>
      <PageTitle title="Modullar (funksiyalarni yoqish/o‘chirish)" actions={<><Button variant="secondary" onClick={() => setDraft(defaultModules())}>Standart holat</Button><Button disabled={!dirty} loading={save.isPending} onClick={() => void submit()}>Saqlash</Button></>} />
      <Alert tone="info" className="mb-5">Modul o‘chirilganda uning ma’lumotlari <strong>o‘chmaydi</strong>: bo‘lim faqat saytda, menyuda, qidiruvda, sitemap’da va admin paneldan yashiriladi. Qayta yoqsangiz, hammasi avvalgidek ko‘rinadi.</Alert>
      {dirty && <Alert tone="warn" className="mb-5">Saqlanmagan o‘zgarishlar bor.</Alert>}
      <div className="grid max-w-3xl gap-6">
        {group('main', 'Asosiy funksiyalar', 'Hozir ishlayotgan asosiy bo‘limlar.')}
        {group('extra', 'Qo‘shimcha funksiyalar (hozircha o‘chirilgan)', 'Kerak bo‘lganda yoqing.')}
      </div>
    </>
  );
}
