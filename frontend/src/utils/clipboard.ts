/**
 * Copy text to clipboard with mobile fallback
 * Works on both desktop and mobile devices, even in non-HTTPS contexts
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Try modern clipboard API first (works on HTTPS and secure contexts)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // Fall through to fallback method
      console.warn('Clipboard API failed, using fallback:', err);
    }
  }

  // Fallback method for mobile browsers and non-HTTPS contexts
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Make it invisible and out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // For iOS Safari
    textArea.setSelectionRange(0, 99999);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return successful;
  } catch (err) {
    console.error('Copy failed:', err);
    return false;
  }
}
