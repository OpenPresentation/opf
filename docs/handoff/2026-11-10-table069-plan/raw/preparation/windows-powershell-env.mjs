// Windows PowerShell must rebuild its own module paths when Node inherits a
// PowerShell 7 environment. Keep the removal scoped to the child process.
// https://learn.microsoft.com/powershell/module/microsoft.powershell.core/about/about_psmodulepath#starting-windows-powershell-from-powershell-7
export function windowsPowerShellEnvironment(parentEnvironment) {
  return Object.fromEntries(
    Object.entries(parentEnvironment).filter(([key]) => key.toLowerCase() !== 'psmodulepath'),
  );
}
