export type GameAction = 'left' | 'right' | 'jump' | 'slide' | 'pause' | 'start';

const actions: Record<string, GameAction> = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
    ArrowDown: 'slide', KeyS: 'slide', KeyP: 'pause', Escape: 'pause', Enter: 'start',
};

/** Web HUD buttons sit outside Cocos's canvas-only keyboard listener. */
export class BrowserKeyboard {
    private held = new Set<string>();

    constructor(
        private host: Window,
        private page: Document,
        private dispatch: (action: GameAction) => void,
        private loseFocus: () => void,
        private platformDriven=false,
    ) {
        // Capture before Cocos's canvas handler; only this path dispatches on Web.
        host.addEventListener('keydown', this.onDown, { capture: true });
        host.addEventListener('keyup', this.onUp, { capture: true });
        host.addEventListener('blur', this.onBlur);
    }

    focusCanvas(): void {
        const canvas = this.page.getElementById('GameCanvas');
        if (canvas && (this.platformDriven || !this.page.hidden)) canvas.focus({ preventScroll: true });
    }

    reset(): void { this.held.clear(); }

    private onDown = (event: KeyboardEvent): void => {
        const action = actions[event.code];
        if (!action || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
        // Tab navigation retains the normal Space/Enter activation of HUD buttons.
        if ((event.code === 'Space' || event.code === 'Enter') && target?.closest?.('button, a[href]')) return;

        if(event.code!=='Escape'){event.preventDefault();event.stopPropagation();}
        if (event.repeat || this.held.has(event.code)) return;
        this.held.add(event.code);
        this.dispatch(action);
    };

    private onUp = (event: KeyboardEvent): void => {
        // Capturing keyup also releases a key if focus moved away from the canvas.
        if (!this.held.delete(event.code)) return;
        if(event.code==='Escape')return;
        event.preventDefault();
        event.stopPropagation();
    };

    private onBlur = (): void => {
        this.reset();
        this.loseFocus();
    };

    destroy(): void {
        this.host.removeEventListener('keydown', this.onDown, { capture: true });
        this.host.removeEventListener('keyup', this.onUp, { capture: true });
        this.host.removeEventListener('blur', this.onBlur);
        this.reset();
    }
}
