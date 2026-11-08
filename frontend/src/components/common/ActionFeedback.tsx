import React, { createContext, useContext, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

// A dialog owns its close lock; actions register only while their request is pending.
export const DialogActionContext = createContext<(() => () => void) | null>(null);
const FormPendingContext = createContext(false);

function useAction() {
  const register = useContext(DialogActionContext);
  const running = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function run(action: () => unknown) {
    if (running.current) return;
    running.current = true;
    setPending(true); setError('');
    const release = register?.();
    try { await action(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thực hiện được thao tác. Vui lòng thử lại.'); }
    finally { running.current = false; setPending(false); release?.(); }
  }
  return { pending, error, run };
}

type ActionButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  busyLabel?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => unknown;
};
export function ActionButton({ busyLabel = 'Đang lưu…', onClick, children, disabled, type = 'button', ...props }: ActionButtonProps) {
  const action = useAction();
  const formPending = useContext(FormPendingContext);
  const pending = action.pending || (type === 'submit' && formPending);
  return <>
    <button {...props} type={type} disabled={disabled || pending} aria-busy={pending || undefined}
      onClick={onClick ? event => { if (!disabled && !pending) void action.run(() => onClick(event)); } : undefined}>
      {pending ? <><Loader2 aria-hidden="true" size={15} className="inline-block animate-spin motion-reduce:animate-none mr-1.5"/>{busyLabel}</> : children}
    </button>
    {action.error && <p role="alert" className="sf-feedback error text-sm">{action.error}</p>}
  </>;
}

type ActionFormProps = Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onSubmit'> & {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => unknown;
};
export function ActionForm({ onSubmit, children, ...props }: ActionFormProps) {
  const action = useAction();
  return <form {...props} aria-busy={action.pending || undefined} onSubmit={event => {
    event.preventDefault(); void action.run(() => onSubmit(event));
  }}>
    <FormPendingContext.Provider value={action.pending}>
      <fieldset disabled={action.pending} className="min-w-0 border-0 p-0 m-0 space-y-4">{children}</fieldset>
    </FormPendingContext.Provider>
    {action.error && <p role="alert" className="sf-feedback error text-sm">{action.error}</p>}
  </form>;
}
