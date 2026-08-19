const themeScript = `(() => {
  const root = document.documentElement;
  const stored = localStorage.getItem("blog-theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = stored === "light" || stored === "dark" ? stored : preferred;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();`;

export function ThemeBootScript() {
  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
