import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-lavender px-4 py-10 text-slateDark">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slateDark/75">
            Campus clubs
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slateDark">Club Management</h1>
          <p className="mt-2 text-sm text-slateDark/75">Your club workspace, in one place.</p>
        </div>
        <Outlet />
      </div>
    </main>
  );
}
