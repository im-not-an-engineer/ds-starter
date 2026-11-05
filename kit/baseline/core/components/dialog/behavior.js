document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-dialog-open]');
  if (opener) document.getElementById(opener.dataset.dialogOpen)?.showModal?.();
  const d = e.target.closest('dialog.ds-dialog');
  if (d && (e.target === d || e.target.closest('[data-dialog-close]'))) d.close();
});
