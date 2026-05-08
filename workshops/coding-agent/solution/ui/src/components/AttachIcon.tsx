type Props = { size?: number };

export function AttachIcon({ size = 22 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21 11.5 12.5 20a5 5 0 1 1-7.07-7.07L13 5.36a3.5 3.5 0 1 1 4.95 4.95l-7.59 7.59a2 2 0 0 1-2.83-2.83l6.88-6.88" />
    </svg>
  );
}
