export function ResetBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="reset-banner" role="status">
      <span>History reached its cap and was cleared.</span>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
