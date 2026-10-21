import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { ErrorState } from '../components/ui/Feedback';

/** Kutilmagan render xatoliklari uchun vaqtinchalik xatolik sahifasi. */
export default function RouteErrorPage() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <ErrorState
        title={notFound ? 'Sahifa topilmadi / Page not found' : 'Vaqtinchalik xatolik / Temporary error'}
        text="Kutilmagan xatolik yuz berdi. Sahifani yangilang yoki birozdan so‘ng qayta urinib ko‘ring. / An unexpected error occurred. Reload the page or try again later."
        retryLabel="Qayta yuklash / Reload"
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
