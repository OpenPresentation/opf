# Font preflight registration correction

The initial preflight remains unchanged. Its recommendation for private registration was incorrect for PowerPoint running in another process. Use the reviewed surviving-parent helper with AddFontResourceExW flags 0, then remove each successful owned addition in finally using the same flags. The HKLM/HKCU inventory establishes only the recorded permanent registration state; it does not prove absence of session registrations.

The corrected JSON retains the 33 permitted face hashes and licenses, binds the initial report, and distinguishes this guidance correction from the earlier inventory. The separate font-owner controls passed both deliberate helper failure and timeout with all eight successful owned additions removed. No Office call was made by those controls.

Reference: [Microsoft AddFontResourceExW](https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-addfontresourceexw).
