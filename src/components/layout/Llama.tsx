/** Glifo de brasa/llama de Bosca — la identidad de marca (calor de estufa). */
export function Llama({ className = "", id = "brasa" }: { className?: string; id?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={id} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e89a4a" />
          <stop offset="0.55" stopColor="#c8772e" />
          <stop offset="1" stopColor="#7a2230" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.5c2.6 3 1.2 5-.2 6.4-1.1 1.1-2.3 2.3-2.3 4.1 0 .5.1 1 .3 1.4-1-.4-1.7-1.3-1.9-2.6-1.3 1.2-2 2.8-2 4.5A6.1 6.1 0 0 0 12 22a6.1 6.1 0 0 0 6.1-6.1c0-3.4-2-5.3-3.4-6.9C13.3 7.4 12.5 6 12 4.3c-.2.7-.6 1.3-1.2 1.9.6-1.3.9-2.7 1.2-3.7Z"
      />
    </svg>
  );
}
