function ConfirmDialog({ cancelLabel = "Cancel", confirmLabel, danger = false, description, busy = false, onCancel, onConfirm, title }) {
  return (
    <div className="modal-overlay confirmation-overlay" role="presentation">
      <section aria-describedby="confirmation-dialog-description" aria-modal="true" className="trade-modal confirmation-modal" role="dialog" aria-labelledby="confirmation-dialog-title">
        <p className="eyebrow">Confirm action</p>
        <h2 id="confirmation-dialog-title">{title}</h2>
        <p className="modal-copy" id="confirmation-dialog-description">{description}</p>
        <div className="modal-buttons">
          <button className="secondary-action" disabled={busy} onClick={onCancel} type="button">{cancelLabel}</button>
          <button className={danger ? "danger-action" : "primary-action"} disabled={busy} onClick={onConfirm} type="button">{busy ? "Working…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmDialog;
