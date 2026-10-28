import { useEffect, useRef, type RefObject } from 'react';
const stack: symbol[] = [];
let originalOverflow = '';
export function useDialogFocus(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        if (!open)
            return;
        const id = Symbol();
        const previous = document.activeElement as HTMLElement | null;
        if (!stack.length) {
            originalOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        stack.push(id);
        const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(e => e.getClientRects().length > 0);
        const frame = requestAnimationFrame(() => focusable()[0]?.focus());
        const handle = (e: KeyboardEvent) => { if (stack.at(-1) !== id)
            return; if (e.key === 'Escape') {
            e.preventDefault();
            e.stopImmediatePropagation();
            close.current();
        } if (e.key === 'Tab') {
            const nodes = focusable();
            const first = nodes[0], last = nodes.at(-1);
            if (!first) {
                e.preventDefault();
                return;
            }
            if (e.shiftKey && (document.activeElement === first || !ref.current?.contains(document.activeElement))) {
                e.preventDefault();
                last?.focus();
            }
            else if (!e.shiftKey && (document.activeElement === last || !ref.current?.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        } };
        document.addEventListener('keydown', handle, true);
        return () => { cancelAnimationFrame(frame); document.removeEventListener('keydown', handle, true); const index = stack.indexOf(id); if (index >= 0)
            stack.splice(index, 1); if (!stack.length)
            document.body.style.overflow = originalOverflow; previous?.focus(); };
    }, [open, ref]);
}
