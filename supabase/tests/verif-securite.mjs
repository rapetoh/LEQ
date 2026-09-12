/**
 * The checks a schema cannot make about itself, run against the project.
 *
 * Every table in `public` must have row level security on, and every one that holds something
 * personal must have at least one policy. A table with RLS on and no policy is invisible; a
 * table with RLS off is wide open to anyone holding the publishable key, which is in every copy
 * of the application.
 */
import pg from 'pg'

const client = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
await client.query('begin')

const echecs = []
const dire = (ok, texte) => {
  console.log(`${ok ? 'ok  ' : 'NON '} ${texte}`)
  if (!ok) echecs.push(texte)
}

const { rows: tables } = await client.query(`
  select c.relname as table,
         c.relrowsecurity as rls,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as policies
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by c.relname`)

// A table with RLS on and no policy is invisible to every client, which is right for the work
// queue: only the service role touches it, and the service role bypasses RLS.
const SANS_POLICY_VOULU = new Set(['jobs'])

for (const t of tables) {
  dire(t.rls, `RLS active sur ${t.table}`)
  if (t.rls && !SANS_POLICY_VOULU.has(t.table)) {
    dire(Number(t.policies) > 0, `au moins une policy sur ${t.table}`)
  }
}

// A security definer function readable by `anon` is a door into the whole schema.
const { rows: fonctions } = await client.query(`
  select p.proname,
         array_agg(distinct a.rolname) filter (where a.rolname in ('anon','authenticated')) as roles
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    left join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl on true
    left join pg_roles a on a.oid = acl.grantee
   where n.nspname = 'public' and p.prosecdef and acl.privilege_type = 'EXECUTE'
   group by p.proname order by p.proname`)
// Postgres grants EXECUTE to PUBLIC on a new function by default, and PUBLIC includes anon.
// That default is what made formule_de(uuid) answer anyone holding the publishable key, so the
// check reads the ACL rather than the role list: a null ACL, or one carrying the bare `=X`
// entry, is a function open to the whole world.
const { rows: acl } = await client.query(`
  select p.proname, p.proacl::text as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
   order by p.proname`)
// lire_duel_par_jeton is deliberately open: the invitation link works with no account.
// est_admin and est_anonyme answer about the caller alone and leak nothing.
const OUVERT_VOULU = new Set(['lire_duel_par_jeton', 'est_admin', 'est_anonyme'])
const ouvertes = acl
  .filter((f) => !OUVERT_VOULU.has(f.proname))
  .filter((f) => f.acl === null || /(^|,)=X\//.test(f.acl))
  .map((f) => f.proname)
dire(
  ouvertes.length === 0,
  `aucune fonction security definer ouverte à tout le monde${ouvertes.length ? ' (' + ouvertes.join(', ') + ')' : ''}`,
)

// Buckets: only `medias` may be public.
const { rows: buckets } = await client.query('select id, public from storage.buckets order by id')
for (const b of buckets) {
  dire(
    b.id === 'medias' ? b.public === true : b.public === false,
    `bucket ${b.id} ${b.id === 'medias' ? 'public' : 'privé'}`,
  )
}

await client.query('rollback')
await client.end()
console.log(
  echecs.length === 0 ? '\nsécurité : tout passe.' : `\nsécurité : ${echecs.length} échec(s).`,
)
process.exit(echecs.length === 0 ? 0 : 1)
