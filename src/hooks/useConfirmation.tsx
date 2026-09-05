import { useState } from 'react';
import { ConfirmDialog } from '../components/confirmDialog/confirmDialog';

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
};

export function useConfirmation() {
  const [pending, setPending] = useState<(Confirmation & { action: () => void }) | null>(null);
  function requestConfirmation(options: Confirmation, action: () => void) {
    setPending({ ...options, action });
  }
  const confirmation = pending ? (
    <ConfirmDialog
      title={pending.title}
      description={pending.description}
      confirmLabel={pending.confirmLabel}
      cancelLabel={pending.cancelLabel}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        setPending(null);
        pending.action();
      }}
    />
  ) : null;
  return { requestConfirmation, confirmation };
}
