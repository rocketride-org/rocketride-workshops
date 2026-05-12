// Fullscreen lightbox for image previews. Image bubbles open a magnified
// view when their thumbnail is clicked.

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  image?: string;
};

export function PreviewModal({ open, onClose, title, image }: Props) {
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="preview-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "attachment preview"}
      onClick={onClose}
    >
      <div className="preview-modal-content" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="preview-modal-close"
          aria-label="close preview"
          onClick={onClose}
        >
          ×
        </button>
        {title && <div className="preview-modal-title">{title}</div>}
        {image && <img className="preview-modal-image" src={image} alt={title ?? "attachment"} />}
      </div>
    </div>
  );
}
