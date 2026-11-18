/**
 * Data access layer. Every page reads through these functions and nothing else,
 * Real data from Supabase (lib/repo/supabase.ts); the sample dataset now only backs unit tests.
 *
 * Each read is cached ('use cache') and tagged, so ingestion can invalidate exactly
 * what changed (e.g. revalidateTag(`election:${id}`)) when new result sheets land.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import type { Election, Person } from '@/lib/domain';
import { regionOverview, type RegionKind, type RegionOverview } from '@/lib/region';
import { loadRealData } from './supabase';

/** One cached read of the whole (small) dataset; every getter below derives from it. */
async function data() {
  'use cache';
  cacheLife('hours');
  cacheTag('elections', 'people');
  return loadRealData();
}

export async function listElections(): Promise<Election[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections');
  return (await data()).elections;
}

export async function getElection(id: string): Promise<Election | undefined> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections', `election:${id}`);
  return (await data()).elections.find((e) => e.id === id);
}

export async function getLiveElection(): Promise<Election | undefined> {
  'use cache';
  cacheLife('seconds');
  cacheTag('elections', 'live');
  return (await data()).elections.find((e) => e.status === 'live');
}

export async function listPeople(): Promise<Person[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('people');
  return (await data()).people;
}

export async function getPerson(id: string): Promise<Person | undefined> {
  'use cache';
  cacheLife('hours');
  cacheTag('people', `person:${id}`);
  return (await data()).people.find((p) => p.id === id);
}

export async function getRegionOverview(kind: RegionKind, code: string): Promise<RegionOverview> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections', `region:${kind}:${code}`);
  return regionOverview((await data()).elections, kind, code);
}
