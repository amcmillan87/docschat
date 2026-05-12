-- Enable pgvector extension
create extension if not exists vector;

-- Users (admins only — chat is public)
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz default now(),
  created_by uuid references users(id)
);

-- Sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  source_url text,
  uploaded_by uuid references users(id),
  uploaded_at timestamptz default now(),
  chunk_count int default 0,
  status text default 'processing'
);

-- Chunks with vector embeddings (Voyage AI voyage-3 = 1024 dims)
create table document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  chunk_index int not null,
  metadata jsonb default '{}',
  embedding vector(1024)
);

-- HNSW index for fast similarity search
create index on document_chunks using hnsw (embedding vector_cosine_ops);

-- Vector similarity search function
create or replace function search_chunks(
  query_embedding vector(1024),
  match_count int default 8
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  chunk_index int,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.content,
    dc.chunk_index,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;
