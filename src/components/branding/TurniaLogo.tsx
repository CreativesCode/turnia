import Image from 'next/image';

/**
 * Logotipo de Turnia (public/logo.png).
 */
export function TurniaLogo({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Turnia"
      width={size}
      height={size}
      priority
      className="shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}
