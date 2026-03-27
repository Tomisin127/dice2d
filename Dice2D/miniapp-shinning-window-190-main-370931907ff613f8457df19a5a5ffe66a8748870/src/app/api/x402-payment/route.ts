import { makeX402Request, verifyX402Proof, X402PaymentResponse } from '@/lib/x402';

export async function POST(request: Request): Promise<Response> {
  try {
    console.log('[v0] x402-payment endpoint called');

    const body = await request.json().catch(() => ({}));
    const { amount = '0.01', description = 'Dice2D Game Roll' } = body;

    // Validate inputs
    if (!amount || parseFloat(amount) <= 0) {
      console.log('[v0] Invalid payment amount:', amount);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid payment amount',
        } as X402PaymentResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Make x402 payment request
    const paymentResult = await makeX402Request({
      amount,
      description,
      serviceUrl: 'https://api.cdp.coinbase.com/platform/v2/x402',
    });

    console.log('[v0] Payment result:', paymentResult);

    // If payment failed, return 402 Payment Required
    if (!paymentResult.success) {
      console.log('[v0] x402 payment failed:', paymentResult.message);
      return new Response(
        JSON.stringify(paymentResult),
        { status: 402, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify payment proof
    if (paymentResult.paymentProof && !verifyX402Proof(paymentResult.paymentProof)) {
      console.log('[v0] Payment proof verification failed');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Payment proof verification failed',
        } as X402PaymentResponse),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Payment successful
    console.log('[v0] Payment successful, returning 200');
    return new Response(
      JSON.stringify(paymentResult),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[v0] x402-payment endpoint error:', errorMessage);

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Payment service error: ' + errorMessage,
      } as X402PaymentResponse),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
