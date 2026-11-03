/** Brings a section into view once the page has drawn it. */
export function scrollToSection(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}
