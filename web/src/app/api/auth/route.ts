import { NextResponse } from 'next/server';
import {
  checkAdminCredentialsAsync,
  isUserAdmin,
  changeAdminPassword,
} from '@/lib/auth';

export async function GET() {
  const authenticated = await isUserAdmin();
  return NextResponse.json({ authenticated });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const isValid = await checkAdminCredentialsAsync(username, password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true, message: 'Logged in as Admin' });
    response.cookies.set('marvan_admin_session', 'authenticated_admin_marvan_2026', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    const result = await changeAdminPassword(currentPassword, newPassword);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, message: result.message });
    // Re-issue admin session cookie with the new password
    response.cookies.set('marvan_admin_session', 'authenticated_admin_marvan_2026', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Password update failed' }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
  response.cookies.delete('marvan_admin_session');
  return response;
}

