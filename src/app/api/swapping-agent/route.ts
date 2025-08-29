import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instruction, userAddress } = body;

    if (!instruction || !userAddress) {
      return NextResponse.json(
        { error: 'Missing instruction or userAddress' },
        { status: 400 }
      );
    }

    // NOTE: The instruction contains USDC amounts in wei format (6 decimals)
    // Example: "Swap 2000000 USDC to ARB token..." means 2,000,000 wei = 2.0 USDC
    // We're sending wei format to prevent the backend from treating it as 18 decimals
    // This should resolve the decimal misinterpretation issue

    // Make the request to the external swapping agent API
    const response = await fetch('https://swapping-agent.xcan.dev/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction,
        userAddress,
      }),
    });

    if (!response.ok) {
      throw new Error(`External API failed with status: ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json(data);
  } catch (error) {
    console.error('Swapping agent API error:', error);
    return NextResponse.json(
      { error: 'Failed to process swapping agent request' },
      { status: 500 }
    );
  }
}
