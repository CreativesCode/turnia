export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-subtle-bg p-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
