import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Fetch a random image from Unsplash
    // Using the public API endpoint (no API key needed for basic usage)
    const response = await fetch(
      'https://source.unsplash.com/random/480x480?nature,architecture,animals,food,technology,art',
      {
        redirect: 'follow',
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch image from Unsplash');
    }

    // Get the final URL after redirect
    const imageUrl = response.url;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error fetching random image:', error);
    return NextResponse.json(
      { error: 'Failed to fetch random image' },
      { status: 500 }
    );
  }
}
