export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background pt-safe lg:bg-subtle-bg">
      <div className="min-h-screen p-4 sm:p-6">{children}</div>
    </div>
  );
}
