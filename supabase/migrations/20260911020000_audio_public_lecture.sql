-- LEQ, migration "audio_public_lecture" (Phase 7). Reading the audio of a public take, so the
-- phone can sign a URL and play it while voting (C7) or reading a duel verdict (C6). The rule
-- is the one of chapter 11, expressed on storage: an Arena take is audible only once the
-- listener has spoken on that subject; a duel take only to its two participants, once closed.

drop policy if exists audio_public_select on storage.objects;
create policy audio_public_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'audio-public'
    and exists (
      select 1
        from public.prises_publiques p
       where p.chemin_audio = storage.objects.name
         and p.audio_supprime_le is null
         and (
           p.utilisateur_id = (select auth.uid())
           or (
             p.statut = 'publiee'
             and (
               (p.contexte = 'arene' and public.a_parle_sur(p.sujet_id))
               or (
                 p.contexte = 'duel'
                 and exists (
                   select 1 from public.duels d
                    where d.id = p.duel_id
                      and d.statut = 'clos'
                      and (d.inviteur_id = (select auth.uid()) or d.invite_id = (select auth.uid())))
               )
             )
           )
         )
    )
  );
