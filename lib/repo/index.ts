/**
 * Data access layer. Every page reads through these functions and nothing else,
 * so moving from the in-repo sample data to Supabase is a change to this file only.
 *
 * Each read is cached ('use cache') and tagged, so ingestion can invalidate exactly
 * what changed (e.g. revalidateTag(`election:${id}`)) when new result sheets land.
 */
import 'server-only';
import { cacheLife, cacheTag } from 'next/cache';
import type { Election, Person } from '@/lib/domain';
import { ELECTIONS, PEOPLE } from '@/lib/sample/dataset';
import { regionOverview, type RegionKind, type RegionOverview } from '@/lib/region';

export async function listElections(): Promise<Election[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections');
  return ELECTIONS;
}

export async function getElection(id: string): Promise<Election | undefined> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections', `election:${id}`);
  return ELECTIONS.find((e) => e.id === id);
}

export async function getLiveElection(): Promise<Election | undefined> {
  'use cache';
  cacheLife('seconds');
  cacheTag('elections', 'live');
  return ELECTIONS.find((e) => e.status === 'live');
}

export async function listPeople(): Promise<Person[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('people');
  return PEOPLE;
}

export async function getPerson(id: string): Promise<Person | undefined> {
  'use cache';
  cacheLife('hours');
  cacheTag('people', `person:${id}`);
  return PEOPLE.find((p) => p.id === id);
}

export async function getRegionOverview(kind: RegionKind, code: string): Promise<RegionOverview> {
  'use cache';
  cacheLife('minutes');
  cacheTag('elections', `region:${kind}:${code}`);
  return regionOverview(ELECTIONS, kind, code);
}
