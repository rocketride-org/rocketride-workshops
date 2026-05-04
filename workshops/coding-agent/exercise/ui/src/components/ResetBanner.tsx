// TODO: show a dismissible notice when chat history was cleared due to cap.
export function ResetBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="reset-banner">
      <span>TODO ResetBanner</span>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
