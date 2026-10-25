import type { UpdateInfo } from '../types';

const REPO = 'codeandchaos-studio/D-Deck';
const CURRENT_VERSION = '2.0.0';

function compareSemver(v1: string, v2: string): number {
  const clean1 = (v1 || '').replace(/^v/, '').trim();
  const clean2 = (v2 || '').replace(/^v/, '').trim();
  const p1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
  const p2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export async function checkUpdates(manual: boolean = false): Promise<UpdateInfo> {
  // Use Electron API if available
  if (window.electronAPI?.checkForUpdates) {
    try {
      const info = await window.electronAPI.checkForUpdates(manual);
      if (info) return info;
    } catch (err) {
      console.warn('Electron update check failed, using web fallback:', err);
    }
  }

  // Web fallback using public GitHub API
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      }
    });

    if (!res.ok) {
      return {
        available: false,
        currentVersion: CURRENT_VERSION,
        latestVersion: CURRENT_VERSION,
        releaseName: '',
        releaseNotes: '',
        publishedAt: '',
        downloadUrl: `https://github.com/${REPO}/releases/latest`,
      };
    }

    const data = await res.json();
    const latestVersion = (data.tag_name || '').replace(/^v/, '');
    const isNewer = compareSemver(latestVersion, CURRENT_VERSION) > 0;

    let installerUrl = '';
    let portableUrl = '';
    if (Array.isArray(data.assets)) {
      for (const asset of data.assets) {
        const name = (asset.name || '').toLowerCase();
        if (name.includes('setup') && name.endsWith('.exe')) {
          installerUrl = asset.browser_download_url;
        } else if (name.includes('portable') && name.endsWith('.exe')) {
          portableUrl = asset.browser_download_url;
        }
      }
    }

    return {
      available: isNewer,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      releaseName: data.name || `D-Deck v${latestVersion}`,
      releaseNotes: data.body || 'New enhancements and stability improvements.',
      publishedAt: data.published_at || new Date().toISOString(),
      downloadUrl: data.html_url || `https://github.com/${REPO}/releases/latest`,
      installerUrl: installerUrl || data.html_url,
      portableUrl: portableUrl || data.html_url,
    };
  } catch (err) {
    return {
      available: false,
      currentVersion: CURRENT_VERSION,
      latestVersion: CURRENT_VERSION,
      releaseName: '',
      releaseNotes: '',
      publishedAt: '',
      downloadUrl: `https://github.com/${REPO}/releases/latest`,
    };
  }
}

export function isUpdateDismissed(version: string): boolean {
  try {
    return sessionStorage.getItem(`dismissed_patch_v${version}`) === 'true';
  } catch {
    return false;
  }
}

export function dismissUpdate(version: string): void {
  try {
    sessionStorage.setItem(`dismissed_patch_v${version}`, 'true');
  } catch {}
}
