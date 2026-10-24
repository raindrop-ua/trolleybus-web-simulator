type IconName =
  | 'bus'
  | 'play'
  | 'pause'
  | 'overview'
  | 'follow'
  | 'free'
  | 'reset'
  | 'help'
  | 'close'
  | 'chevron'
  | 'sun'
  | 'wire'
  | 'arrow';
const paths: Record<IconName, React.ReactNode> = {
  bus: (
    <>
      <path d="m8 2 2 4m6-4-2 4M5 9h14v11H5zM5 15h14M8 20v2m8-2v2M8 18h1m6 0h1" />
      <path d="M8 9v6m8-6v6" />
    </>
  ),
  play: <path d="m9 5 11 7-11 7z" />,
  pause: (
    <>
      <path d="M8 5h2v14H8zM16 5h2v14h-2z" />
    </>
  ),
  overview: (
    <>
      <path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5" />
    </>
  ),
  follow: (
    <>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
    </>
  ),
  free: (
    <>
      <path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16m6-14v16" />
    </>
  ),
  reset: (
    <>
      <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 17h.01" />
    </>
  ),
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m8 10 4 4 4-4" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
    </>
  ),
  wire: (
    <>
      <path d="M3 5h18M3 9h18M8 9l3 8m5-8-3 8M8 17h8v4H8z" />
    </>
  ),
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
