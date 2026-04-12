export function reveal(node: HTMLElement) {
  node.classList.add('is-visible');

  return {
    destroy() {}
  };
}
