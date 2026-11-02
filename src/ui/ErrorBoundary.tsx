import { Component, type ReactNode } from 'react';
import { reportError } from './errorSink';
import ui from './ui.module.css';

/** A crash on one screen shows a way back, not a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    reportError(error);
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className={ui.vaultScreen}>
        <section className={ui.card}>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Something went wrong</h1>
          <p className={ui.caption}>Your records are safe. Reloading usually fixes this.</p>
          <button className={ui.button} onClick={() => window.location.reload()} type="button">
            Reload
          </button>
        </section>
      </main>
    );
  }
}
