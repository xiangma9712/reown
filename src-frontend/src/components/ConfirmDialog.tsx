interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props) {
  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <p>{message}</p>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn btn-danger" onClick={onConfirm}>
            削除
          </button>
        </div>
      </div>
    </div>
  );
}
