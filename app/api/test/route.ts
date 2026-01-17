import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'API route is working' });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ 
      message: 'POST API route is working',
      received: body 
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to parse JSON' 
    }, { status: 400 });
  }
}
