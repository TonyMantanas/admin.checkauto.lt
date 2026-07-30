if (window.top !== window.self) {
  document.documentElement.style.display = 'none';
  try {
    window.top.location = window.self.location.href;
  } catch {
    // A sandboxed cross-origin frame cannot be navigated; keep the page hidden.
  }
}
