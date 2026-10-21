import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, type ReactNode } from 'react';
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { LOCALES, LOCALE_LABELS, type SettingsKey, type SettingsPatchInput } from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { useSaveSettings } from '../api';
import { applyIssues, serverIssues } from './form-utils';
import { Card } from './common';
import { errorMessage } from './row-actions';

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `id-${Math.random().toString(36).slice(2)}${Date.now()}`);

export type AnyForm = UseFormReturn<FieldValues>;

interface GroupFormProps<T extends FieldValues> {
  group: SettingsKey;
  title: string;
  description?: string;
  schema: z.ZodType<T>;
  values: T;
  children: (form: AnyForm) => ReactNode;
  /** Massiv guruhlari (bannerlar, havolalar) forma ichida shu kalit ostida turadi */
  wrap?: string;
  /** Forma qiymatlarini yuborishdan oldin o'zgartirish (masalan, matnni massivga aylantirish) */
  transform?: (v: T) => unknown;
}

/** Bitta sozlama guruhi: o'z formasi, validatsiyasi va "Saqlash" tugmasi bor. Faqat shu guruh yuboriladi (PATCH). */
export function GroupForm<T extends FieldValues>({ group, title, description, schema, values, children, transform, wrap }: GroupFormProps<T>) {
  const toast = useToast();
  const save = useSaveSettings();
  const form = useForm<T>({ resolver: zodResolver(schema as never) as never, defaultValues: values as never });

  useEffect(() => form.reset(values as never), [values, form]);

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      const payload = transform ? transform(v) : v;
      await save.mutateAsync({ [group]: payload } as SettingsPatchInput);
      toast.success(`${title}: saqlandi`);
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) applyIssues(form as never, issues.map((i) => ({ ...i, path: `${wrap ? `${wrap}.` : ''}${String(i.path).replace(new RegExp(`^${group}\\.?`), '')}` })));
      toast.error(errorMessage(err));
    }
  });

  return (
    <Card title={title}>
      {description && <p className="mb-4 text-sm text-muted">{description}</p>}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {children(form as unknown as AnyForm)}
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button type="submit" loading={save.isPending || form.formState.isSubmitting} disabled={!form.formState.isDirty}>Saqlash</Button>
          {form.formState.isDirty && <span className="text-sm text-warn-700">Saqlanmagan o‘zgarishlar bor</span>}
        </div>
      </form>
    </Card>
  );
}

interface LocalizedProps {
  form: AnyForm;
  name: string;
  label: string;
  multiline?: boolean;
  hint?: string;
}

/** Bir maydonning uch tildagi qiymatlari (uz/ru/en). */
export function LocalizedFields({ form: f, name, label, multiline, hint }: LocalizedProps) {
  const errors = f.formState.errors as Record<string, Record<string, { message?: string }> | undefined>;
  const nested = name.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], errors) as Record<string, { message?: string }> | undefined;
  return (
    <fieldset className="space-y-3 rounded-md border border-line p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {LOCALES.map((l) => (
        <Field key={l} label={LOCALE_LABELS[l]} error={nested?.[l]?.message}>
          {multiline ? <Textarea rows={3} {...f.register(`${name}.${l}`)} /> : <Input {...f.register(`${name}.${l}`)} />}
        </Field>
      ))}
    </fieldset>
  );
}

export function errorOf(form: AnyForm, path: string): string | undefined {
  const errors = form.formState.errors;
  const found = path.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;
  return found?.message;
}
