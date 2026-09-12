import pg from 'pg'
const c = new pg.Client({
  connectionString: `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
})
await c.connect()
await c.query('begin')
for (const [nom, sql] of [
  [
    'sujets',
    'select cle, ordre, actif, actif_le, ferme_le from public.sujets_arene order by ordre',
  ],
  ['theses', 'select cle, ordre, actif from public.theses order by ordre'],
  ['config quota', "select cle, valeur from public.configuration where cle like 'quota_face%'"],
  ['actif', 'select * from public.sujet_arene_actif()'],
  [
    'definition',
    "select pg_get_functiondef(oid) as d from pg_proc where proname = 'sujet_arene_actif'",
  ],
]) {
  const r = await c.query(sql)
  console.log(
    `--- ${nom}:`,
    nom === 'definition' ? r.rows[0]?.d?.slice(0, 400) : JSON.stringify(r.rows),
  )
}
await c.query('rollback')
await c.end()
