-- Companies table (multi-tenant)
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  is_owner BOOLEAN DEFAULT false,
  must_change_password BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Company members with roles
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roles TEXT[] NOT NULL DEFAULT '{}',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE IF NOT EXISTS public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'developer',
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Dependencies table
CREATE TABLE IF NOT EXISTS public.dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  current_version TEXT NOT NULL,
  latest_version TEXT,
  package_type TEXT DEFAULT 'npm',
  update_type TEXT,
  status TEXT DEFAULT 'unknown',
  ai_summary TEXT,
  changelog_url TEXT,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, name)
);

ALTER TABLE public.dependencies ENABLE ROW LEVEL SECURITY;

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  roles TEXT[] NOT NULL DEFAULT '{}',
  token TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "company_select" ON public.companies FOR SELECT
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "company_insert" ON public.companies FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "company_update" ON public.companies FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "company_delete" ON public.companies FOR DELETE
  USING (owner_id = auth.uid());

-- RLS Policies for profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    id = auth.uid() OR
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    OR company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- RLS Policies for company_members
CREATE POLICY "members_select" ON public.company_members FOR SELECT
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR company_id IN (SELECT company_id FROM public.company_members cm WHERE cm.user_id = auth.uid())
  );
CREATE POLICY "members_insert" ON public.company_members FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "members_update" ON public.company_members FOR UPDATE
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "members_delete" ON public.company_members FOR DELETE
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

-- RLS Policies for projects
CREATE POLICY "projects_select" ON public.projects FOR SELECT
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
CREATE POLICY "projects_insert" ON public.projects FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND (
      company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
      OR company_id IN (
        SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND 'project_lead' = ANY(roles)
      )
    )
  );
CREATE POLICY "projects_update" ON public.projects FOR UPDATE
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR id IN (SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'project_lead')
  );
CREATE POLICY "projects_delete" ON public.projects FOR DELETE
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

-- RLS Policies for project_members
CREATE POLICY "project_members_select" ON public.project_members FOR SELECT
  USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "project_members_insert" ON public.project_members FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects WHERE company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
      UNION
      SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'project_lead'
    )
  );
CREATE POLICY "project_members_delete" ON public.project_members FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
      UNION
      SELECT project_id FROM public.project_members WHERE user_id = auth.uid() AND role = 'project_lead'
    )
  );

-- RLS Policies for dependencies
CREATE POLICY "deps_select" ON public.dependencies FOR SELECT
  USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "deps_insert" ON public.dependencies FOR INSERT
  WITH CHECK (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "deps_update" ON public.dependencies FOR UPDATE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    ))
  );
CREATE POLICY "deps_delete" ON public.dependencies FOR DELETE
  USING (
    project_id IN (SELECT id FROM public.projects WHERE company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    ))
  );

-- RLS Policies for invitations
CREATE POLICY "invitations_select" ON public.invitations FOR SELECT
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
CREATE POLICY "invitations_insert" ON public.invitations FOR INSERT
  WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );
CREATE POLICY "invitations_update" ON public.invitations FOR UPDATE
  USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Trigger for auto-creating profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company_id, is_owner)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    (new.raw_user_meta_data ->> 'company_id')::uuid,
    coalesce((new.raw_user_meta_data ->> 'is_owner')::boolean, false)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
