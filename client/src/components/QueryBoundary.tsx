import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import { useT } from '../i18n/locale';
import { ErrorState, Loading } from './ui/Feedback';

interface Props<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  /** 404 uchun maxsus ko'rinish (masalan, NotFoundPage) */
  notFound?: ReactNode;
}

/** Yuklanish va xatolik holatlarini bir joyda boshqaradi. */
export function QueryBoundary<T>({ query, children, notFound }: Props<T>) {
  const t = useT();
  if (query.isPending) return <Loading label={t('loading')} />;
  if (query.isError) {
    if (notFound && query.error instanceof ApiError && query.error.status === 404) return <>{notFound}</>;
    return <ErrorState title={t('errorTitle')} text={t('errorText')} retryLabel={t('retry')} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}
