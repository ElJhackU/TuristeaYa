import { useCallback, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/layout/screen';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewFilter, type FilterType } from '@/components/ReviewFilter';
import { findDiscoveryPlace } from '@/features/turista/data/discovery';
import { useRemoteData } from '@/hooks/use-remote-data';
import { useSession } from '@/hooks/use-session';
import { listRecords } from '@/services/catalog';
import { createRecord } from '@/services/management';

export function LiveReviews() {
  const { placeId } = useLocalSearchParams<{ placeId: string }>();
  const session = useSession();
  const [filter, setFilter] = useState<FilterType>('recientes');
  const [body, setBody] = useState('');
  const [rating, setRating] = useState('5');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const load = useCallback(async (signal: AbortSignal) => {
    const places = await listRecords('places', { signal, private: !!session });
    const local = placeId ? findDiscoveryPlace(placeId) : undefined;
    const place = places.find(row => row.id === placeId) || places.find(row => local && String(row.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === local.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
    const rows = place ? await listRecords('reviews', { signal, filters: { place_id: place.id } }) : [];
    return { place, rows: rows.filter(row => !row.hidden) };
  }, [placeId, session]);
  const { data, loading, error, retry } = useRemoteData(load);
  async function publish() {
    if (!session || !data?.place || lock.current || !body.trim()) return;
    const stars = Number(rating);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) { setNotice('La calificación debe estar entre 1 y 5.'); return; }
    lock.current = true; setBusy(true); setNotice('');
    try { await createRecord('reviews', { place_id: data.place.id, user_id: session.user.id, rating: stars, body: body.trim() }); setBody(''); setNotice('Reseña publicada.'); retry(); }
    catch (err) { setNotice(err instanceof Error ? err.message : 'No se pudo publicar.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const rows = data?.rows.slice().sort((a, b) => filter === 'mejor_valoradas' ? Number(b.rating) - Number(a.rating) : String(b.created_at).localeCompare(String(a.created_at)));
  return <Screen title="Reseñas del lugar" subtitle={String(data?.place?.name || '')}>
    <ReviewFilter activeFilter={filter} onFilterChange={setFilter} />
    {loading ? <AppText>Cargando reseñas…</AppText> : null}
    {error || notice ? <AppText accessibilityRole="alert">{error || notice}</AppText> : null}
    {!loading && !error && !data?.place ? <><AppText>Elige un lugar publicado del catálogo para consultar o escribir reseñas.</AppText><Button title="Abrir catálogo" onPress={() => router.navigate('/turista/catalogo')} /></> : null}
    {rows?.map(row => <ReviewCard key={row.id} author={row.user_id === session?.user.id ? 'Tú' : 'Visitante'} rating={`${row.rating}/5`} comment={String(row.body)} />)}
    {data?.place && !rows?.length ? <AppText>Aún no hay reseñas publicadas.</AppText> : null}
    {data?.place && session ? <>
      <FormField label="Calificación (1 a 5)" value={rating} onChangeText={setRating} keyboardType="number-pad" editable={!busy} />
      <FormField label="Tu experiencia" value={body} onChangeText={setBody} maxLength={4000} multiline editable={!busy} />
      <Button title="Publicar reseña" disabled={busy || !body.trim()} onPress={publish} />
    </> : <Button title="Iniciar sesión" onPress={() => router.navigate('/login')} />}
    <Button title="Actualizar" disabled={loading} onPress={retry} />
  </Screen>;
}
