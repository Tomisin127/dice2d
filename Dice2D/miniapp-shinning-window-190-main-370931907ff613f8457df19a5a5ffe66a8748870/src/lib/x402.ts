/**
 * x402 Payment Protocol Utilities
 * Handles HTTP header-based payments using Coinbase CDP x402 standard
 */

export interface X402PaymentRequest {
  amount: string; // Amount in USDC (e.g., "0.01")
  description: string; // Service description
  serviceUrl?: string; // The service URL being accessed
}

export interface X402PaymentResponse {
  success: boolean;
  message: string;
  paymentProof?: string;
  transactionId?: string;
}

/**
 * Get x402 authentication headers for Coinbase CDP API
 */
export function getX402Headers(): Record<string, string> {
  const apiKey = process.env.COINBASE_API_KEY;
  const apiSecret = process.env.COINBASE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Missing Coinbase API credentials: COINBASE_API_KEY or COINBASE_API_SECRET');
  }

  // Create basic auth header for Coinbase CDP API
  const credentials = `${apiKey}:${apiSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString('base64');

  return {
    'Authorization': `Basic ${encodedCredentials}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Make an x402-authenticated request to a service
 * This sends the payment metadata as x402 headers
 */
export async function makeX402Request(
  paymentRequest: X402PaymentRequest,
  targetUrl: string = process.env.X402_ENDPOINT || 'https://api.cdp.coinbase.com/platform/v2/x402'
): Promise<X402PaymentResponse> {
  try {
    const headers = getX402Headers();

    // Add x402-specific headers
    const x402Headers = {
      ...headers,
      'X-402-Amount': paymentRequest.amount,
      'X-402-Description': paymentRequest.description,
      'X-402-Service': paymentRequest.serviceUrl || 'dice2d-game',
    };

    console.log('[v0] Making x402 payment request to:', targetUrl);
    console.log('[v0] Payment amount:', paymentRequest.amount, 'USDC');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: x402Headers,
      body: JSON.stringify({
        amount: paymentRequest.amount,
        currency: 'USDC',
        description: paymentRequest.description,
      }),
    });

    console.log('[v0] x402 response status:', response.status);

    // Handle 402 Payment Required - payment failed
    if (response.status === 402) {
      console.log('[v0] Payment failed: 402 Payment Required');
      return {
        success: false,
        message: 'Payment failed: insufficient funds or payment not authorized',
      };
    }

    // Handle success
    if (response.ok) {
      const data = await response.json();
      console.log('[v0] Payment successful:', data);
      return {
        success: true,
        message: 'Payment processed successfully',
        paymentProof: data.proof || data.id,
        transactionId: data.transactionId || data.id,
      };
    }

    // Handle other errors
    const errorData = await response.json().catch(() => ({}));
    console.log('[v0] x402 error response:', errorData);

    return {
      success: false,
      message: `Payment service error: ${errorData.message || response.statusText}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] x402 request error:', errorMessage);
    return {
      success: false,
      message: `Payment service unavailable: ${errorMessage}`,
    };
  }
}

/**
 * Verify x402 payment proof
 * In production, this would validate the signature and timestamp
 */
export function verifyX402Proof(proof: string): boolean {
  if (!proof || proof.length === 0) {
    return false;
  }
  // In production, verify the signature cryptographically
  // For now, just check that proof exists
  return true;
}
