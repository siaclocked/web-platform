import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workerId = searchParams.get('worker_id');

    // Workers can only see their own documents
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const isManager = userData?.role === 'manager' || userData?.role === 'admin';
    const targetWorkerId = isManager && workerId ? workerId : user.id;

    const { data: documents, error } = await supabase
      .from('documents')
      .select('*')
      .eq('worker_id', targetWorkerId)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is manager
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'manager' && userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only managers can upload documents' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workerId = formData.get('worker_id') as string;
    const name = formData.get('name') as string;
    const expiresAt = formData.get('expires_at') as string | null;

    if (!file || !workerId || !name) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Upload file to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${workerId}/${Date.now()}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Create document record
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert({
        worker_id: workerId,
        uploaded_by: user.id,
        name,
        file_path: uploadData.path,
        file_type: file.type,
        file_size: file.size,
        expires_at: expiresAt || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Notify worker
    await supabase.from('notifications').insert({
      user_id: workerId,
      title: 'New Document',
      message: `A new document "${name}" has been shared with you`,
      type: 'document',
      metadata: { document_id: document.id },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
