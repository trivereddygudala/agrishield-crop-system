/**
 * AgriShield WebAuthn & Biometric Authentication Utility
 * 
 * Enables hardware fingerprint (Touch ID / Android Fingerprint / Windows Hello)
 * and Face ID authentication directly through standard W3C WebAuthn API.
 */

// Convert ArrayBuffer to Base64URL String
export function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Convert Base64URL String to Uint8Array
export function base64UrlToBuffer(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if the current browser and hardware device support biometrics
 */
export async function isBiometricSupported() {
  if (!window.PublicKeyCredential) {
    return false;
  }
  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(available);
    }
    return true;
  } catch (err) {
    console.debug('Biometric check error:', err);
    return false;
  }
}

/**
 * Register device fingerprint / face unlock for the logged-in user
 */
export async function registerBiometricCredential(user) {
  if (!window.PublicKeyCredential) {
    throw new Error('Biometric hardware is not supported in this browser.');
  }

  const userId = user?.id || user?._id || 'farmer-' + Date.now();
  const userEmail = user?.email || 'farmer@agrishield.app';
  const userName = user?.name || user?.full_name || 'AgriShield Farmer';

  // 32-byte cryptographically random challenge
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userIdBuffer = new TextEncoder().encode(userId);

  const publicKeyCredentialCreationOptions = {
    challenge: challenge,
    rp: {
      name: 'AgriShield Crop AI',
      id: window.location.hostname
    },
    user: {
      id: userIdBuffer,
      name: userEmail,
      displayName: userName
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256 (P-256 with SHA-256)
      { alg: -257, type: 'public-key' }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Enforce local hardware (Touch ID, Fingerprint, Windows Hello)
      userVerification: 'preferred',
      requireResidentKey: false
    },
    timeout: 60000,
    attestation: 'none'
  };

  try {
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    if (!credential) {
      throw new Error('Biometric enrollment was cancelled.');
    }

    const credentialId = bufferToBase64Url(credential.rawId);
    let rawPublicKey = null;

    if (credential.response && credential.response.getPublicKey) {
      try {
        const pkBuffer = credential.response.getPublicKey();
        if (pkBuffer) rawPublicKey = bufferToBase64Url(pkBuffer);
      } catch (e) {
        // Fallback for browsers that don't support getPublicKey()
      }
    }

    // Determine platform device name
    let deviceName = 'Android Mobile';
    if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
      deviceName = 'Apple iPhone / iPad';
    } else if (navigator.userAgent.includes('Windows')) {
      deviceName = 'Windows PC (Windows Hello)';
    } else if (navigator.userAgent.includes('Macintosh')) {
      deviceName = 'MacBook (Touch ID)';
    }

    // Save local device hint in localStorage for 1-tap prefill on /login
    localStorage.setItem('agrishield_biometric_enabled', 'true');
    localStorage.setItem('agrishield_biometric_cid', credentialId);
    localStorage.setItem('agrishield_biometric_email', userEmail);
    localStorage.setItem('agrishield_biometric_device', deviceName);

    return {
      credential_id: credentialId,
      public_key: rawPublicKey,
      device_name: deviceName,
      transports: ['internal']
    };
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      throw new Error('Biometric scan cancelled or timed out. Please try again.');
    }
    throw err;
  }
}

/**
 * Authenticate with device fingerprint / face scan
 */
export async function authenticateWithBiometrics(preferredCredentialId = null) {
  if (!window.PublicKeyCredential) {
    return {
      success: false,
      error: 'Biometric hardware is not supported on this browser.'
    };
  }

  const storedCid = preferredCredentialId || localStorage.getItem('agrishield_biometric_cid');

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const publicKeyCredentialRequestOptions = {
    challenge: challenge,
    rpId: window.location.hostname,
    userVerification: 'preferred',
    timeout: 60000
  };

  if (storedCid) {
    try {
      publicKeyCredentialRequestOptions.allowCredentials = [
        {
          id: base64UrlToBuffer(storedCid),
          type: 'public-key',
          transports: ['internal', 'hybrid']
        }
      ];
    } catch (e) {
      console.warn('Could not parse stored credential ID:', e);
    }
  }

  try {
    let assertion = null;
    try {
      assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });
    } catch (innerErr) {
      // If allowCredentials failed because credential ID wasn't found on this device,
      // retry without allowCredentials to allow discoverable credentials
      if (publicKeyCredentialRequestOptions.allowCredentials) {
        const fallbackOptions = { ...publicKeyCredentialRequestOptions };
        delete fallbackOptions.allowCredentials;
        assertion = await navigator.credentials.get({
          publicKey: fallbackOptions
        });
      } else {
        throw innerErr;
      }
    }

    if (!assertion) {
      return {
        success: false,
        error: 'Biometric authentication was cancelled.'
      };
    }

    const credentialId = bufferToBase64Url(assertion.rawId);
    const email = localStorage.getItem('agrishield_biometric_email') || '';

    return {
      success: true,
      credential_id: credentialId,
      email: email
    };
  } catch (err) {
    console.warn('Biometric assertion failed:', err);
    if (err.name === 'NotAllowedError') {
      return {
        success: false,
        error: 'Biometric authentication was cancelled or timed out.'
      };
    }
    return {
      success: false,
      error: err.message || 'Biometric authentication failed on this device.'
    };
  }
}
