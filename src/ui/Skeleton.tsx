import logo from '../assets/logo.png';
import ui from './ui.module.css';

/** Shown before the session is known, so the app never opens on a blank screen. */
export function LoadingScreen() {
  return (
    <main className={ui.loadingScreen} role="status">
      <img alt="" className={ui.loadingLogo} height="84" src={logo} width="84" />
      <span className={ui.visuallyHidden}>Loading</span>
    </main>
  );
}

/** Grey shapes in place of a page while its records load. */
export function PageSkeleton({ label = 'Loading your records…' }: { label?: string }) {
  return (
    <div className={ui.page}>
      <span className={ui.visuallyHidden}>{label}</span>
      <div aria-hidden="true" className={`${ui.skeleton} ${ui.skeletonHero}`} />
      <div aria-hidden="true" className={ui.statGrid}>
        {[0, 1, 2, 3].map((tile) => (
          <div className={`${ui.skeleton} ${ui.skeletonTile}`} key={tile} />
        ))}
      </div>
      <div aria-hidden="true" className={`${ui.skeleton} ${ui.skeletonHero}`} />
    </div>
  );
}
