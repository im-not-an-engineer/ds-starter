document.addEventListener('click', (e) => {
  const tab = e.target.closest('.ds-tabs__tab');
  if (!tab) return;
  for (const t of tab.closest('.ds-tabs').querySelectorAll('.ds-tabs__tab')) t.setAttribute('aria-selected', String(t === tab));
});
